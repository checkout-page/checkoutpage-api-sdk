import { findOperation, spec } from '../test/spec';
import type { DataSource, Target } from './interfaces.config';

export interface Schema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  example?: unknown;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
  deprecated?: boolean;
  nullable?: boolean;
  [keyword: string]: unknown;
}

export type MakeType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'url'
  | 'collection'
  | 'array';

export interface MakeItem {
  type: MakeType;
  spec?: MakeField[] | MakeItem;
}

export interface MakeField extends MakeItem {
  name: string;
  label: string;
}

const SAMPLE_DATE = '2026-01-01T12:00:00.000Z';
const UPPER_CASE_WORDS: Record<string, string> = { id: 'ID', url: 'URL', sku: 'SKU' };

function at(pointer: string): unknown {
  return pointer
    .replace(/^#\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], spec);
}

function deref(schema: unknown): Schema {
  let current = schema as Schema | undefined;
  while (current && typeof current.$ref === 'string') current = at(current.$ref) as Schema;
  return current ?? {};
}

const isNullSchema = (schema: Schema) => schema.type === 'null';
const isObjectSchema = (schema: Schema) =>
  schema.type === 'object' || schema.properties !== undefined;

function withoutNull(schema: Schema): Schema {
  const result = { ...schema };
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((type) => type !== 'null');
    if (types.length < schema.type.length) result.nullable = true;
    result.type = types.length === 1 ? types[0] : types.length ? 'string' : undefined;
  }
  if (schema.enum?.includes(null)) {
    result.enum = schema.enum.filter((value) => value !== null);
    result.nullable = true;
  }
  return result;
}

function merge(branches: Schema[], requiredIn: 'any' | 'every'): Schema {
  const merged: Schema = {};
  for (const { properties, required: _required, ...keywords } of branches) {
    Object.assign(merged, keywords);
    if (properties) merged.properties = { ...merged.properties, ...properties };
  }
  const requiredLists = branches.map((branch) => branch.required ?? []);
  const required =
    requiredIn === 'any'
      ? [...new Set(requiredLists.flat())]
      : requiredLists[0].filter((name) => requiredLists.every((list) => list.includes(name)));
  if (required.length) merged.required = required;
  else delete merged.required;
  merged.nullable = branches.every((branch) => branch.nullable === true) || undefined;
  if (merged.properties && merged.type === undefined) merged.type = 'object';
  return merged;
}

// A union of objects becomes one collection offering every variant's fields; a union of
// scalars of different types becomes text, since a Make field holds one type.
function mergeUnion(branches: Schema[]): Schema {
  const nullable = branches.some(isNullSchema);
  const present = branches.filter((branch) => !isNullSchema(branch));
  let merged: Schema;
  if (present.length <= 1) merged = { ...present[0] };
  else if (present.every(isObjectSchema)) merged = merge(present, 'every');
  else {
    const types = [...new Set(present.map((branch) => branch.type))];
    merged = { type: types.length === 1 ? types[0] : 'string' };
    if (present.every((branch) => branch.enum))
      merged.enum = [...new Set(present.flatMap((branch) => branch.enum))];
  }
  if (nullable) merged.nullable = true;
  return merged;
}

export function resolveSchema(schema: unknown): Schema {
  const { allOf, anyOf, oneOf, ...rest } = deref(schema);
  let resolved = withoutNull(rest);
  if (Array.isArray(allOf)) resolved = merge([...allOf.map(resolveSchema), resolved], 'any');
  const union = anyOf ?? oneOf;
  if (Array.isArray(union)) {
    const merged = mergeUnion(union.map(resolveSchema));
    resolved = { ...merged, ...resolved, nullable: merged.nullable || resolved.nullable };
  }
  if (!resolved.nullable) delete resolved.nullable;
  return resolved;
}

export function responseDataSchema(
  method: string,
  path: string,
  opts: { items?: boolean } = {}
): Schema {
  const where = `${method.toUpperCase()} ${path}`;
  const op = findOperation(method.toUpperCase(), path);
  if (!op) throw new Error(`No spec operation for ${where}`);
  const responses = spec.paths[op.path][op.method.toLowerCase()].responses as Record<
    string,
    unknown
  >;
  const content = deref(responses['200'] ?? responses['201']).content as
    | Record<string, { schema?: unknown }>
    | undefined;
  const data = resolveSchema(content?.['application/json']?.schema).properties?.data;
  if (!data) throw new Error(`${where} has no data in its response`);
  const resolved = resolveSchema(data);
  if (!opts.items) return resolved;
  if (!resolved.items) throw new Error(`${where} does not return a list`);
  return resolveSchema(resolved.items);
}

function liveProperties(schema: Schema): [string, Schema][] {
  return Object.entries(schema.properties ?? {})
    .map(([name, property]): [string, Schema] => [name, resolveSchema(property)])
    .filter(([, property]) => !property.deprecated);
}

export function schemaPropertyNames(schema: Schema, depth = 2): string[] {
  return liveProperties(resolveSchema(schema)).flatMap(([name, property]) => [
    name,
    ...(depth > 1 && property.properties
      ? schemaPropertyNames(property, depth - 1).map((child) => `${name}.${child}`)
      : []),
  ]);
}

export function camelCaseToSentence(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .map(
      (word, index) =>
        UPPER_CASE_WORDS[word] ?? (index === 0 ? word[0].toUpperCase() + word.slice(1) : word)
    )
    .join(' ');
}

function makeType(schema: Schema): MakeType {
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return 'date';
      if (schema.format === 'email') return 'email';
      if (schema.format === 'uri') return 'url';
      return 'text';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'collection';
    case 'array':
      return 'array';
    default:
      if (schema.properties) return 'collection';
      if (schema.items) return 'array';
      return 'text';
  }
}

interface FieldOptions {
  exclude: string[];
  labels: Record<string, string>;
  labeled: Set<string>;
}

function makeSpec(
  schema: Schema,
  type: MakeType,
  opts: FieldOptions,
  path: string
): MakeItem['spec'] {
  if (type === 'collection' && schema.properties) return makeFields(schema, opts, path);
  if (type === 'array' && schema.items) return makeItem(resolveSchema(schema.items), opts, path);
  return undefined;
}

function makeItem(schema: Schema, opts: FieldOptions, path: string): MakeItem | MakeField[] {
  const type = makeType(schema);
  const spec = makeSpec(schema, type, opts, path);
  if (type === 'collection' && Array.isArray(spec)) return spec;
  return spec ? { type, spec } : { type };
}

function makeFields(schema: Schema, opts: FieldOptions, prefix: string): MakeField[] {
  return liveProperties(schema).flatMap(([name, property]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    if (opts.exclude.includes(path)) return [];
    const type = makeType(property);
    const spec = makeSpec(property, type, opts, path);
    const overridden = Object.hasOwn(opts.labels, path);
    if (overridden) opts.labeled.add(path);
    const label = overridden ? opts.labels[path] : camelCaseToSentence(name);
    return [{ name, type, label, ...(spec ? { spec } : {}) }];
  });
}

export function toMakeInterface(
  schema: Schema,
  opts: { exclude?: string[]; labels?: Record<string, string> } = {}
): MakeField[] {
  const labels = opts.labels ?? {};
  const options: FieldOptions = { exclude: opts.exclude ?? [], labels, labeled: new Set() };
  const fields = makeFields(resolveSchema(schema), options, '');
  const unused = Object.keys(labels).filter((path) => !options.labeled.has(path));
  if (unused.length) throw new Error(`No field to label at ${unused.join(', ')}`);
  return fields;
}

// Paths follow the interface: an array's items share the array's path.
function withoutExcluded(value: unknown, exclude: string[], prefix: string): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutExcluded(item, exclude, prefix));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, child]) => {
      const path = prefix ? `${prefix}.${name}` : name;
      return exclude.includes(path) ? [] : [[name, withoutExcluded(child, exclude, path)]];
    })
  );
}

function sampleOf(schema: Schema, exclude: string[], prefix: string): unknown {
  if (schema.example !== undefined) return withoutExcluded(schema.example, exclude, prefix);
  if (schema.enum?.length) return schema.enum[0];
  switch (makeType(schema)) {
    case 'date':
      return SAMPLE_DATE;
    case 'email':
      return 'customer@example.com';
    case 'url':
      return 'https://example.com';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'collection': {
      const required = schema.required ?? [];
      return Object.fromEntries(
        liveProperties(schema).flatMap(([name, property]) => {
          const path = prefix ? `${prefix}.${name}` : name;
          if (exclude.includes(path)) return [];
          const optionalNull = !required.includes(name) && property.nullable;
          return [[name, optionalNull ? null : sampleOf(property, exclude, path)]];
        })
      );
    }
    default:
      return 'text';
  }
}

export function toMakeSample(schema: Schema, opts: { exclude?: string[] } = {}): unknown {
  return sampleOf(resolveSchema(schema), opts.exclude ?? [], '');
}

const snakeCase = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

function targetSchema(target: Target): Schema {
  if (!target.wrap) return responseDataSchema(target.method, target.path, { items: target.items });
  const { key, recoveryUrl } = target.wrap;
  const sources: DataSource[] =
    target.wrap.data ??
    (key ? [{ key, method: target.method, path: target.path, items: target.items }] : []);
  if (!sources.length) throw new Error(`${target.module} wraps no data: set wrap.key or wrap.data`);
  const data = Object.fromEntries(
    sources.map((source) => [
      source.key,
      responseDataSchema(source.method, source.path, { items: source.items }),
    ])
  );
  return {
    type: 'object',
    required: ['event', 'eventId', 'timestamp', 'sellerId', ...Object.keys(data)],
    properties: {
      event: { type: 'string', example: `${snakeCase(sources[0].key)}.created` },
      eventId: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      sellerId: { type: 'string' },
      ...data,
      ...(recoveryUrl ? { recoveryUrl: { type: ['string', 'null'], format: 'uri' } } : {}),
    },
  };
}

export const moduleInterface = (target: Target) =>
  toMakeInterface(targetSchema(target), { exclude: target.exclude, labels: target.labels });
export const moduleSample = (target: Target) =>
  toMakeSample(targetSchema(target), { exclude: target.exclude });
