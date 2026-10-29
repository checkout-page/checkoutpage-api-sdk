import { describe, expect, it } from 'vitest';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';

const app = loadApp();

describe('connection', () => {
  it('validates the key against GET /v1/account/', () => {
    const conn = app.get('connection', 'checkoutPage');
    expect(conn.meta.connectionType).toBe('basic');
    const shape = requestShape(conn.code.communication as any);
    expect(shape.method).toBe('GET');
    expect(shape.path).toBe('__param__/v1/account/');
    expect(conformance({ ...shape, path: '/v1/account/' })).toEqual([]);
  });
  it('asks for an API key and an advanced base URL', () => {
    const params = app.get('connection', 'checkoutPage').code.params as any[];
    expect(params.map((p) => p.name)).toEqual(['apiKey', 'baseUrl']);
    expect(params[0].type).toBe('password');
    expect(params[1]).toMatchObject({
      type: 'url',
      advanced: true,
      default: 'https://api.checkoutpage.com',
    });
  });
});
