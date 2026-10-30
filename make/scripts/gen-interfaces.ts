import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as prettier from 'prettier';
import { targets } from './interfaces.config';
import { moduleInterface, moduleSample } from './spec-schema';

const APP_ROOT = join(__dirname, '..', 'app');

const kebab = (id: string) => id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

async function writeIml(path: string, value: unknown): Promise<boolean> {
  const config = await prettier.resolveConfig(path);
  const text = await prettier.format(JSON.stringify(value, null, 2), {
    ...config,
    filepath: path,
  });
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return true;
}

async function main() {
  let changed = 0;
  for (const target of targets) {
    const base = join(APP_ROOT, 'modules', kebab(target.module), kebab(target.module));
    if (await writeIml(`${base}.interface.iml.json`, moduleInterface(target))) changed++;
    if (await writeIml(`${base}.samples.iml.json`, moduleSample(target))) changed++;
  }
  console.log(`${targets.length} modules generated, ${changed} files changed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
