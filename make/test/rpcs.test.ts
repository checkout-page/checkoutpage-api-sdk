import { describe, expect, it } from 'vitest';
import { responseDataSchema, schemaPropertyNames } from '../scripts/spec-schema';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';

const app = loadApp();
const rpcs = app.byType('rpc');

const EXPECTED_RPC_IDS = [
  'listEvents',
  'listCheckoutPages',
  'listForms',
  'listCustomers',
  'listProducts',
  'listCoupons',
  'listTicketTypes',
  'listEventFields',
];

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const itemReferences = (output: unknown) =>
  [
    ...strings(output)
      .join(' ')
      .matchAll(/\bitem\.([A-Za-z.]+)/g),
  ].map((match) => match[1]);

describe('rpcs', () => {
  it('has the eight dropdown rpcs', () =>
    expect(rpcs.map((r) => r.id).sort()).toEqual([...EXPECTED_RPC_IDS].sort()));

  it.each(rpcs.map((r) => [r.id, r]))(
    '%s reads a spec list into label and value',
    (_id, r: any) => {
      const c = r.code.communication;
      expect(r.meta.connection).toBe('checkoutPage');
      expect(r.meta.label).toMatch(/^List [a-z ]+$/);
      const shape = requestShape(c);
      expect(shape.method).toBe('GET');
      expect(conformance(shape)).toEqual([]);
      expect(Object.keys(c.response.output).sort()).toEqual(['label', 'value']);
      expect(c.response.output.value).toBe('{{item.id}}');
      expect(r.code.params).toEqual([]);
    }
  );

  // An rpc sees the calling module's parameters, so a module's own Search filter must not narrow
  // its dropdowns.
  it.each(rpcs.map((r) => [r.id, r]))('%s reads no module parameter but eventId', (_id, r: any) => {
    const used = [...JSON.stringify(r.code.communication).matchAll(/parameters\.(\w+)/g)].map(
      (match) => match[1]
    );
    for (const name of used) expect(name).toBe('eventId');
  });

  const listRpcs = rpcs.filter((r) => !['listTicketTypes', 'listEventFields'].includes(r.id));
  it.each(listRpcs.map((r) => [r.id, r]))(
    '%s pages through up to three pages and labels with fields the list returns',
    (_id, r: any) => {
      const c = r.code.communication;
      expect(c.qs).toEqual({ limit: '100' });
      expect(c.response.iterate).toBe('{{body.data}}');
      expect(c.response.limit).toBe(300);
      expect(c.pagination).toEqual({
        qs: { starting_after: '{{last(body.data).id}}' },
        condition: '{{body.has_more}}',
      });
      const names = schemaPropertyNames(
        responseDataSchema('GET', requestShape(c).path, { items: true }),
        2
      );
      for (const reference of itemReferences(c.response.output))
        expect(names, `${r.id} item.${reference}`).toContain(reference);
    }
  );

  it.each(['listTicketTypes', 'listEventFields'])('%s reads one event, with no pagination', (id) =>
    expect((app.get('rpc', id).code.communication as any).pagination).toBeUndefined()
  );

  it('lists the ticket types of the chosen event', () => {
    const c = app.get('rpc', 'listTicketTypes').code.communication as any;
    expect(c).toEqual({
      url: '/v1/events/{{parameters.eventId}}',
      method: 'GET',
      response: {
        iterate: "{{flatten(map(body.data.ticketGroups, 'ticketTypes'))}}",
        output: { label: '{{item.name}}', value: '{{item.id}}' },
      },
    });
  });

  it('lists the enabled fields of the chosen event', () => {
    const c = app.get('rpc', 'listEventFields').code.communication as any;
    expect(c).toEqual({
      url: '/v1/events/{{parameters.eventId}}',
      method: 'GET',
      response: {
        iterate: { container: '{{body.data.fields}}', condition: '{{item.disabled != true}}' },
        output: { label: '{{ifempty(item.label, item.type)}}', value: '{{item.id}}' },
      },
    });
  });

  it('defines every rpc a module or rpc parameter points at', () => {
    const ids = new Set(rpcs.map((r) => r.id));
    const referenced = app.components
      .filter((c) => c.type === 'module' || c.type === 'rpc')
      .flatMap((c) =>
        ['mappableParams', 'staticParams', 'params'].flatMap((key) => strings(c.code[key]))
      )
      .filter((value) => value.startsWith('rpc://'));
    expect(referenced.length).toBeGreaterThan(0);
    for (const value of referenced) expect(ids, value).toContain(value.slice(6).split('?')[0]);
  });
});
