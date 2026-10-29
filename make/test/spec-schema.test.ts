import { describe, expect, it } from 'vitest';
import {
  type MakeField,
  camelCaseToSentence,
  moduleInterface,
  moduleSample,
  resolveSchema,
  responseDataSchema,
  schemaPropertyNames,
  toMakeInterface,
  toMakeSample,
} from '../scripts/spec-schema';

describe('toMakeInterface', () => {
  it('types the payment list item', () => {
    const fields = toMakeInterface(responseDataSchema('GET', '/v1/payments/', { items: true }));
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName.id.type).toBe('text');
    expect(byName.amount.type).toBe('number');
    expect(byName.createdAt.type).toBe('date');
    expect(byName.livemode.type).toBe('boolean');
    expect(byName.billing.type).toBe('collection');
    expect((byName.billing.spec as MakeField[]).map((f) => f.name)).toContain('email');
    expect(byName.taxBreakdown.type).toBe('array');
  });

  it('drops deprecated fields', () => {
    const pm = toMakeInterface(responseDataSchema('GET', '/v1/payments/', { items: true })).find(
      (f) => f.name === 'paymentMethod'
    )!;
    const names = (pm.spec as MakeField[]).map((f) => f.name);
    expect(names).toContain('expMonth');
    expect(names).not.toContain('exp_month');
  });

  it('gives arrays the spec of their items', () => {
    const fields = toMakeInterface({
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        lines: {
          type: 'array',
          items: { type: 'object', properties: { qty: { type: 'number' } } },
        },
      },
    });
    expect(fields).toEqual([
      { name: 'tags', type: 'array', label: 'Tags', spec: { type: 'text' } },
      {
        name: 'lines',
        type: 'array',
        label: 'Lines',
        spec: [{ name: 'qty', type: 'number', label: 'Qty' }],
      },
    ]);
  });

  it('maps formats, enums and free-form objects', () => {
    const fields = toMakeInterface({
      type: 'object',
      properties: {
        contact: { type: 'string', format: 'email' },
        website: { type: ['string', 'null'], format: 'uri' },
        status: { type: 'string', enum: ['open', 'closed'] },
        metadata: { type: 'object', additionalProperties: { type: 'string' } },
      },
    });
    expect(fields.map((f) => [f.name, f.type, f.spec])).toEqual([
      ['contact', 'email', undefined],
      ['website', 'url', undefined],
      ['status', 'text', undefined],
      ['metadata', 'collection', undefined],
    ]);
  });

  it('leaves out excluded fields, including nested ones', () => {
    const fields = toMakeInterface(responseDataSchema('GET', '/v1/payments/', { items: true }), {
      exclude: ['clientIp', 'billing.phone'],
    });
    expect(fields.map((f) => f.name)).not.toContain('clientIp');
    const billing = fields.find((f) => f.name === 'billing')!;
    expect((billing.spec as MakeField[]).map((f) => f.name)).not.toContain('phone');
  });
});

describe('camelCaseToSentence', () => {
  it('turns camelCase into sentence case with ID, URL and SKU kept upper case', () => {
    expect(camelCaseToSentence('createdAt')).toBe('Created at');
    expect(camelCaseToSentence('id')).toBe('ID');
    expect(camelCaseToSentence('pageId')).toBe('Page ID');
    expect(camelCaseToSentence('stripeCustomerId')).toBe('Stripe customer ID');
    expect(camelCaseToSentence('url')).toBe('URL');
    expect(camelCaseToSentence('recoveryUrl')).toBe('Recovery URL');
    expect(camelCaseToSentence('sku')).toBe('SKU');
  });
});

describe('resolveSchema', () => {
  it('merges allOf for checkout pages', () => {
    const names = schemaPropertyNames(
      responseDataSchema('GET', '/v1/checkout-pages/', { items: true }),
      1
    );
    expect(names).toEqual(
      expect.arrayContaining(['id', 'slug', 'status', 'product', 'paymentOptions'])
    );
  });

  it('unwraps a nullable anyOf and a nullable type list', () => {
    expect(resolveSchema({ anyOf: [{ type: 'number' }, { type: 'null' }] })).toMatchObject({
      type: 'number',
      nullable: true,
    });
    expect(resolveSchema({ type: ['string', 'null'], enum: ['a', null] })).toMatchObject({
      type: 'string',
      enum: ['a'],
      nullable: true,
    });
  });

  it('merges object unions so every variant field is offered', () => {
    const merged = resolveSchema({
      oneOf: [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'number' } } },
      ],
    });
    expect(Object.keys(merged.properties ?? {})).toEqual(['a', 'b']);
    expect(merged.required ?? []).toEqual([]);
  });

  it('throws for a path the spec does not have', () => {
    expect(() => responseDataSchema('GET', '/v1/nothing-here/')).toThrow(/GET \/v1\/nothing-here/);
  });
});

describe('schemaPropertyNames', () => {
  it('lists nested names with dots and skips deprecated ones', () => {
    const names = schemaPropertyNames(responseDataSchema('GET', '/v1/payments/', { items: true }));
    expect(names).toEqual(
      expect.arrayContaining(['billing', 'billing.email', 'paymentMethod.expMonth'])
    );
    expect(names).not.toContain('paymentMethod.exp_month');
    expect(names.some((name) => name.split('.').length > 2)).toBe(false);
  });
});

describe('toMakeSample', () => {
  it('builds a sample with every required field', () => {
    const sample = toMakeSample(
      responseDataSchema('GET', '/v1/customers/', { items: true })
    ) as Record<string, unknown>;
    expect(Object.keys(sample)).toEqual(
      expect.arrayContaining(['id', 'email', 'sellerId', 'createdAt', 'updatedAt'])
    );
  });

  it('prefers examples, then enums, then a placeholder per type', () => {
    expect(
      toMakeSample({
        type: 'object',
        required: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        properties: {
          a: { type: 'string', example: 'given' },
          b: { type: 'string', enum: ['first', 'second'] },
          c: { type: 'string' },
          d: { type: 'integer' },
          e: { type: 'boolean' },
          f: { type: 'string', format: 'date-time' },
          g: { type: 'array', items: { type: 'string' } },
          optionalNullable: { type: ['string', 'null'] },
          optional: { type: 'number' },
          old: { type: 'string', deprecated: true },
        },
      })
    ).toEqual({
      a: 'given',
      b: 'first',
      c: 'text',
      d: 0,
      e: false,
      f: '2026-01-01T12:00:00.000Z',
      g: [],
      optionalNullable: null,
      optional: 0,
    });
  });
});

describe('module targets', () => {
  const watchPayments = {
    module: 'watchPayments',
    method: 'GET' as const,
    path: '/v1/payments/',
    items: true,
    wrap: { event: true as const, key: 'payment', recoveryUrl: true },
  };

  it('wraps an instant trigger interface in the webhook envelope', () => {
    const fields = moduleInterface(watchPayments);
    expect(fields.map((f) => [f.name, f.type, f.label])).toEqual([
      ['event', 'text', 'Event'],
      ['eventId', 'text', 'Event ID'],
      ['timestamp', 'date', 'Timestamp'],
      ['sellerId', 'text', 'Seller ID'],
      ['payment', 'collection', 'Payment'],
      ['recoveryUrl', 'url', 'Recovery URL'],
    ]);
    expect(fields[4].spec).toEqual(
      toMakeInterface(responseDataSchema('GET', '/v1/payments/', { items: true }))
    );
  });

  it('samples the envelope with a created event', () => {
    const sample = moduleSample(watchPayments) as Record<string, unknown>;
    expect(sample.event).toBe('payment.created');
    expect(sample.recoveryUrl).toBeNull();
    expect(sample.payment).toEqual(
      toMakeSample(responseDataSchema('GET', '/v1/payments/', { items: true }))
    );
  });

  it('leaves the envelope out for a plain module', () => {
    const target = {
      module: 'getCustomer',
      method: 'GET' as const,
      path: '/v1/customers/:customerId',
      items: false,
    };
    expect(moduleInterface(target)).toEqual(
      toMakeInterface(responseDataSchema('GET', '/v1/customers/:customerId'))
    );
  });
});
