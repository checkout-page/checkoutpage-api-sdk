import { expect, it } from 'vitest';
import { loadApp } from './app';

const app = loadApp();

function labels(fields: unknown, prefix = ''): [string, string][] {
  if (!fields || typeof fields !== 'object') return [];
  if (!Array.isArray(fields)) return labels((fields as { spec?: unknown }).spec, prefix);
  return fields.flatMap((field: { name: string; label?: string; spec?: unknown }) => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    return [
      ...(field.label ? [[path, field.label] as [string, string]] : []),
      ...labels(field.spec, path),
    ];
  });
}

const modules = app.byType('module').filter((m) => m.code.interface);

it.each(modules.map((m) => [m.id, m.code.interface]))(
  '%s names the kind of page, never a bare page',
  (_id, fields) => {
    for (const [path, label] of labels(fields)) expect(label, path).not.toMatch(/\bPage\b/);
  }
);
