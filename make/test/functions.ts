import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { loadApp } from './app';

let context: vm.Context | undefined;

// Make runs every IML function in one scope, so they can call each other.
function appContext(): vm.Context {
  if (context) return context;
  const app = loadApp();
  context = vm.createContext({});
  for (const fn of app.byType('function')) {
    const path = join(app.root, fn.files.code);
    vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
  }
  return context;
}

export function loadFunction(id: string): (...args: unknown[]) => unknown {
  const fn = appContext()[id];
  if (typeof fn !== 'function') throw new Error(`No IML function ${id} in makecomapp.json`);
  return fn;
}
