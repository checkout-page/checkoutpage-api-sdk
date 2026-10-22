import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  IWebhookFunctions,
} from 'n8n-workflow';
import { vi } from 'vitest';

export const TEST_NODE: INode = {
  id: 'node-1',
  name: 'Checkout Page',
  type: 'n8n-nodes-checkoutpage.checkoutPage',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
};

export const CREDENTIALS = { apiKey: 'YOUR_API_KEY', baseUrl: 'https://api.checkoutpage.com' };

export type HttpResponse = unknown | Error;

export function httpMock(responses: HttpResponse[]) {
  const queue = [...responses];
  return vi.fn<(credential: string, options: IHttpRequestOptions) => Promise<unknown>>(async () => {
    if (!queue.length) throw new Error('Unexpected HTTP request');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
}

export function apiError(status: number, message: string, errors?: IDataObject[]): Error {
  const error = new Error(`Request failed with status code ${status}`) as Error & IDataObject;
  error.response = {
    status,
    data: { status: 'error', type: 'api_error', message, ...(errors ? { errors } : {}) },
  };
  return error;
}

export function requestOptions(mock: ReturnType<typeof httpMock>, call = 0): IHttpRequestOptions {
  return mock.mock.calls[call][1];
}

function parameterGetter(params: IDataObject) {
  return (name: string, _index?: number, fallback?: unknown) => {
    if (name in params) return params[name];
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing parameter: ${name}`);
  };
}

export function executeContext(
  params: IDataObject,
  responses: HttpResponse[],
  options: { continueOnFail?: boolean; items?: number; credentials?: IDataObject } = {}
) {
  const http = httpMock(responses);
  const context = {
    getInputData: () => Array.from({ length: options.items ?? 1 }, () => ({ json: {} })),
    getNodeParameter: vi.fn(parameterGetter(params)),
    getCredentials: vi.fn(async () => options.credentials ?? CREDENTIALS),
    getNode: () => TEST_NODE,
    continueOnFail: () => options.continueOnFail ?? false,
    helpers: { httpRequestWithAuthentication: http },
  };
  return { context: context as unknown as IExecuteFunctions, http };
}

export function loadOptionsContext(current: IDataObject, responses: HttpResponse[]) {
  const http = httpMock(responses);
  const context = {
    getCurrentNodeParameter: (name: string) => current[name],
    getCredentials: async () => CREDENTIALS,
    getNode: () => TEST_NODE,
    helpers: { httpRequestWithAuthentication: http },
  };
  return { context: context as unknown as ILoadOptionsFunctions, http };
}

export function hookContext(
  params: IDataObject,
  responses: HttpResponse[],
  options: { staticData?: IDataObject; webhookUrl?: string; workflowName?: string } = {}
) {
  const http = httpMock(responses);
  const staticData: IDataObject = options.staticData ?? {};
  const context = {
    getNodeParameter: vi.fn(parameterGetter(params)),
    getCredentials: async () => CREDENTIALS,
    getNode: () => TEST_NODE,
    getNodeWebhookUrl: () => options.webhookUrl ?? 'https://n8n.example.com/webhook/abc/webhook',
    getWorkflowStaticData: () => staticData,
    getWorkflow: () => ({
      id: 'wf-1',
      name: options.workflowName ?? 'Bookings to Sheets',
      active: true,
    }),
    helpers: { httpRequestWithAuthentication: http },
  };
  return { context: context as unknown as IHookFunctions, http, staticData };
}

export function webhookContext(options: {
  rawBody?: Buffer;
  headers?: IDataObject;
  staticData?: IDataObject;
}) {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  const body = options.rawBody ? JSON.parse(options.rawBody.toString('utf8')) : {};
  const context = {
    getRequestObject: () => ({ rawBody: options.rawBody, body }),
    getHeaderData: () => options.headers ?? {},
    getWorkflowStaticData: () => options.staticData ?? {},
    getResponseObject: () => response,
    getBodyData: () => body,
    getNode: () => TEST_NODE,
    helpers: {
      returnJsonArray: (data: IDataObject | IDataObject[]) =>
        (Array.isArray(data) ? data : [data]).map((json) => ({ json })),
    },
  };
  return { context: context as unknown as IWebhookFunctions, response };
}
