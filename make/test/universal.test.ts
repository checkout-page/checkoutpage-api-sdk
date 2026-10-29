import { describe, expect, it } from 'vitest';
import { loadApp } from './app';

const app = loadApp();

describe('makeApiCall', () => {
  it('is the only universal module', () => {
    const universal = app.byType('module').filter((m) => m.meta.moduleType === 'universal');
    expect(universal.map((m) => m.id)).toEqual(['makeApiCall']);
  });

  const m = app.get('module', 'makeApiCall');
  const communication = m.code.communication as Record<string, unknown>;
  const params = m.code.mappableParams as {
    name: string;
    type: string;
    required?: boolean;
    default?: unknown;
    options?: { value: string }[];
  }[];

  it('is a universal module on the connection', () => {
    expect(m.meta).toMatchObject({ moduleType: 'universal', connection: 'checkoutPage' });
  });

  it('calls a path relative to the base URL', () => {
    expect(communication.url).toBe('{{parameters.url}}');
    expect(communication.method).toBe('{{parameters.method}}');
    expect(communication.body).toBe('{{parameters.body}}');
  });

  it('folds headers and query string rows into collections', () => {
    expect(communication.headers).toEqual({
      '{{...}}': "{{toCollection(parameters.headers, 'key', 'value')}}",
    });
    expect(communication.qs).toEqual({
      '{{...}}': "{{toCollection(parameters.qs, 'key', 'value')}}",
    });
  });

  it('returns the body, headers and status code', () => {
    expect((communication.response as { output: unknown }).output).toEqual({
      body: '{{body}}',
      headers: '{{headers}}',
      statusCode: '{{statusCode}}',
    });
  });

  it('takes the url, method, headers, query string and body', () => {
    expect(params.map((p) => p.name)).toEqual(['url', 'method', 'headers', 'qs', 'body']);
    const byName = Object.fromEntries(params.map((p) => [p.name, p]));
    expect(byName.url).toMatchObject({ type: 'text', required: true });
    expect(byName.method).toMatchObject({ type: 'select', default: 'GET', required: true });
    expect(byName.method.options!.map((o) => o.value)).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
    ]);
    expect(byName.headers.type).toBe('array');
    expect(byName.qs.type).toBe('array');
    expect(byName.body.type).toBe('any');
  });

  it('declares no static params and no scope', () => {
    expect(m.code.staticParams).toEqual([]);
    expect(m.code.scope).toEqual([]);
  });
});
