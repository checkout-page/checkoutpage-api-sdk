import { describe, expect, it } from 'vitest';
import { responseDataSchema, schemaPropertyNames } from '../scripts/spec-schema';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';
import { findOperation, queryParameters } from './spec';

const app = loadApp();
const gets = app
  .byType('module')
  .filter((m) => m.meta.moduleType === 'action' && m.meta.actionCrud === 'read');

const EXPECTED_GET_IDS = [
  'getPayment',
  'getBooking',
  'getSubscription',
  'getSubscriptionPayment',
  'getSubmission',
  'getInvoice',
  'getCustomer',
  'getCheckoutPage',
  'getEvent',
  'getForm',
  'getProduct',
];
const ID_RPC: Record<string, string> = {
  getCheckoutPage: 'rpc://listCheckoutPages',
  getEvent: 'rpc://listEvents',
  getForm: 'rpc://listForms',
  getCustomer: 'rpc://listCustomers',
  getProduct: 'rpc://listProducts',
};
const LIVEMODE = {
  name: 'livemode',
  type: 'boolean',
  label: 'Live mode',
  help: "Leave empty to use the API key's mode.",
};

const operationOf = (m: any) => findOperation('GET', requestShape(m.code.communication).path)!;
const declaresLivemode = (m: any) =>
  queryParameters(operationOf(m)).some((p) => p.name === 'livemode');

describe('get modules', () => {
  it('has the eleven gets', () =>
    expect(gets.map((m) => m.id).sort()).toEqual([...EXPECTED_GET_IDS].sort()));

  it('offers live mode on the six operations that declare it', () =>
    expect(
      gets
        .filter(declaresLivemode)
        .map((m) => m.id)
        .sort()
    ).toEqual(
      [
        'getPayment',
        'getBooking',
        'getSubscription',
        'getSubscriptionPayment',
        'getSubmission',
        'getInvoice',
      ].sort()
    ));

  it.each(gets.map((m) => [m.id, m]))(
    '%s fetches one record and matches the spec',
    (_id, m: any) => {
      const c = m.code.communication;
      expect(c.method).toBe('GET');
      expect(c.response).toEqual({ output: '{{body.data}}' });
      const shape = requestShape(c);
      expect(conformance(shape)).toEqual([]);
      expect(shape.path).toMatch(/^\/v1\/[a-z-]+\/__param__$/);
      const names = schemaPropertyNames(responseDataSchema('GET', shape.path), 1);
      for (const f of m.code.interface)
        expect(names, `${m.id} interface ${f.name}`).toContain(f.name);
    }
  );

  it.each(gets.map((m) => [m.id, m]))(
    '%s takes the ID first and puts it in the URL',
    (_id, m: any) => {
      const [id, ...rest] = m.code.mappableParams as any[];
      expect(id.required).toBe(true);
      expect(id.label).toMatch(/^[A-Z][a-z ]*( ID)?$/);
      expect(m.code.communication.url).toMatch(new RegExp(`/\\{\\{parameters\\.${id.name}\\}\\}$`));
      if (ID_RPC[m.id]) expect(id).toMatchObject({ type: 'select', options: ID_RPC[m.id] });
      else expect(id).toMatchObject({ type: 'text', label: expect.stringMatching(/ ID$/) });
      expect(rest).toEqual(declaresLivemode(m) ? [LIVEMODE] : []);
    }
  );

  it.each(gets.map((m) => [m.id, m]))('%s sends live mode only where declared', (_id, m: any) => {
    const qs = m.code.communication.qs;
    if (declaresLivemode(m))
      expect(qs).toEqual({ livemode: '{{toQueryBoolean(parameters.livemode)}}' });
    else expect(qs).toBeUndefined();
  });

  it.each(gets.map((m) => [m.id, m]))('%s is registered as a read action', (_id, m: any) => {
    expect(m.meta).toMatchObject({ connection: 'checkoutPage' });
    expect(m.meta.label).toMatch(/^Get an? [a-z ]+$/);
    expect(m.meta.description).toMatch(/^Returns one .+ by its ID\.$/);
    expect(m.code.staticParams).toEqual([]);
    expect(m.code.scope).toEqual([]);
  });
});
