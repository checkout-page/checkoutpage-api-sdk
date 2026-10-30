import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ComponentType = 'connection' | 'webhook' | 'module' | 'rpc' | 'function';

export type CodeFiles = Record<string, unknown>;

export interface Component {
  id: string;
  type: ComponentType;
  meta: Record<string, unknown>;
  files: Record<string, string>;
  code: CodeFiles;
}

export interface Makecomapp {
  fileVersion: number;
  generalCodeFiles: Record<string, string>;
  components: Record<ComponentType, Record<string, { codeFiles?: Record<string, string> }>>;
  origins: unknown[];
}

const COMPONENT_TYPES: ComponentType[] = ['connection', 'webhook', 'module', 'rpc', 'function'];

// Make's VS Code extension writes comments into IML files; "https://" inside a string must survive.
function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      out += text.slice(start, ++i);
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

export function readIml(path: string): unknown {
  return JSON.parse(stripComments(readFileSync(path, 'utf8')));
}

export function loadApp() {
  const root = join(__dirname, '..', 'app');
  const makecomapp = readIml(join(root, 'makecomapp.json')) as Makecomapp;
  const general = (key: string) => readIml(join(root, makecomapp.generalCodeFiles[key]));

  const components: Component[] = COMPONENT_TYPES.flatMap((type) =>
    Object.entries(makecomapp.components[type] ?? {}).map(([id, { codeFiles = {}, ...meta }]) => ({
      id,
      type,
      meta,
      files: codeFiles,
      code: Object.fromEntries(
        Object.entries(codeFiles)
          .filter(([, path]) => path.endsWith('.json'))
          .map(([key, path]) => [key, readIml(join(root, path))])
      ),
    }))
  );

  const byType = (type: ComponentType) => components.filter((c) => c.type === type);
  const get = (type: ComponentType, id: string): Component => {
    const component = components.find((c) => c.type === type && c.id === id);
    if (!component) throw new Error(`No ${type} ${id} in makecomapp.json`);
    return component;
  };

  return {
    root,
    makecomapp,
    base: general('base') as Record<string, unknown>,
    groups: general('groups') as { label: string; modules: string[] }[],
    components,
    byType,
    get,
  };
}
