import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadApp, readIml } from './app';

const app = loadApp();
const KEBAB_CODES: Record<string, string> = {
  staticParams: 'static-params',
  mappableParams: 'mappable-params',
};

describe('makecomapp.json', () => {
  it('is file version 1 with no committed origins', () => {
    expect(app.makecomapp.fileVersion).toBe(1);
    expect(app.makecomapp.origins).toEqual([]);
  });
  it('points every code file at an existing file', () => {
    for (const path of Object.values(app.makecomapp.generalCodeFiles))
      expect(existsSync(join(app.root, path))).toBe(true);
    for (const c of app.components)
      for (const path of Object.values(c.files))
        expect(existsSync(join(app.root, path)), `${c.type} ${c.id} ${path}`).toBe(true);
  });
  it('names files <type>s/<kebab>/<kebab>.<code>.iml.json', () => {
    const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    for (const c of app.components) {
      for (const [code, path] of Object.entries(c.files)) {
        const expectedCode = KEBAB_CODES[code] ?? code;
        const ext =
          code === 'common' ? 'json' : code === 'code' || code === 'test' ? 'js' : 'iml.json';
        expect(path).toBe(`${c.type}s/${kebab(c.id)}/${kebab(c.id)}.${expectedCode}.${ext}`);
      }
    }
  });
  it('lists every module in exactly one group', () => {
    const grouped = app.groups.flatMap((g) => g.modules);
    expect([...grouped].sort()).toEqual(
      app
        .byType('module')
        .map((m) => m.id)
        .sort()
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe('README', () => {
  const readme = readFileSync(join(app.root, app.makecomapp.generalCodeFiles.readme), 'utf8');
  it('has no em dash', () => {
    expect(readme).not.toContain('\u2014');
  });
  it('names the kind of page, never a bare page', () => {
    expect(readme).not.toMatch(/(?<!checkout )\bpages?\b/i);
  });
});

describe('base', () => {
  it('authenticates with the connection and sanitizes the header', () => {
    expect(app.base.baseUrl).toBe('{{connection.baseUrl}}');
    expect((app.base.headers as any).authorization).toBe('Bearer {{connection.apiKey}}');
    expect((app.base.log as any).sanitize).toContain('request.headers.authorization');
  });
  it('shows the API message on errors', () => {
    expect(JSON.stringify((app.base.response as any).error)).toContain('body.message');
  });
});

describe('readIml', () => {
  it('strips comments but keeps // inside strings', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'make-iml-')), 'x.iml.json');
    writeFileSync(
      path,
      '{\n  // line comment\n  "url": "https://api.checkoutpage.com", /* block */\n  "a": "/* not a comment */"\n}\n'
    );
    expect(readIml(path)).toEqual({
      url: 'https://api.checkoutpage.com',
      a: '/* not a comment */',
    });
  });
});
