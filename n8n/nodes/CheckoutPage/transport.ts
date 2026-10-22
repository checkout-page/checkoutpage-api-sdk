import {
  NodeApiError,
  type IDataObject,
  type IExecuteFunctions,
  type IHookFunctions,
  type IHttpRequestMethods,
  type IHttpRequestOptions,
  type ILoadOptionsFunctions,
  type INode,
  type JsonObject,
} from 'n8n-workflow';

export const CREDENTIAL_NAME = 'checkoutPageApi';
export const DEFAULT_BASE_URL = 'https://api.checkoutpage.com';
export const MAX_PAGE_SIZE = 100;

type RequestContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

export interface ListResponse {
  data: IDataObject[];
  has_more?: boolean;
  total?: number;
}

function firstObject(...candidates: unknown[]): IDataObject | undefined {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as IDataObject;
    }
    if (typeof candidate === 'string') {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed as IDataObject;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

export function getHttpStatus(error: unknown): number | undefined {
  const e = error as IDataObject & {
    response?: { status?: number; statusCode?: number };
    cause?: { response?: { status?: number }; status?: number };
  };
  const raw =
    e?.httpCode ??
    e?.statusCode ??
    e?.status ??
    e?.response?.status ??
    e?.response?.statusCode ??
    e?.cause?.response?.status ??
    e?.cause?.status;
  const status = Number(raw);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}

export function getApiErrorBody(error: unknown): IDataObject | undefined {
  const e = error as IDataObject & {
    context?: { data?: unknown };
    response?: { data?: unknown; body?: unknown };
    cause?: { response?: { data?: unknown; body?: unknown } };
  };
  return firstObject(
    e?.context?.data,
    e?.response?.data,
    e?.response?.body,
    e?.cause?.response?.data,
    e?.cause?.response?.body,
    e?.error
  );
}

export function toNodeApiError(node: INode, error: unknown, itemIndex?: number): NodeApiError {
  const body = getApiErrorBody(error);
  const status = getHttpStatus(error);
  const apiMessage = typeof body?.message === 'string' ? body.message : undefined;
  const details = Array.isArray(body?.errors)
    ? (body.errors as IDataObject[])
        .map((detail) => [detail.param, detail.message].filter(Boolean).join(': '))
        .filter(Boolean)
        .join('; ')
    : undefined;

  const source: JsonObject = body
    ? (body as JsonObject)
    : { message: (error as Error)?.message ?? 'Unknown error' };

  const apiError = new NodeApiError(node, source, {
    message: apiMessage ?? (error as Error)?.message,
    description: details || undefined,
    httpCode: status ? String(status) : undefined,
    itemIndex,
  });
  if (body) apiError.context.data = body;
  return apiError;
}

export async function getBaseUrl(this: RequestContext): Promise<string> {
  const credentials = await this.getCredentials(CREDENTIAL_NAME);
  const baseUrl = typeof credentials.baseUrl === 'string' ? credentials.baseUrl.trim() : '';
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export async function apiRequest(
  this: RequestContext,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject
): Promise<IDataObject> {
  const options: IHttpRequestOptions = {
    method,
    url: `${await getBaseUrl.call(this)}${path}`,
    json: true,
  };
  if (qs && Object.keys(qs).length) options.qs = qs;
  if (body && Object.keys(body).length) options.body = body;

  try {
    return (await this.helpers.httpRequestWithAuthentication.call(
      this,
      CREDENTIAL_NAME,
      options
    )) as IDataObject;
  } catch (error) {
    throw toNodeApiError(this.getNode(), error);
  }
}

/**
 * Lists a collection. The API pages with Stripe-style cursors: `has_more` plus
 * `starting_after` set to the last id of the previous page.
 */
export async function apiRequestList(
  this: RequestContext,
  path: string,
  qs: IDataObject,
  returnAll: boolean,
  limit = 50
): Promise<IDataObject[]> {
  if (!returnAll) {
    const response = (await apiRequest.call(this, 'GET', path, undefined, {
      ...qs,
      limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
    })) as unknown as ListResponse;
    return (response.data ?? []).slice(0, limit);
  }

  const results: IDataObject[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const pageQs: IDataObject = { ...qs, limit: MAX_PAGE_SIZE };
    if (startingAfter) pageQs.starting_after = startingAfter;
    const response = (await apiRequest.call(
      this,
      'GET',
      path,
      undefined,
      pageQs
    )) as unknown as ListResponse;
    const page = response.data ?? [];
    results.push(...page);
    const lastId = page.length ? page[page.length - 1].id : undefined;
    if (!response.has_more || typeof lastId !== 'string' || lastId === startingAfter) break;
    startingAfter = lastId;
  }
  return results;
}
