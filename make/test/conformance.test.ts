import { describe, expect, it } from 'vitest';
import { conformance, requestShape } from './conformance';

describe('requestShape', () => {
  it('reads method, path, query and body keys from a communication', () => {
    expect(
      requestShape({
        url: '/v1/coupons/{{parameters.id}}',
        method: 'post',
        qs: { limit: '{{parameters.limit}}', archived: 'true', count: 5 },
        body: {
          code: '{{parameters.code}}',
          rules: [{ pageId: '{{parameters.pageId}}', priceIds: '{{parameters.priceIds}}' }],
          meta: '{{parameters.meta}}',
        },
      })
    ).toEqual({
      method: 'POST',
      path: '/v1/coupons/__param__',
      qsKeys: ['limit', 'archived', 'count'],
      bodyKeys: ['code', 'rules', 'rules[].pageId', 'rules[].priceIds', 'meta'],
      staticQs: { archived: 'true', count: '5' },
    });
  });
  it('defaults to GET and treats an expression body as having no static keys', () => {
    const shape = requestShape({ url: '/v1/account/', body: '{{parameters}}' });
    expect(shape.method).toBe('GET');
    expect(shape.bodyKeys).toEqual([]);
  });
});

describe('conformance', () => {
  const shape = (overrides: object) => ({
    method: 'GET',
    path: '/v1/bookings/',
    qsKeys: [],
    bodyKeys: [],
    staticQs: {},
    ...overrides,
  });

  it('accepts a request the spec declares', () => {
    expect(conformance(shape({ qsKeys: ['archived'], staticQs: { archived: 'true' } }))).toEqual(
      []
    );
    expect(
      conformance(
        shape({ method: 'POST', path: '/v1/coupons/', bodyKeys: ['code', 'rules[].pageId'] })
      )
    ).toEqual([]);
  });
  it('reports an operation the spec does not have', () => {
    expect(conformance(shape({ path: '/v1/nope/' }))).toHaveLength(1);
  });
  it('reports undeclared and invalid query params', () => {
    const problems = conformance(
      shape({ qsKeys: ['nope', 'archived'], staticQs: { archived: 'maybe' } })
    );
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('nope');
    expect(problems.join('\n')).toContain('archived');
  });
  it('reports undeclared body keys and a body the operation does not take', () => {
    expect(
      conformance(shape({ method: 'POST', path: '/v1/coupons/', bodyKeys: ['code', 'nope'] }))
    ).toEqual([expect.stringContaining('nope')]);
    expect(conformance(shape({ bodyKeys: ['code'] }))).toHaveLength(1);
  });
  it('accepts any key under a map the spec declares with additionalProperties', () => {
    const webhook = (bodyKeys: string[]) =>
      conformance(shape({ method: 'POST', path: '/v1/webhooks/', bodyKeys }));
    expect(webhook(['customHeaders', 'customHeaders.x-make-token'])).toEqual([]);
    expect(webhook(['customHeaders.x-make-token.nope'])).toHaveLength(1);
  });
});
