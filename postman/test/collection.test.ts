import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASE_URL,
  COLLECTION_PATH,
  ENVIRONMENT_PATH,
  SPEC_PATH,
  exampleFromSchema,
  generate,
  listOperations,
  operationKey,
  plainDashes,
  stableId,
} from '../src/generate';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const spec: Obj = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));
const collectionText = fs.readFileSync(COLLECTION_PATH, 'utf-8');
const environmentText = fs.readFileSync(ENVIRONMENT_PATH, 'utf-8');
const collection: Obj = JSON.parse(collectionText);
const environment: Obj = JSON.parse(environmentText);

const requests: Obj[] = collection.item.flatMap((folder: Obj) => folder.item);
const requestKey = (item: Obj) =>
  operationKey(item.request.method, `/${item.request.url.path.join('/')}`);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      out.push(key);
      strings(v, out);
    }
  }
  return out;
}

function allRequestObjects(): Obj[] {
  return requests.flatMap((item) => [
    item.request,
    ...item.response.map((response: Obj) => response.originalRequest).filter(Boolean),
  ]);
}

describe('Postman collection', () => {
  it('has every spec operation exactly once', () => {
    const specKeys = listOperations(spec)
      .map((op) => op.key)
      .sort();
    const collectionKeys = requests.map(requestKey).sort();
    expect(collectionKeys).toEqual(specKeys);
    expect(new Set(collectionKeys).size).toBe(collectionKeys.length);
  });

  it('names requests after the operation summaries and files them under their tag', () => {
    const operations = new Map(listOperations(spec).map((op) => [op.key, op.operation]));
    for (const folder of collection.item) {
      for (const item of folder.item) {
        const operation = operations.get(requestKey(item))!;
        expect(item.name).toBe(plainDashes(operation.summary));
        expect(folder.name).toBe(operation.tags[0]);
        expect(item.request.description?.content).toBe(
          plainDashes(operation.description ?? operation.summary)
        );
      }
    }
  });

  it('derives ids from the operationId', () => {
    const operations = new Map(listOperations(spec).map((op) => [op.key, op.operation]));
    for (const item of requests) {
      expect(item.id).toBe(stableId(`request:${operations.get(requestKey(item))!.operationId}`));
    }
    const ids = strings(collection).filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-5/.test(s));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses collection-level bearer auth with {{apiKey}} that every request inherits', () => {
    expect(collection.auth).toEqual({
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
    });
    for (const request of allRequestObjects()) {
      expect(request.auth).toBeUndefined();
      const headers: Obj[] = request.header ?? [];
      expect(headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(false);
      expect(request.url.query?.some((q: Obj) => /api.?key|token/i.test(q.key)) ?? false).toBe(
        false
      );
    }
  });

  it('uses the {{baseUrl}} variable for every request', () => {
    expect(collection.variable).toContainEqual({ key: 'baseUrl', value: BASE_URL, type: 'string' });
    for (const request of allRequestObjects()) {
      expect(request.url.host).toEqual(['{{baseUrl}}']);
      expect(request.url.raw.startsWith('{{baseUrl}}/v1/')).toBe(true);
      expect(request.url.protocol).toBeUndefined();
    }
  });

  it('turns path params into described Postman path variables', () => {
    const operations = new Map(listOperations(spec).map((op) => [op.key, op.operation]));
    for (const item of requests) {
      const pathParams: Obj[] = (operations.get(requestKey(item))!.parameters ?? []).filter(
        (p: Obj) => p.in === 'path'
      );
      const variables: Obj[] = item.request.url.variable ?? [];
      expect(variables.map((v) => v.key).sort()).toEqual(pathParams.map((p) => p.name).sort());
      for (const variable of variables) {
        expect(item.request.url.path).toContain(`:${variable.key}`);
        expect(variable.value).toBe('');
        expect(variable.description?.content).toMatch(/\w{3,}/);
        expect(variable.description.content).not.toMatch(/^\(Required\)\s*$/);
      }
    }
  });

  it('includes an example body for every JSON request body in the spec', () => {
    const operations = new Map(listOperations(spec).map((op) => [op.key, op.operation]));
    for (const item of requests) {
      const content = operations.get(requestKey(item))!.requestBody?.content ?? {};
      if (content['application/json']) {
        expect(item.request.body.mode).toBe('raw');
        expect(() => JSON.parse(item.request.body.raw)).not.toThrow();
      } else if (content['multipart/form-data']) {
        expect(item.request.body.mode).toBe('formdata');
        expect(item.request.header.some((h: Obj) => h.key === 'Content-Type')).toBe(false);
      } else {
        expect(item.request.body).toBeUndefined();
      }
    }
  });

  it('explains how to get an API key, test mode and where the docs are', () => {
    const description: string = collection.info.description.content;
    expect(description).toMatch(/API keys/);
    expect(description).toMatch(/[Tt]est mode/);
    expect(description).toContain('https://checkoutpage.com/docs');
    expect(description).toContain('https://github.com/checkout-page/checkoutpage-api-sdk');
    expect(description).not.toContain('—');
  });

  it('ships an environment with baseUrl and an empty secret apiKey', () => {
    expect(environment.values).toEqual([
      { key: 'baseUrl', value: BASE_URL, type: 'default', enabled: true },
      { key: 'apiKey', value: '', type: 'secret', enabled: true },
    ]);
    expect(collection.variable.find((v: Obj) => v.key === 'apiKey').value).toBe('');
  });

  describe.each([
    ['collection', collection],
    ['environment', environment],
  ])('the %s file', (_name, file) => {
    const values = strings(file);

    it('holds no API keys or secrets', () => {
      for (const pattern of [/sk_live_/i, /sk_test_/i, /whsec/i, /pk_(live|test)_/i]) {
        expect(values.filter((s) => pattern.test(s))).toEqual([]);
      }
    });

    it('holds no bearer literals other than the variable', () => {
      // The spec's webhook example shows a header for the seller's own receiver, not a key.
      const allowed = new Set(['Bearer my-receiver-token']);
      const literals = values
        .flatMap((s) => s.match(/Bearer\s+[^\s"'`.,)]+/gi) ?? [])
        .filter((match) => !/^Bearer\s+\{\{\w+\}\}$/.test(match) && !allowed.has(match));
      expect(literals).toEqual([]);
    });

    it('has no em dashes', () => {
      expect(values.filter((s) => s.includes('—'))).toEqual([]);
    });

    it('points at no internal hosts', () => {
      for (const pattern of [
        /localhost/i,
        /127\.0\.0\.1/,
        /checkoutpage\.dev/i,
        /staging/i,
        /onrender\.com/i,
      ]) {
        expect(values.filter((s) => pattern.test(s))).toEqual([]);
      }
    });
  });

  it('matches a fresh generation (run `pnpm generate:postman` if this fails)', async () => {
    const fresh = await generate();
    expect(fresh.collection === collectionText).toBe(true);
    expect(fresh.environment === environmentText).toBe(true);
  });
});

describe('exampleFromSchema', () => {
  it('prefers the schema example, then enum, then a typed placeholder', () => {
    expect(exampleFromSchema(spec, { type: 'string', example: 'hi' })).toBe('hi');
    expect(exampleFromSchema(spec, { type: ['string', 'null'], enum: [null, 'a'] })).toBe('a');
    expect(
      exampleFromSchema(spec, {
        type: 'object',
        properties: { n: { type: 'integer' }, tags: { type: 'array', items: { type: 'boolean' } } },
      })
    ).toEqual({ n: 0, tags: [false] });
  });

  it('stops on recursive refs', () => {
    const recursive = {
      components: {
        schemas: {
          Node: { type: 'object', properties: { child: { $ref: '#/components/schemas/Node' } } },
        },
      },
    };
    expect(exampleFromSchema(recursive, { $ref: '#/components/schemas/Node' })).toEqual({
      child: {},
    });
  });
});
