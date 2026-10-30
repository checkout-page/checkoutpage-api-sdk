import { describe, expect, it } from 'vitest';
import { responseDataSchema, schemaPropertyNames } from '../scripts/spec-schema';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';
import { findOperation, queryParameters } from './spec';

const app = loadApp();
const searches = app.byType('module').filter((m) => m.meta.moduleType === 'search');

const EXPECTED_SEARCH_IDS = [
  'searchPayments',
  'searchBookings',
  'searchSubscriptions',
  'searchSubscriptionPayments',
  'searchSubmissions',
  'searchCustomers',
  'searchCheckoutPages',
  'searchEvents',
  'searchForms',
  'searchProducts',
  'searchCoupons',
  'searchTickets',
  'searchInvoices',
];
const NOT_MAPPABLE = ['limit', 'starting_after', 'ending_before'];
const PAGE_RPC: Record<string, string> = {
  searchPayments: 'rpc://listCheckoutPages',
  searchBookings: 'rpc://listEvents',
  searchTickets: 'rpc://listEvents',
  searchSubmissions: 'rpc://listForms',
};

describe('search modules', () => {
  it('has the thirteen searches', () =>
    expect(searches.map((m) => m.id).sort()).toEqual([...EXPECTED_SEARCH_IDS].sort()));

  it.each(searches.map((m) => [m.id, m]))(
    '%s pages with the cursor and matches the spec',
    (_id, m: any) => {
      const c = m.code.communication;
      expect(c.qs.limit).toBe('100');
      expect(c.response).toEqual({
        iterate: '{{body.data}}',
        output: '{{item}}',
        limit: '{{parameters.limit}}',
      });
      expect(c.pagination).toEqual({
        qs: { starting_after: '{{last(body.data).id}}' },
        condition: '{{body.has_more}}',
      });
      const shape = requestShape(c);
      expect(conformance(shape)).toEqual([]);
      const op = findOperation('GET', shape.path)!;
      const declared = queryParameters(op).map((p) => p.name);
      const params = m.code.mappableParams as any[];
      for (const p of params.filter((p) => p.name !== 'limit'))
        expect(declared, `${m.id} ${p.name}`).toContain(p.name);
      for (const p of params.filter((p) => p.type === 'boolean'))
        expect(c.qs[p.name]).toBe(`{{toQueryBoolean(parameters.${p.name})}}`);
      for (const p of params.filter((p) => p.type === 'date'))
        expect(c.qs[p.name]).toBe(`{{toQueryDate(parameters.${p.name})}}`);
      expect(params.at(-1)).toMatchObject({ name: 'limit', type: 'uinteger', default: 10 });
      const names = schemaPropertyNames(responseDataSchema('GET', shape.path, { items: true }), 1);
      for (const f of m.code.interface)
        expect(names, `${m.id} interface ${f.name}`).toContain(f.name);
    }
  );

  it.each(searches.map((m) => [m.id, m]))(
    '%s offers every spec filter and sends each one',
    (_id, m: any) => {
      const c = m.code.communication;
      const op = findOperation('GET', requestShape(c).path)!;
      const filters = queryParameters(op).filter((p) => !NOT_MAPPABLE.includes(p.name));
      const params = m.code.mappableParams as any[];
      expect(params.map((p) => p.name)).toEqual([...filters.map((p) => p.name), 'limit']);
      expect(Object.keys(c.qs)).toEqual(['limit', ...filters.map((p) => p.name)]);
      for (const p of params.filter(
        (p) => p.name !== 'limit' && !['boolean', 'date'].includes(p.type)
      ))
        expect(c.qs[p.name], `${m.id} ${p.name}`).toBe(`{{parameters.${p.name}}}`);
      for (const p of params.filter((p) => p.name !== 'limit'))
        expect(p.required, `${m.id} ${p.name}`).toBeUndefined();
      expect(params.at(-1)).toEqual({
        name: 'limit',
        type: 'uinteger',
        label: 'Limit',
        default: 10,
        required: true,
        help: 'The maximum number of results to return.',
      });
    }
  );

  it.each(searches.map((m) => [m.id, m]))('%s types each filter from the spec', (_id, m: any) => {
    const op = findOperation('GET', requestShape(m.code.communication).path)!;
    const byName = Object.fromEntries(queryParameters(op).map((p) => [p.name, p.schema ?? {}]));
    for (const p of m.code.mappableParams as any[]) {
      if (p.name === 'limit') continue;
      const schema = byName[p.name] as { enum?: string[]; format?: string };
      const isBoolean = String(schema.enum) === 'true,false';
      if (isBoolean) expect(p.type, `${m.id} ${p.name}`).toBe('boolean');
      else if (schema.enum) {
        expect(p.type, `${m.id} ${p.name}`).toBe('select');
        expect(p.options.map((o: any) => o.value)).toEqual(schema.enum);
        for (const o of p.options) expect(o.label).toMatch(/^[A-Z][a-z -]*$/);
      } else if (schema.format === 'date-time') expect(p.type, `${m.id} ${p.name}`).toBe('date');
      else if (p.name === 'pageId' && PAGE_RPC[m.id])
        expect(p).toMatchObject({ type: 'select', options: PAGE_RPC[m.id] });
      else if (p.name === 'customerId')
        expect(p).toMatchObject({ type: 'select', options: 'rpc://listCustomers' });
      else if (p.name === 'productId')
        expect(p).toMatchObject({ type: 'select', options: 'rpc://listProducts' });
      else expect(p.type, `${m.id} ${p.name}`).toBe('text');
    }
  });

  it.each(searches.map((m) => [m.id, m]))('%s is registered as a search', (_id, m: any) => {
    expect(m.meta).toMatchObject({ moduleType: 'search', connection: 'checkoutPage' });
    expect(m.meta.label).toMatch(/^Search [a-z ]+$/);
    expect(m.meta.description).toMatch(/^Returns .+ that match the filters\.$/);
    expect(m.code.staticParams).toEqual([]);
    expect(m.code.scope).toEqual([]);
  });
});
