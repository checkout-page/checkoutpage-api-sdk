import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from './client';
import { createCheckoutPageClient } from './index';

type SpecSchema = { $ref?: string; properties?: Record<string, unknown> };

type SpecParameter = { name: string; in: string; schema?: { enum?: unknown[] } };

type SpecOperation = {
  operationId?: string;
  parameters?: SpecParameter[];
  requestBody?: { content?: { 'application/json'?: { schema?: SpecSchema } } };
};

type SdkMethod = (...args: unknown[]) => Promise<unknown>;

const spec: {
  paths: Record<string, Record<string, SpecOperation>>;
  components: { schemas: Record<string, SpecSchema> };
} = JSON.parse(fs.readFileSync(path.join(__dirname, '../../spec/openapi.json'), 'utf-8'));

// coupons.create reshapes its body by coupon type, so it can't be checked this way.
const COVERED_OPERATIONS = /^(products|(checkout-pages|events)\/order-bumps)\//;

function resolveSchema(schema: SpecSchema | undefined): SpecSchema {
  const ref = schema?.$ref?.replace('#/components/schemas/', '');
  return (ref ? spec.components.schemas[ref] : schema) ?? {};
}

const operations = Object.entries(spec.paths).flatMap(([route, methods]) =>
  Object.values(methods)
    .filter((op) => COVERED_OPERATIONS.test(op.operationId ?? ''))
    .map((op) => ({
      operationId: op.operationId as string,
      pathArgs: (route.match(/:\w+/g) ?? []).map((param) => `${param.slice(1)}_123`),
      bodyProperties: Object.keys(
        resolveSchema(op.requestBody?.content?.['application/json']?.schema).properties ?? {}
      ),
      queryParams: (op.parameters ?? []).filter((p) => p.in === 'query'),
    }))
);

const bodyOperations = operations.filter((op) => op.bodyProperties.length > 0);

// list() query params are covered by list-query-params.test.ts.
const writeQueryOperations = operations.filter(
  (op) => op.queryParams.length > 0 && !op.operationId.endsWith('/list')
);

const camelCase = (segment: string) =>
  segment.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function sdkMethodFor(operationId: string): SdkMethod {
  const segments = operationId.split('/').map(camelCase);
  const verb = segments.pop() as string;
  let resource: unknown = createCheckoutPageClient({ apiKey: 'test_api_key' });
  for (const segment of segments) {
    resource = (resource as Record<string, unknown> | undefined)?.[segment];
  }

  const method = (resource as Record<string, unknown> | undefined)?.[verb];
  if (typeof method !== 'function') {
    throw new Error(
      `No ${verb}() on the SDK client for ${operationId}. Wrap it, or teach this test to resolve it.`
    );
  }

  return (method as SdkMethod).bind(resource);
}

describe('write methods send every request param in the OpenAPI spec', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRequest = () =>
    vi.spyOn(CheckoutPageApiClient.prototype, 'request').mockResolvedValue({ data: {} });

  it('finds the operations in the spec', () => {
    expect(bodyOperations.map((op) => op.operationId)).toEqual(
      expect.arrayContaining([
        'products/create',
        'products/update',
        'checkout-pages/order-bumps/create',
        'events/order-bumps/update',
      ])
    );
    expect(writeQueryOperations.map((op) => op.operationId)).toContain('products/delete');
  });

  it.each(bodyOperations)('$operationId sends every body property', async (op) => {
    const request = mockRequest();
    const params = Object.fromEntries(op.bodyProperties.map((name) => [name, `${name}-value`]));

    await sdkMethodFor(op.operationId)(...op.pathArgs, params);

    expect(request.mock.calls[0][0].body).toStrictEqual(params);
  });

  it.each(bodyOperations)('$operationId sends null and leaves out undefined', async (op) => {
    const request = mockRequest();
    const params = Object.fromEntries(
      op.bodyProperties.map((name, index) => [name, index % 2 === 0 ? null : undefined])
    );

    await sdkMethodFor(op.operationId)(...op.pathArgs, params);

    const sent = JSON.parse(JSON.stringify(request.mock.calls[0][0].body));
    expect(sent).toStrictEqual(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value === null))
    );
  });

  it.each(writeQueryOperations)('$operationId sends every query param', async (op) => {
    const request = mockRequest();
    const params = Object.fromEntries(
      op.queryParams.map((p) => [p.name, p.schema?.enum?.[0] ?? `${p.name}-value`])
    );

    await sdkMethodFor(op.operationId)(...op.pathArgs, params);

    expect(request.mock.calls[0][0].query).toStrictEqual(
      Object.fromEntries(Object.entries(params).map(([name, value]) => [name, String(value)]))
    );
  });
});
