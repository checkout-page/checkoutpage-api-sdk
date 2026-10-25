import { readFileSync } from 'node:fs';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

type Schema = Record<string, unknown>;

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: Schema;
  pointer: string;
}

export interface SpecOperation {
  key: string;
  method: string;
  path: string;
  pointer: string;
  parameters: Parameter[];
  hasBody: boolean;
}

const SPEC_ID = 'https://checkoutpage.test/openapi.json';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export const spec = JSON.parse(
  readFileSync(new URL('../../spec/openapi.json', import.meta.url), 'utf8')
) as Schema & { paths: Record<string, Record<string, Schema>> };

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, SPEC_ID);

// Everything in a query string is text on the wire, so coerce it the way the API's parser does
// before checking types.
const queryAjv = new Ajv2020({ strict: false, allErrors: true, coerceTypes: true });
addFormats(queryAjv);
queryAjv.addSchema(spec, SPEC_ID);

const escapePointer = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

function at(pointer: string): unknown {
  return pointer
    .replace(/^#\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((node, key) => (node as Schema | undefined)?.[key], spec);
}

function deref(schema: unknown): Schema {
  let current = schema as Schema;
  while (current && typeof current.$ref === 'string') current = at(current.$ref) as Schema;
  return current ?? {};
}

function pathRegex(template: string): RegExp {
  const pattern = template
    .split('/')
    .map((segment) =>
      /^:/.test(segment) || /^\{.+\}$/.test(segment)
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('/');
  return new RegExp(`^${pattern}$`);
}

export const operations: SpecOperation[] = Object.entries(spec.paths).flatMap(([path, item]) =>
  HTTP_METHODS.filter((method) => item[method]).map((method) => {
    const pathPointer = `#/paths/${escapePointer(path)}`;
    const pointer = `${pathPointer}/${method}`;
    const operation = item[method];
    const parametersAt = (list: unknown, base: string): Parameter[] =>
      ((list as Schema[] | undefined) ?? []).map((raw, index) => ({
        ...(deref(raw) as unknown as Parameter),
        pointer: typeof raw.$ref === 'string' ? raw.$ref : `${base}/parameters/${index}`,
      }));
    return {
      key: `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase(),
      path,
      pointer,
      parameters: [
        ...parametersAt(item.parameters, pathPointer),
        ...parametersAt(operation.parameters, pointer),
      ],
      hasBody: Boolean(operation.requestBody),
    };
  })
);

export function findOperation(method: string, path: string): SpecOperation | undefined {
  return operations.find((op) => op.method === method && pathRegex(op.path).test(path));
}

export function queryParameters(op: SpecOperation): Parameter[] {
  return op.parameters.filter((parameter) => parameter.in === 'query');
}

const validators = new Map<string, ValidateFunction>();

function compiled(instance: Ajv2020, key: string, schema: Schema): ValidateFunction {
  const cached = validators.get(key);
  if (cached) return cached;
  const validate = instance.compile(schema);
  validators.set(key, validate);
  return validate;
}

const describeError = (error: ErrorObject, root: string) =>
  `${root}${error.instancePath} ${error.message}${
    error.params && Object.keys(error.params).length ? ` ${JSON.stringify(error.params)}` : ''
  }`;

export function bodySchemaPointer(op: SpecOperation): string {
  return `${op.pointer}/requestBody/content/application~1json/schema`;
}

export function validateBody(op: SpecOperation, body: unknown): string[] {
  const pointer = bodySchemaPointer(op);
  const validate = compiled(ajv, pointer, { $ref: `${SPEC_ID}${pointer}` });
  if (validate(body)) return [];
  return (validate.errors ?? []).map((error) => describeError(error, 'body'));
}

export function validateQueryValue(op: SpecOperation, name: string, value: unknown): string[] {
  const parameter = queryParameters(op).find((p) => p.name === name);
  if (!parameter) return [`query.${name} is not a query parameter`];
  const validate = compiled(queryAjv, `query:${parameter.pointer}`, {
    type: 'object',
    properties: { [name]: { $ref: `${SPEC_ID}${parameter.pointer}/schema` } },
  });
  if (validate({ [name]: String(value) })) return [];
  return (validate.errors ?? []).map((error) => describeError(error, 'query'));
}

function expand(schema: unknown, seen = new Set<unknown>()): Schema[] {
  const resolved = deref(schema);
  if (seen.has(resolved)) return [];
  seen.add(resolved);
  const branches = ['allOf', 'anyOf', 'oneOf'].flatMap(
    (keyword) => (resolved[keyword] as unknown[] | undefined) ?? []
  );
  return [resolved, ...branches.flatMap((branch) => expand(branch, seen))];
}

function isPlainObject(value: unknown): value is Schema {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

interface Walk {
  unknown: string[];
  sent: Set<string>;
}

/**
 * ajv only rejects extra keys where the spec sets `additionalProperties: false`, which many
 * request bodies leave out. This walks the body against the schema and reports every key no
 * branch declares, so a typo or a renamed field fails even where the API would silently drop it.
 */
function walk(schemas: Schema[], data: unknown, path: string, shape: string, result: Walk) {
  const expanded = schemas.flatMap((schema) => expand(schema));
  if (Array.isArray(data)) {
    const items = expanded.map((schema) => schema.items).filter(Boolean) as Schema[];
    data.forEach((item, index) => walk(items, item, `${path}/${index}`, `${shape}[]`, result));
    return;
  }
  if (!isPlainObject(data)) return;

  const declaresShape = expanded.some(
    (schema) =>
      isPlainObject(schema.properties) ||
      schema.additionalProperties !== undefined ||
      isPlainObject(schema.patternProperties)
  );
  for (const [key, value] of Object.entries(data)) {
    const named = expanded
      .map((schema) => (schema.properties as Schema | undefined)?.[key])
      .filter(Boolean) as Schema[];
    const mapped = expanded
      .map((schema) => schema.additionalProperties)
      .filter((extra) => isPlainObject(extra)) as Schema[];
    const patterned = expanded.flatMap((schema) =>
      Object.entries((schema.patternProperties as Schema | undefined) ?? {})
        .filter(([pattern]) => new RegExp(pattern).test(key))
        .map(([, sub]) => sub as Schema)
    );
    const childPath = `${path}/${key}`;
    if (named.length) {
      const childShape = shape ? `${shape}.${key}` : key;
      result.sent.add(childShape);
      walk(named, value, childPath, childShape, result);
    } else if (mapped.length || patterned.length) {
      const childShape = shape ? `${shape}.*` : '*';
      result.sent.add(childShape);
      walk([...mapped, ...patterned], value, childPath, childShape, result);
    } else if (declaresShape && !expanded.some((schema) => schema.additionalProperties === true)) {
      result.unknown.push(childPath);
    }
  }
}

export function checkBodyKeys(
  op: SpecOperation,
  body: unknown
): { unknown: string[]; sent: string[] } {
  const result: Walk = { unknown: [], sent: new Set() };
  walk([{ $ref: bodySchemaPointer(op) }], body, '', '', result);
  return { unknown: result.unknown, sent: [...result.sent] };
}

export function declaredBodyPaths(op: SpecOperation): string[] {
  const paths = new Set<string>();
  const visit = (schemas: Schema[], shape: string, depth: number) => {
    if (depth > 6) return;
    const expanded = schemas.flatMap((schema) => expand(schema));
    const items = expanded.map((schema) => schema.items).filter(Boolean) as Schema[];
    if (items.length) visit(items, `${shape}[]`, depth + 1);
    const names = new Set(
      expanded.flatMap((schema) => Object.keys((schema.properties as Schema | undefined) ?? {}))
    );
    for (const name of names) {
      const childShape = shape ? `${shape}.${name}` : name;
      paths.add(childShape);
      const named = expanded
        .map((schema) => (schema.properties as Schema | undefined)?.[name])
        .filter(Boolean) as Schema[];
      visit(named, childShape, depth + 1);
    }
    const mapped = expanded
      .map((schema) => schema.additionalProperties)
      .filter((extra) => isPlainObject(extra)) as Schema[];
    if (mapped.length) {
      const childShape = shape ? `${shape}.*` : '*';
      paths.add(childShape);
      visit(mapped, childShape, depth + 1);
    }
  };
  visit([{ $ref: bodySchemaPointer(op) }], '', 0);
  return [...paths].sort();
}
