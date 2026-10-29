import {
  declaredBodyPaths,
  findOperation,
  isDeprecatedQueryParameter,
  queryParameters,
  validateQueryValue,
} from './spec';

export interface RequestShape {
  method: string;
  path: string;
  qsKeys: string[];
  bodyKeys: string[];
  staticQs: Record<string, string>;
}

const EXPRESSION = /\{\{.*?\}\}/g;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function bodyPaths(value: unknown, shape: string, paths: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) bodyPaths(item, `${shape}[]`, paths);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childShape = shape ? `${shape}.${key}` : key;
    paths.add(childShape);
    bodyPaths(child, childShape, paths);
  }
}

export function requestShape(communication: Record<string, unknown>): RequestShape {
  const qs = (communication.qs as Record<string, unknown> | undefined) ?? {};
  const bodyKeys = new Set<string>();
  bodyPaths(communication.body, '', bodyKeys);
  return {
    method: String(communication.method ?? 'GET').toUpperCase(),
    path: String(communication.url).replace(EXPRESSION, '__param__'),
    qsKeys: Object.keys(qs),
    bodyKeys: [...bodyKeys],
    staticQs: Object.fromEntries(
      Object.entries(qs)
        .filter(([, value]) => typeof value !== 'object' && !String(value).includes('{{'))
        .map(([key, value]) => [key, String(value)])
    ),
  };
}

export function conformance(shape: RequestShape): string[] {
  const label = `${shape.method} ${shape.path}`;
  const op = findOperation(shape.method, shape.path.replace(/__param__/g, 'x'));
  if (!op) return [`${label}: no spec operation`];

  const problems: string[] = [];
  const declaredQuery = new Set(queryParameters(op).map((p) => p.name));
  for (const key of shape.qsKeys) {
    if (!declaredQuery.has(key)) problems.push(`${label}: query.${key} is not declared`);
    else if (isDeprecatedQueryParameter(op, key))
      problems.push(`${label}: query.${key} is deprecated`);
  }
  for (const [key, value] of Object.entries(shape.staticQs)) {
    if (declaredQuery.has(key))
      problems.push(...validateQueryValue(op, key, value).map((error) => `${label}: ${error}`));
  }

  if (shape.bodyKeys.length && !op.hasBody) {
    problems.push(`${label}: sends a body but the operation takes none`);
  } else if (shape.bodyKeys.length) {
    const declaredBody = new Set(declaredBodyPaths(op));
    for (const key of shape.bodyKeys)
      if (!declaredBody.has(key)) problems.push(`${label}: body.${key} is not declared`);
  }
  return problems;
}
