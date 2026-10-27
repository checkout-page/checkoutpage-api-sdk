import type { IDataObject, INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { CheckoutPage } from '../nodes/CheckoutPage/CheckoutPage.node';
import { executeContext, loadOptionsContext, locator, requestOptions } from './helpers';

const BASE = 'https://api.checkoutpage.com';
const node = new CheckoutPage();

function property(resource: string, name: string): INodeProperties | undefined {
  return node.description.properties.find(
    (p) =>
      p.name === name &&
      (p.displayOptions?.show?.resource as string[] | undefined)?.[0] === resource
  );
}

function list(data: IDataObject[], hasMore = false) {
  return { data, has_more: hasMore, total: data.length };
}

describe('resource locator fields', () => {
  it.each([
    ['booking', 'eventId', 'Event', 'searchEvents', ['create']],
    ['event', 'pageId', 'Event', 'searchEvents', ['get']],
    ['checkoutPage', 'pageId', 'Checkout Page', 'searchCheckoutPages', ['get']],
    ['form', 'pageId', 'Form', 'searchForms', ['get']],
    ['customer', 'customerId', 'Customer', 'searchCustomers', ['get', 'update']],
  ])(
    '%s.%s picks from a searchable list or takes an ID',
    (resource, name, displayName, method, operations) => {
      const field = property(resource, name);
      expect(field?.type).toBe('resourceLocator');
      expect(field?.displayName).toBe(displayName);
      expect(field?.required).toBe(true);
      expect(field?.default).toEqual({ mode: 'list', value: '' });
      expect(field?.displayOptions?.show?.operation).toEqual(operations);
      expect(field?.modes?.map((mode) => [mode.name, mode.type])).toEqual([
        ['list', 'list'],
        ['id', 'string'],
      ]);
      expect(field?.modes?.[0].typeOptions).toEqual({
        searchListMethod: method,
        searchable: true,
      });
      expect(node.methods.listSearch).toHaveProperty(method);
    }
  );

  it.each([
    ['booking', 'bookingId'],
    ['payment', 'paymentId'],
    ['subscription', 'subscriptionId'],
  ])('%s keeps a plain ID field', (resource, name) => {
    expect(property(resource, name)?.type).toBe('string');
  });

  it("refreshes ticket types and fields when the booking's event changes", () => {
    const tickets = property('booking', 'tickets');
    const fields = property('booking', 'fields');
    const dependsOn = [tickets, fields].map(
      (p) =>
        (p?.options?.[0] as { values: INodeProperties[] }).values[0].typeOptions
          ?.loadOptionsDependsOn
    );
    expect(dependsOn).toEqual([['eventId.value'], ['eventId.value']]);
  });
});

describe('resource locator values', () => {
  it.each([
    ['customer', 'customerId', locator('cus_1'), '/v1/customers/cus_1'],
    ['customer', 'customerId', locator('cus_2', 'id'), '/v1/customers/cus_2'],
    ['event', 'pageId', locator('ev_1'), '/v1/events/ev_1'],
    ['checkoutPage', 'pageId', locator('cp_1', 'id'), '/v1/checkout-pages/cp_1'],
    ['form', 'pageId', locator('fm 1'), '/v1/forms/fm%201'],
  ])('%s get reads the locator value into the path', async (resource, name, value, path) => {
    const { context, http } = executeContext(
      { resource, operation: 'get', [name]: value, simplify: false },
      [{ data: {} }]
    );
    await node.execute.call(context);
    expect(requestOptions(http).url).toBe(`${BASE}${path}`);
  });

  it('customer update reads the locator value into the path', async () => {
    const { context, http } = executeContext(
      {
        resource: 'customer',
        operation: 'update',
        customerId: locator('cus_9', 'id'),
        updateFields: { name: 'Ada' },
      },
      [{ data: {} }]
    );
    await node.execute.call(context);
    expect(requestOptions(http).method).toBe('PATCH');
    expect(requestOptions(http).url).toBe(`${BASE}/v1/customers/cus_9`);
  });

  it('booking create sends the event from an ID-mode locator', async () => {
    const { context, http } = executeContext(
      {
        resource: 'booking',
        operation: 'create',
        eventId: locator(' ev_7 ', 'id'),
        tickets: { ticket: [{ ticketTypeId: 'tt_1', quantity: 1 }] },
        fields: { field: [{ fieldId: 'f_email', value: 'ada@example.com' }] },
        additionalFields: {},
      },
      [{ data: {} }]
    );
    await node.execute.call(context);
    expect((requestOptions(http).body as IDataObject).eventId).toBe('ev_7');
  });
});

describe('list search', () => {
  it.each([
    ['searchEvents', '/v1/events/'],
    ['searchCheckoutPages', '/v1/checkout-pages/'],
    ['searchForms', '/v1/forms/'],
    ['searchCustomers', '/v1/customers/'],
  ] as const)('%s searches %s', async (method, path) => {
    const { context, http } = loadOptionsContext({}, [list([])]);
    await node.methods.listSearch[method].call(context, 'summer');
    const options = requestOptions(http);
    expect(options.method).toBe('GET');
    expect(options.url).toBe(`${BASE}${path}`);
    expect(options.qs).toEqual({ limit: 100, search: 'summer' });
  });

  it('lists without a search term and pages with starting_after', async () => {
    const { context, http } = loadOptionsContext({}, [
      list(
        [
          { id: 'ev_1', title: 'Summer camp', url: 'https://example.com/summer' },
          { id: 'ev_2', name: 'Gala' },
        ],
        true
      ),
      list([{ id: 'ev_3' }]),
    ]);
    const first = await node.methods.listSearch.searchEvents.call(context);
    expect(requestOptions(http, 0).qs).toEqual({ limit: 100 });
    expect(first).toEqual({
      results: [
        { name: 'Summer camp', value: 'ev_1', url: 'https://example.com/summer' },
        { name: 'Gala', value: 'ev_2', url: undefined },
      ],
      paginationToken: 'ev_2',
    });

    const second = await node.methods.listSearch.searchEvents.call(
      context,
      undefined,
      first.paginationToken as string
    );
    expect(requestOptions(http, 1).qs).toEqual({ limit: 100, starting_after: 'ev_2' });
    expect(second).toEqual({
      results: [{ name: 'ev_3', value: 'ev_3', url: undefined }],
      paginationToken: undefined,
    });
  });

  it('labels customers by name and email', async () => {
    const { context } = loadOptionsContext({}, [
      list([
        { id: 'cus_1', name: 'Ada Lovelace', email: 'ada@example.com' },
        { id: 'cus_2', email: 'grace@example.com' },
      ]),
    ]);
    const { results } = await node.methods.listSearch.searchCustomers.call(context, 'example');
    expect(results.map((r) => r.name)).toEqual([
      'Ada Lovelace (ada@example.com)',
      'grace@example.com',
    ]);
  });
});
