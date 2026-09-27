import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from './client';
import { createCheckoutPageClient } from './index';

type SpecParameter = {
  name: string;
  in: string;
  schema?: { type?: string; enum?: unknown[] };
};

type SpecOperation = { operationId?: string; parameters?: SpecParameter[] };

type ListResource = { list: (args: Record<string, unknown>) => Promise<unknown> };

const spec: { paths: Record<string, Record<string, SpecOperation>> } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../spec/openapi.json'), 'utf-8')
);

const listOperations = Object.values(spec.paths)
  .map((methods) => methods.get)
  .filter((op): op is SpecOperation => Boolean(op?.operationId?.endsWith('/list')))
  .map((op) => ({
    operationId: op.operationId as string,
    queryParams: (op.parameters ?? []).filter((p) => p.in === 'query'),
  }))
  .filter(({ queryParams }) => queryParams.length > 0);

function sampleValue(param: SpecParameter): unknown {
  if (param.schema?.enum?.length) return param.schema.enum[0];
  if (param.schema?.type === 'boolean') return true;
  if (param.schema?.type === 'integer' || param.schema?.type === 'number') return 10;
  return `${param.name}-value`;
}

function listResourceFor(operationId: string): ListResource {
  const sdk = createCheckoutPageClient({ apiKey: 'test_api_key' });
  const segments = operationId.split('/');
  const key = segments[0].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const resource = (sdk as unknown as Record<string, ListResource | undefined>)[key];

  if (segments.length !== 2 || typeof resource?.list !== 'function') {
    throw new Error(
      `No list() on the SDK client for ${operationId}. Wrap it, or teach this test to resolve it.`
    );
  }

  return resource;
}

describe('list() query params match the OpenAPI spec', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds the list operations in the spec', () => {
    expect(listOperations.map((op) => op.operationId)).toContain('payments/list');
  });

  it.each(listOperations)('$operationId forwards every spec query param', async (op) => {
    const request = vi
      .spyOn(CheckoutPageApiClient.prototype, 'request')
      .mockResolvedValue({ data: [], total: 0, has_more: false });
    const args = Object.fromEntries(op.queryParams.map((p) => [p.name, sampleValue(p)]));

    await listResourceFor(op.operationId).list(args);

    const expectedQuery = Object.fromEntries(
      Object.entries(args).map(([name, value]) => [name, String(value)])
    );
    expect(request.mock.calls[0][0].query).toStrictEqual(expectedQuery);
  });
});
