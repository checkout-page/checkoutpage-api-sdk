#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertV2 } from 'openapi-to-postmanv2';
import type { CollectionResult, Options } from 'openapi-to-postmanv2';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const here = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_DIR = path.resolve(here, '..');
export const SPEC_PATH = path.resolve(PACKAGE_DIR, '../spec/openapi.json');
export const COLLECTION_PATH = path.join(PACKAGE_DIR, 'checkoutpage-api.postman_collection.json');
export const ENVIRONMENT_PATH = path.join(PACKAGE_DIR, 'checkoutpage.postman_environment.json');

export const BASE_URL = 'https://api.checkoutpage.com';
export const COLLECTION_NAME = 'Checkout Page API';
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const REPO_URL = 'https://github.com/checkout-page/checkoutpage-api-sdk';
const DOCS_URL = 'https://checkoutpage.com/docs';
const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

const COLLECTION_DESCRIPTION = `The Checkout Page seller API: checkout pages, events, forms, products, bookings, payments, subscriptions, customers, coupons, webhooks and more.

This collection is generated from the OpenAPI spec in the [Checkout Page developer tools repo](${REPO_URL}/tree/main/postman), so it covers the same API as the SDKs.

## Get an API key

1. Sign in to the [Checkout Page dashboard](https://checkoutpage.com/dashboard).
2. Go to **Settings** > **API keys** and generate a key. Copy it straight away: it is only shown once.
3. Set the \`apiKey\` variable to your key. Use the "Checkout Page" environment from the repo, or set it on your fork of this collection.

Every request sends the key in the \`Authorization\` header. The requests inherit this from the collection, so you only set it once.

## Test mode

A test API key only reads test data, and the records it creates are test records. Use one to try the API without touching live data.

Purchases made while a page is in test mode create test records with \`livemode: false\`, and no real money moves. A live key leaves test records out by default. Add \`livemode=false\` to a list or get request to read them with a live key. Write requests always use the mode of your API key.

## Variables

- \`baseUrl\`: the API host. Defaults to ${BASE_URL}.
- \`apiKey\`: your API key. Keep it in an environment as a secret, and never share it.

## Learn more

- API reference: ${DOCS_URL}
- SDKs, CLI and this collection: ${REPO_URL}
`;

const METHOD_ORDER: Record<string, number> = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };

/** A stable UUID-shaped id, so regenerating never churns ids. */
export function stableId(seed: string): string {
  const hex = createHash('sha1').update(seed).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Obj)
        .sort()
        .map((key) => [key, sortKeysDeep((value as Obj)[key])])
    );
  }
  return value;
}

/** The collection is customer-facing copy, which never uses the em dash. */
export function plainDashes<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\s*—\s*/g, ' - ') as T;
  if (Array.isArray(value)) return value.map(plainDashes) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Obj).map(([key, v]) => [key, plainDashes(v)])
    ) as T;
  }
  return value;
}

export function serialize(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

/** Spec paths use `:param`; Postman uses the same form, so this is also the request's path. */
export function operationKey(method: string, specPath: string): string {
  return `${method.toUpperCase()} ${specPath}`;
}

export interface SpecOperation {
  key: string;
  method: string;
  path: string;
  operation: Obj;
}

export function listOperations(spec: Obj): SpecOperation[] {
  const operations: SpecOperation[] = [];
  for (const [specPath, pathItem] of Object.entries<Obj>(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) {
        operations.push({ key: operationKey(method, specPath), method, path: specPath, operation });
      }
    }
  }
  return operations;
}

/**
 * Builds an example value from a schema: the schema's own `example` first, then enums and
 * defaults, then a typed placeholder. Unlike the converter's faker this is deterministic and
 * local to each schema, so a spec change only changes the requests it touches.
 */
export function exampleFromSchema(spec: Obj, schema: Obj | undefined, seen: string[] = []): Json {
  if (!schema || typeof schema !== 'object') return null;
  if (schema.$ref) {
    const ref: string = schema.$ref;
    if (seen.includes(ref) || seen.length > 12) return {};
    const target = ref
      .replace(/^#\//, '')
      .split('/')
      .reduce<Obj | undefined>(
        (node, part) => node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')],
        spec
      );
    return exampleFromSchema(spec, target, [...seen, ref]);
  }
  if (schema.example !== undefined) return schema.example as Json;
  if (Array.isArray(schema.examples) && schema.examples.length > 0)
    return schema.examples[0] as Json;
  if (schema.const !== undefined) return schema.const as Json;
  if (Array.isArray(schema.enum)) {
    const value = schema.enum.find((option: unknown) => option !== null);
    if (value !== undefined) return value as Json;
  }
  if (schema.default !== undefined) return schema.default as Json;

  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((part: Obj) => exampleFromSchema(spec, part, seen));
    const objects = parts.filter(
      (part: Json) => part !== null && typeof part === 'object' && !Array.isArray(part)
    );
    if (objects.length > 0 && objects.length === parts.length) {
      const merged = Object.assign({}, ...objects);
      return schema.properties
        ? { ...merged, ...(objectExample(spec, schema, seen) as Obj) }
        : merged;
    }
    const last = parts.filter((part: Json) => part !== null).pop();
    if (last !== undefined) return last;
  }
  const choices = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(choices)) {
    const choice = choices.find((option: Obj) => option?.type !== 'null') ?? choices[0];
    return exampleFromSchema(spec, choice, seen);
  }

  const types: string[] = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  const type = types.find((t) => t !== 'null') ?? (schema.properties ? 'object' : types[0]);
  switch (type) {
    case 'object':
      return objectExample(spec, schema, seen);
    case 'array': {
      const item = exampleFromSchema(spec, schema.items, seen);
      return item === null && !schema.items ? [] : [item];
    }
    case 'string':
      return stringExample(schema.format);
    case 'integer':
    case 'number':
      return typeof schema.minimum === 'number' ? schema.minimum : 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    default:
      return schema.properties ? objectExample(spec, schema, seen) : null;
  }
}

function objectExample(spec: Obj, schema: Obj, seen: string[]): Json {
  const result: Record<string, Json> = {};
  for (const [name, property] of Object.entries<Obj>(schema.properties ?? {})) {
    if (property?.readOnly) continue;
    result[name] = exampleFromSchema(spec, property, seen);
  }
  return result;
}

function stringExample(format: string | undefined): string {
  switch (format) {
    case 'date-time':
      return '2026-01-01T00:00:00.000Z';
    case 'date':
      return '2026-01-01';
    case 'email':
      return 'customer@example.com';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'binary':
      return '';
    default:
      return 'string';
  }
}

function parameterValue(spec: Obj, parameter: Obj): string {
  const value =
    parameter.example !== undefined ? parameter.example : exampleFromSchema(spec, parameter.schema);
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function resolve(spec: Obj, node: Obj | undefined): Obj | undefined {
  if (!node?.$ref) return node;
  const target = node.$ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((acc: Obj | undefined, part: string) => acc?.[part], spec);
  return resolve(spec, target);
}

function jsonBody(spec: Obj, content: Obj | undefined): string | undefined {
  const media = content?.['application/json'];
  if (!media) return undefined;
  const value = media.example !== undefined ? media.example : exampleFromSchema(spec, media.schema);
  return JSON.stringify(value, null, 2);
}

function description(text: unknown): Obj | undefined {
  if (typeof text !== 'string' || text.trim() === '') return undefined;
  return { content: text, type: 'text/markdown' };
}

function convert(spec: Obj): Promise<Obj> {
  const options: Options = {
    folderStrategy: 'Tags',
    requestNameSource: 'Fallback',
    parametersResolution: 'Example',
    alwaysInheritAuthentication: true,
    includeAuthInfoInExample: false,
    enableOptionalParameters: false,
  };
  // The converter fakes values with Math.random. Seeding it keeps every leftover faked value
  // stable; the bodies and parameters it fakes are rebuilt from the spec afterwards anyway.
  const require = createRequire(import.meta.url);
  const converterDir = path.dirname(require.resolve('openapi-to-postmanv2/package.json'));
  const faker = require(path.join(converterDir, 'assets/json-schema-faker.js'));
  const originalRandom = Math.random;
  Math.random = seededRandom(20260101);
  faker.option({ random: Math.random });
  return new Promise<Obj>((resolvePromise, reject) => {
    convertV2({ type: 'json', data: spec }, options, (error, result?: CollectionResult) => {
      if (error || !result?.result || !result.output?.[0]) {
        reject(new Error(`Conversion failed: ${error?.message ?? result?.reason ?? 'no output'}`));
        return;
      }
      resolvePromise(result.output[0].data as Obj);
    });
  }).finally(() => {
    Math.random = originalRandom;
    faker.option({ random: originalRandom });
  });
}

/** For the few path params the spec leaves undescribed: `customerId` becomes "The customer ID." */
function pathParameterFallback(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.endsWith(' id') ? `The ${words.slice(0, -3)} ID.` : `The ${words}.`;
}

function requestPath(url: Obj): string {
  return `/${(url.path as string[]).join('/')}`;
}

function rewriteUrl(spec: Obj, url: Obj, operation: Obj): void {
  url.host = ['{{baseUrl}}'];
  delete url.protocol;
  delete url.port;
  const parameters: Obj[] = (operation.parameters ?? []).map((p: Obj) => resolve(spec, p));
  const byName = (location: string, name: string) =>
    parameters.find((p) => p?.in === location && p.name === name);

  if (Array.isArray(url.variable)) {
    url.variable = url.variable.map((variable: Obj) => {
      const parameter = byName('path', variable.key);
      return {
        key: variable.key,
        value: '',
        description: description(
          parameter?.description ??
            resolve(spec, parameter?.schema)?.description ??
            pathParameterFallback(variable.key)
        ),
      };
    });
  }
  if (Array.isArray(url.query)) {
    url.query = url.query.map((query: Obj) => {
      const parameter = byName('query', query.key);
      return {
        key: query.key,
        value: parameter ? parameterValue(spec, parameter) : query.value ?? '',
        ...(query.disabled ? { disabled: true } : {}),
        ...(query.description ? { description: query.description } : {}),
      };
    });
  }
  url.raw = `{{baseUrl}}${requestPath(url)}`;
}

function rewriteBody(spec: Obj, request: Obj, operation: Obj): void {
  const body = request.body;
  if (!body || Object.keys(body).length === 0) {
    delete request.body;
    return;
  }
  const content = resolve(spec, operation.requestBody)?.content;
  if (body.mode === 'raw') {
    const raw = jsonBody(spec, content);
    if (raw !== undefined) body.raw = raw;
  } else if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
    // A literal multipart Content-Type has no boundary, so the upload fails. Postman sets the
    // header with a boundary itself when none is given.
    request.header = (request.header ?? []).filter(
      (header: Obj) => header.key?.toLowerCase() !== 'content-type'
    );
    const schema = resolve(spec, content?.['multipart/form-data']?.schema);
    body.formdata = body.formdata.map((field: Obj) => {
      const property = schema?.properties?.[field.key];
      const isFile = field.type === 'file' || property?.format === 'binary';
      const value = exampleFromSchema(spec, property);
      return {
        key: field.key,
        type: isFile ? 'file' : 'text',
        ...(isFile
          ? { src: [] }
          : { value: typeof value === 'string' ? value : JSON.stringify(value) }),
        ...(description(property?.description)
          ? { description: description(property?.description) }
          : {}),
      };
    });
  }
}

function rewriteRequest(spec: Obj, request: Obj, op: SpecOperation): void {
  delete request.auth;
  delete request.name;
  rewriteUrl(spec, request.url, op.operation);
  rewriteBody(spec, request, op.operation);
  const text = description(op.operation.description ?? op.operation.summary);
  if (text) request.description = text;
  else delete request.description;
}

function rewriteItem(spec: Obj, item: Obj, operations: Map<string, SpecOperation>): Obj {
  const request = item.request;
  const key = operationKey(request.method, requestPath(request.url));
  const op = operations.get(key);
  if (!op) throw new Error(`No spec operation for converted request ${key}`);
  const operationId: string = op.operation.operationId ?? key;

  rewriteRequest(spec, request, op);
  const responses: Obj[] = (item.response ?? []).map((response: Obj, index: number) => {
    if (response.originalRequest) {
      rewriteRequest(spec, response.originalRequest, op);
      // The request body already sits on the request; repeating it on every example
      // response more than doubles the file.
      delete response.originalRequest.body;
      delete response.originalRequest.description;
    }
    const specResponse = resolve(spec, op.operation.responses?.[String(response.code)]);
    const body = jsonBody(spec, specResponse?.content);
    if (body !== undefined) response.body = body;
    return { ...response, id: stableId(`response:${operationId}:${response.code}:${index}`) };
  });

  return {
    id: stableId(`request:${operationId}`),
    name: op.operation.summary ?? operationId,
    request,
    response: responses,
    ...(item.event?.length ? { event: item.event } : {}),
  };
}

function compareItems(a: Obj, b: Obj): number {
  const pathA = requestPath(a.request.url);
  const pathB = requestPath(b.request.url);
  if (pathA !== pathB) return pathA < pathB ? -1 : 1;
  return (METHOD_ORDER[a.request.method] ?? 9) - (METHOD_ORDER[b.request.method] ?? 9);
}

/** Every request in a converted collection, wherever the converter nested it. */
function flattenRequests(items: Obj[]): Obj[] {
  return items.flatMap((item) => (item.request ? [item] : flattenRequests(item.item ?? [])));
}

export async function buildCollection(spec: Obj): Promise<Obj> {
  // Only production goes to the converter, so staging and local servers never reach the output.
  const input = { ...spec, servers: [{ url: BASE_URL, description: 'Production' }] };
  const converted = await convert(input);
  const operations = new Map(listOperations(spec).map((op) => [op.key, op]));
  const tagDescriptions = new Map<string, string>(
    (spec.tags ?? []).map((tag: Obj) => [tag.name, tag.description])
  );

  const folders = new Map<string, Obj[]>();
  for (const item of flattenRequests(converted.item ?? [])) {
    const rewritten = rewriteItem(spec, item, operations);
    const op = operations.get(operationKey(item.request.method, requestPath(item.request.url)));
    const tag: string = op?.operation.tags?.[0] ?? 'Other';
    folders.set(tag, [...(folders.get(tag) ?? []), rewritten]);
  }

  const item = [...folders.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, requests]) => ({
      id: stableId(`folder:${name}`),
      name,
      ...(description(tagDescriptions.get(name))
        ? { description: description(tagDescriptions.get(name)) }
        : {}),
      item: requests.sort(compareItems),
    }));

  return {
    info: {
      _postman_id: stableId('collection:checkoutpage-api'),
      name: COLLECTION_NAME,
      description: { content: COLLECTION_DESCRIPTION, type: 'text/markdown' },
      schema: COLLECTION_SCHEMA,
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
    },
    variable: [
      { key: 'baseUrl', value: BASE_URL, type: 'string' },
      { key: 'apiKey', value: '', type: 'string' },
    ],
    item: plainDashes(item),
  };
}

export function buildEnvironment(): Obj {
  return {
    id: stableId('environment:checkoutpage'),
    name: 'Checkout Page',
    values: [
      { key: 'baseUrl', value: BASE_URL, type: 'default', enabled: true },
      { key: 'apiKey', value: '', type: 'secret', enabled: true },
    ],
    _postman_variable_scope: 'environment',
  };
}

export async function generate(): Promise<{ collection: string; environment: string }> {
  const spec = JSON.parse(await fs.readFile(SPEC_PATH, 'utf-8'));
  return {
    collection: serialize(await buildCollection(spec)),
    environment: serialize(buildEnvironment()),
  };
}

async function main() {
  const { collection, environment } = await generate();
  await fs.writeFile(COLLECTION_PATH, collection, 'utf-8');
  await fs.writeFile(ENVIRONMENT_PATH, environment, 'utf-8');
  const count = JSON.parse(collection).item.reduce((n: number, f: Obj) => n + f.item.length, 0);
  console.log(`Wrote ${path.relative(process.cwd(), COLLECTION_PATH)} (${count} requests)`);
  console.log(`Wrote ${path.relative(process.cwd(), ENVIRONMENT_PATH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
