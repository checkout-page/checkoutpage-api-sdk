import {
  NodeApiError,
  NodeOperationError,
  type IDataObject,
  type INodeProperties,
  type INodePropertyOptions,
  type IPairedItemData,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { CheckoutPage } from '../nodes/CheckoutPage/CheckoutPage.node';
import { toNodeApiError } from '../nodes/CheckoutPage/transport';
import { apiError, executeContext, loadOptionsContext, requestOptions, TEST_NODE } from './helpers';

const BASE = 'https://api.checkoutpage.com';
const node = new CheckoutPage();

async function run(
  params: IDataObject,
  responses: unknown[],
  options: Parameters<typeof executeContext>[2] = {}
) {
  const { context, http } = executeContext(params, responses, options);
  const output = await node.execute.call(context);
  return { output: output[0], http };
}

function list(data: IDataObject[], hasMore = false) {
  return { data, has_more: hasMore, total: data.length };
}

describe('node description', () => {
  it('works as an AI agent tool', () => {
    expect(node.description.usableAsTool).toBe(true);
  });

  it('uses the Checkout Page credentials', () => {
    expect(node.description.credentials).toEqual([{ name: 'checkoutPageApi', required: true }]);
  });

  it('offers every resource', () => {
    const resource = node.description.properties.find((p) => p.name === 'resource');
    expect(resource?.options?.map((o) => (o as INodePropertyOptions).value)).toEqual([
      'booking',
      'checkoutPage',
      'coupon',
      'customer',
      'event',
      'form',
      'payment',
      'subscription',
    ]);
  });

  it('offers the expected operations per resource', () => {
    const operations: Record<string, string[]> = {};
    for (const property of node.description.properties) {
      if (property.name !== 'operation') continue;
      const resource = (property.displayOptions?.show?.resource as string[])[0];
      operations[resource] = (property.options as INodePropertyOptions[]).map((o) =>
        String(o.value)
      );
    }
    expect(operations).toEqual({
      booking: ['create', 'get', 'getAll'],
      checkoutPage: ['get', 'getAll'],
      coupon: ['create', 'getAll'],
      customer: ['get', 'getAll', 'update'],
      event: ['get', 'getAll'],
      form: ['get', 'getAll'],
      payment: ['get', 'getAll'],
      subscription: ['get', 'getAll'],
    });
  });

  it("names operations in n8n's style", () => {
    const actions: Record<string, Array<[string, string, string]>> = {};
    for (const property of node.description.properties) {
      if (property.name !== 'operation') continue;
      const resource = (property.displayOptions?.show?.resource as string[])[0];
      actions[resource] = (property.options as INodePropertyOptions[]).map((o) => [
        o.name,
        String(o.action),
        String(o.description),
      ]);
    }
    expect(actions).toEqual({
      booking: [
        ['Create', 'Create booking', 'Create a new booking to add an attendee to an event'],
        ['Get', 'Get booking', 'Retrieve a booking'],
        ['Get Many', 'Get many bookings', 'Retrieve a list of bookings'],
      ],
      checkoutPage: [
        ['Get', 'Get checkout page', 'Retrieve a checkout page'],
        ['Get Many', 'Get many checkout pages', 'Retrieve a list of checkout pages'],
      ],
      coupon: [
        ['Create', 'Create coupon', 'Create a new coupon'],
        ['Get Many', 'Get many coupons', 'Retrieve a list of coupons'],
      ],
      customer: [
        ['Get', 'Get customer', 'Retrieve a customer'],
        ['Get Many', 'Get many customers', 'Retrieve a list of customers'],
        ['Update', 'Update customer', 'Update a customer'],
      ],
      event: [
        ['Get', 'Get event', 'Retrieve an event'],
        ['Get Many', 'Get many events', 'Retrieve a list of events'],
      ],
      form: [
        ['Get', 'Get form', 'Retrieve a form'],
        ['Get Many', 'Get many forms', 'Retrieve a list of forms'],
      ],
      payment: [
        ['Get', 'Get payment', 'Retrieve a payment'],
        ['Get Many', 'Get many payments', 'Retrieve a list of payments'],
      ],
      subscription: [
        ['Get', 'Get subscription', 'Retrieve a subscription'],
        ['Get Many', 'Get many subscriptions', 'Retrieve a list of subscriptions'],
      ],
    });
  });

  it('starts every placeholder on a text field with "e.g."', () => {
    const placeholders: string[] = [];
    const walk = (properties: INodeProperties[]) => {
      for (const property of properties) {
        if (property.type === 'string' && property.placeholder) {
          placeholders.push(String(property.placeholder));
        }
        for (const option of property.options ?? []) {
          if ('values' in option) walk(option.values);
          else if ('type' in option) walk([option as INodeProperties]);
        }
      }
    };
    walk(node.description.properties);
    expect(placeholders).toContain('e.g. nathan@example.com');
    expect(placeholders.every((p) => p.startsWith('e.g. '))).toBe(true);
  });
});

describe('get operations', () => {
  const cases: Array<[string, string, string, string]> = [
    ['booking', 'bookingId', 'bk_1', '/v1/bookings/bk_1'],
    ['payment', 'paymentId', 'pay_1', '/v1/payments/pay_1'],
    ['customer', 'customerId', 'cus_1', '/v1/customers/cus_1'],
    ['subscription', 'subscriptionId', 'sub_1', '/v1/subscriptions/sub_1'],
    ['event', 'pageId', 'ev_1', '/v1/events/ev_1'],
    ['checkoutPage', 'pageId', 'cp_1', '/v1/checkout-pages/cp_1'],
    ['form', 'pageId', 'fm_1', '/v1/forms/fm_1'],
  ];

  it.each(cases)('%s: GET %s', async (resource, idParam, id, path) => {
    const { output, http } = await run({ resource, operation: 'get', [idParam]: id, options: {} }, [
      { data: { id, name: 'Record' } },
    ]);
    const options = requestOptions(http);
    expect(http.mock.calls[0][0]).toBe('checkoutPageApi');
    expect(options.method).toBe('GET');
    expect(options.url).toBe(`${BASE}${path}`);
    expect(options.qs).toBeUndefined();
    expect(options.body).toBeUndefined();
    expect(options.json).toBe(true);
    expect(output).toEqual([{ json: { id, name: 'Record' }, pairedItem: { item: 0 } }]);
  });

  it('URL-encodes the ID', async () => {
    const { http } = await run({ resource: 'customer', operation: 'get', customerId: 'a/b c' }, [
      { data: {} },
    ]);
    expect(requestOptions(http).url).toBe(`${BASE}/v1/customers/a%2Fb%20c`);
  });

  it.each(['booking', 'payment', 'subscription'])(
    '%s: sends livemode=false to read test-mode records',
    async (resource) => {
      const idParam = `${resource}Id`;
      const { http } = await run(
        { resource, operation: 'get', [idParam]: 'x1', options: { livemode: false } },
        [{ data: {} }]
      );
      expect(requestOptions(http).qs).toEqual({ livemode: 'false' });
    }
  );

  it('uses a custom base URL without a trailing slash', async () => {
    const { http } = await run(
      { resource: 'event', operation: 'get', pageId: 'ev_1' },
      [{ data: {} }],
      { credentials: { apiKey: 'YOUR_API_KEY', baseUrl: 'https://api.checkoutpage.dev/' } }
    );
    expect(requestOptions(http).url).toBe('https://api.checkoutpage.dev/v1/events/ev_1');
  });

  it('rejects an empty ID before calling the API', async () => {
    const { context, http } = executeContext(
      { resource: 'booking', operation: 'get', bookingId: ' ', options: {} },
      []
    );
    await expect(node.execute.call(context)).rejects.toBeInstanceOf(NodeOperationError);
    expect(http).not.toHaveBeenCalled();
  });
});

describe('get many operations', () => {
  const paths: Record<string, string> = {
    booking: '/v1/bookings/',
    payment: '/v1/payments/',
    customer: '/v1/customers/',
    coupon: '/v1/coupons/',
    subscription: '/v1/subscriptions/',
    event: '/v1/events/',
    checkoutPage: '/v1/checkout-pages/',
    form: '/v1/forms/',
  };

  it.each(Object.entries(paths))('%s: GET %s with the limit', async (resource, path) => {
    const { output, http } = await run(
      { resource, operation: 'getAll', returnAll: false, limit: 2, filters: {} },
      [list([{ id: 'a' }, { id: 'b' }, { id: 'c' }], true)]
    );
    const options = requestOptions(http);
    expect(options.method).toBe('GET');
    expect(options.url).toBe(`${BASE}${path}`);
    expect(options.qs).toEqual({ limit: 2 });
    expect(http).toHaveBeenCalledTimes(1);
    expect(output.map((item) => item.json)).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(output.every((item) => (item.pairedItem as IPairedItemData).item === 0)).toBe(true);
  });

  it('caps a single page at 100', async () => {
    const { http } = await run(
      { resource: 'payment', operation: 'getAll', returnAll: false, limit: 500, filters: {} },
      [list([])]
    );
    expect(requestOptions(http).qs).toEqual({ limit: 100 });
  });

  it('returnAll follows the starting_after cursor until has_more is false', async () => {
    const { output, http } = await run(
      { resource: 'booking', operation: 'getAll', returnAll: true, filters: { status: 'paid' } },
      [
        list([{ id: 'b1' }, { id: 'b2' }], true),
        list([{ id: 'b3' }, { id: 'b4' }], true),
        list([{ id: 'b5' }], false),
      ]
    );
    expect(http).toHaveBeenCalledTimes(3);
    expect(requestOptions(http, 0).qs).toEqual({ status: 'paid', limit: 100 });
    expect(requestOptions(http, 1).qs).toEqual({
      status: 'paid',
      limit: 100,
      starting_after: 'b2',
    });
    expect(requestOptions(http, 2).qs).toEqual({
      status: 'paid',
      limit: 100,
      starting_after: 'b4',
    });
    expect(output.map((item) => item.json.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
  });

  it('returnAll stops on an empty page even if has_more is true', async () => {
    const { output, http } = await run(
      { resource: 'customer', operation: 'getAll', returnAll: true, filters: {} },
      [list([{ id: 'c1' }], true), list([], true)]
    );
    expect(http).toHaveBeenCalledTimes(2);
    expect(output).toHaveLength(1);
  });

  it('sends booking filters with booleans as strings and drops empty values', async () => {
    const { http } = await run(
      {
        resource: 'booking',
        operation: 'getAll',
        returnAll: false,
        limit: 10,
        filters: {
          search: 'ada@example.com',
          status: 'paid',
          orderStatus: 'active',
          pageId: 'ev_1',
          customerId: 'cus_1',
          orderId: 'ORD-1',
          couponCode: 'SPRING',
          createdAfter: '2026-01-01T00:00:00.000Z',
          createdBefore: '2026-02-01T00:00:00.000Z',
          abandonmentStatus: 'recovered',
          isComplimentary: false,
          livemode: true,
          unused: '',
        },
      },
      [list([])]
    );
    expect(requestOptions(http).qs).toEqual({
      search: 'ada@example.com',
      status: 'paid',
      orderStatus: 'active',
      pageId: 'ev_1',
      customerId: 'cus_1',
      orderId: 'ORD-1',
      couponCode: 'SPRING',
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-02-01T00:00:00.000Z',
      abandonmentStatus: 'recovered',
      isComplimentary: 'false',
      livemode: 'true',
      limit: 10,
    });
  });

  it('sends page filters', async () => {
    const { http } = await run(
      {
        resource: 'form',
        operation: 'getAll',
        returnAll: false,
        limit: 5,
        filters: { status: 'published', search: 'volunteer', testmode: false },
      },
      [list([])]
    );
    expect(requestOptions(http).qs).toEqual({
      status: 'published',
      search: 'volunteer',
      testmode: 'false',
      limit: 5,
    });
  });

  it('every list filter offered in the UI is a query parameter in the spec', async () => {
    const spec = (await import('../../spec/openapi.json')).default as {
      paths: Record<string, { get?: { parameters?: Array<{ name: string; in: string }> } }>;
    };
    for (const [resource, path] of Object.entries(paths)) {
      const filters = node.description.properties.find(
        (p) =>
          p.name === 'filters' &&
          (p.displayOptions?.show?.resource as string[] | undefined)?.[0] === resource
      );
      const specParams = (spec.paths[path].get?.parameters ?? [])
        .filter((p) => p.in === 'query')
        .map((p) => p.name);
      for (const option of (filters?.options ?? []) as Array<{ name: string }>) {
        expect(specParams, `${resource}.${option.name}`).toContain(option.name);
      }
    }
  });
});

describe('booking create (add an attendee)', () => {
  it('POSTs /v1/bookings/ with tickets keyed by ticket type and the field values', async () => {
    const { output, http } = await run(
      {
        resource: 'booking',
        operation: 'create',
        eventId: 'ev_1',
        tickets: {
          ticket: [
            { ticketTypeId: 'tt_adult', quantity: 2 },
            { ticketTypeId: 'tt_child', quantity: 1 },
            { ticketTypeId: 'tt_adult', quantity: 1 },
          ],
        },
        fields: {
          field: [
            { fieldId: 'f_email', value: 'ada@example.com' },
            { fieldId: 'f_name', value: 'Ada Lovelace' },
            { fieldId: '', value: 'ignored' },
          ],
        },
        additionalFields: {},
      },
      [{ data: { id: 'bk_9', status: 'paid' } }]
    );
    const options = requestOptions(http);
    expect(options.method).toBe('POST');
    expect(options.url).toBe(`${BASE}/v1/bookings/`);
    expect(options.body).toEqual({
      eventId: 'ev_1',
      tickets: { tt_adult: 3, tt_child: 1 },
      fields: [
        { fieldId: 'f_email', value: 'ada@example.com' },
        { fieldId: 'f_name', value: 'Ada Lovelace' },
      ],
    });
    expect(output[0].json).toEqual({ id: 'bk_9', status: 'paid' });
  });

  it('sends complimentary, payment type, coupon and pay-what-you-want amounts', async () => {
    const { http } = await run(
      {
        resource: 'booking',
        operation: 'create',
        eventId: 'ev_1',
        tickets: { ticket: [{ ticketTypeId: 'tt_pwyw', quantity: 1 }] },
        fields: { field: [{ fieldId: 'f_email', value: 'ada@example.com' }] },
        additionalFields: {
          complimentary: true,
          manualType: 'invoice',
          couponId: 'cp_1',
          ticketPwywAmounts: { amount: [{ ticketTypeId: 'tt_pwyw', amount: 1500 }] },
        },
      },
      [{ data: {} }]
    );
    expect(requestOptions(http).body).toMatchObject({
      complimentary: true,
      paymentOption: { manualType: 'invoice' },
      couponId: 'cp_1',
      ticketPwywAmounts: { tt_pwyw: 1500 },
    });
  });

  it('needs at least the email field', async () => {
    const { context, http } = executeContext(
      {
        resource: 'booking',
        operation: 'create',
        eventId: 'ev_1',
        tickets: { ticket: [{ ticketTypeId: 'tt_adult', quantity: 1 }] },
        fields: {},
        additionalFields: {},
      },
      []
    );
    await expect(node.execute.call(context)).rejects.toThrow('Add at least the email field');
    expect(http).not.toHaveBeenCalled();
  });

  it('needs at least one ticket', async () => {
    const { context, http } = executeContext(
      {
        resource: 'booking',
        operation: 'create',
        eventId: 'ev_1',
        tickets: {},
        fields: {},
        additionalFields: {},
      },
      []
    );
    await expect(node.execute.call(context)).rejects.toThrow('Add at least one ticket');
    expect(http).not.toHaveBeenCalled();
  });
});

describe('date filters', () => {
  async function createdAfter(value: unknown, timezone?: string) {
    const { http } = await run(
      {
        resource: 'payment',
        operation: 'getAll',
        returnAll: false,
        limit: 10,
        filters: { createdAfter: value },
      },
      [list([])],
      { timezone }
    );
    return requestOptions(http).qs?.createdAfter;
  }

  it('reads a date picker value in the workflow timezone, New York', async () => {
    expect(await createdAfter('2026-10-01T00:00:00', 'America/New_York')).toBe(
      '2026-10-01T04:00:00.000Z'
    );
    expect(await createdAfter('2026-01-15T09:30:00', 'America/New_York')).toBe(
      '2026-01-15T14:30:00.000Z'
    );
  });

  it('reads a date picker value in the workflow timezone, London', async () => {
    expect(await createdAfter('2026-07-01T00:00:00', 'Europe/London')).toBe(
      '2026-06-30T23:00:00.000Z'
    );
    expect(await createdAfter('2026-12-01T08:00:00', 'Europe/London')).toBe(
      '2026-12-01T08:00:00.000Z'
    );
  });

  it('reads a wall time just after a daylight saving change', async () => {
    expect(await createdAfter('2026-03-08T03:30:00', 'America/New_York')).toBe(
      '2026-03-08T07:30:00.000Z'
    );
  });

  it('converts a value with an offset directly', async () => {
    expect(await createdAfter('2026-10-01T00:00:00.000-04:00', 'Europe/London')).toBe(
      '2026-10-01T04:00:00.000Z'
    );
  });

  it('keeps a UTC value', async () => {
    expect(await createdAfter('2026-10-01T04:00:00.000Z', 'Europe/London')).toBe(
      '2026-10-01T04:00:00.000Z'
    );
  });

  it('accepts a date object from an expression', async () => {
    expect(await createdAfter(new Date('2026-10-01T04:00:00.000Z'))).toBe(
      '2026-10-01T04:00:00.000Z'
    );
    expect(await createdAfter({ toISO: () => '2026-10-01T00:00:00.000+01:00' })).toBe(
      '2026-09-30T23:00:00.000Z'
    );
  });

  it('rejects a value that is not a date before calling the API', async () => {
    const { context, http } = executeContext(
      {
        resource: 'payment',
        operation: 'getAll',
        returnAll: false,
        limit: 10,
        filters: { createdBefore: 'next tuesday' },
      },
      []
    );
    await expect(node.execute.call(context)).rejects.toThrow(NodeOperationError);
    expect(http).not.toHaveBeenCalled();
  });

  it('converts a coupon redeem-by date', async () => {
    const { http } = await run(
      {
        resource: 'coupon',
        operation: 'create',
        label: 'Spring',
        code: 'SPRING',
        discountType: 'percent',
        percentOff: 10,
        duration: 'once',
        additionalFields: { redeemBy: '2026-12-31T23:59:59' },
      },
      [{ data: {} }],
      { timezone: 'Europe/London' }
    );
    expect((requestOptions(http).body as IDataObject).redeemBy).toBe('2026-12-31T23:59:59.000Z');
  });
});

describe('coupon create', () => {
  it('creates a percentage coupon', async () => {
    const { http } = await run(
      {
        resource: 'coupon',
        operation: 'create',
        label: 'Welcome',
        code: 'WELCOME10',
        discountType: 'percent',
        percentOff: 10,
        duration: 'once',
        additionalFields: {},
      },
      [{ data: { id: 'cp_1' } }]
    );
    const options = requestOptions(http);
    expect(options.method).toBe('POST');
    expect(options.url).toBe(`${BASE}/v1/coupons/`);
    expect(options.body).toEqual({
      label: 'Welcome',
      code: 'WELCOME10',
      duration: 'once',
      percentOff: 10,
    });
  });

  it('creates a repeating fixed-amount coupon limited to pages and ticket types', async () => {
    const { http } = await run(
      {
        resource: 'coupon',
        operation: 'create',
        label: 'Members',
        code: 'MEMBER25',
        discountType: 'amount',
        amountOff: 2500,
        currency: 'gbp',
        duration: 'repeating',
        durationInMonths: 3,
        additionalFields: {
          maxRedemptions: 50,
          redeemBy: '2026-12-31T23:59:59.000Z',
          pageIds: 'pg_1, pg_2,',
          ticketTypeIds: 'tt_1',
          appliesToSetupFee: true,
          appliesToTicketFees: false,
        },
      },
      [{ data: {} }]
    );
    expect(requestOptions(http).body).toEqual({
      label: 'Members',
      code: 'MEMBER25',
      duration: 'repeating',
      durationInMonths: 3,
      amountOff: 2500,
      currency: 'gbp',
      maxRedemptions: 50,
      redeemBy: '2026-12-31T23:59:59.000Z',
      pageIds: ['pg_1', 'pg_2'],
      ticketTypeIds: ['tt_1'],
      appliesToSetupFee: true,
      appliesToTicketFees: false,
    });
  });
});

describe('customer update', () => {
  it('PATCHes only the fields that were set, with nested addresses', async () => {
    const { http } = await run(
      {
        resource: 'customer',
        operation: 'update',
        customerId: 'cus_1',
        updateFields: {
          name: 'Ada Lovelace',
          phone: '+44 20 7946 0000',
          companyName: '',
          address: { address: { line1: '1 Main St', city: 'London', country: 'GB', state: '' } },
          shippingAddress: { address: { postalCode: 'N1 9GU' } },
        },
      },
      [{ data: { id: 'cus_1' } }]
    );
    const options = requestOptions(http);
    expect(options.method).toBe('PATCH');
    expect(options.url).toBe(`${BASE}/v1/customers/cus_1`);
    expect(options.body).toEqual({
      name: 'Ada Lovelace',
      phone: '+44 20 7946 0000',
      address: { line1: '1 Main St', city: 'London', country: 'GB' },
      shipping: { address: { postalCode: 'N1 9GU' } },
    });
  });

  it('refuses an update with nothing to change', async () => {
    const { context, http } = executeContext(
      { resource: 'customer', operation: 'update', customerId: 'cus_1', updateFields: {} },
      []
    );
    await expect(node.execute.call(context)).rejects.toThrow('Add at least one field');
    expect(http).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it("surfaces an API error as NodeApiError with the API's message", async () => {
    const { context } = executeContext(
      { resource: 'booking', operation: 'get', bookingId: 'missing', options: {} },
      [apiError(404, 'Booking not found')]
    );
    const error = await node.execute.call(context).catch((e) => e);
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('Booking not found');
    expect(error.httpCode).toBe('404');
  });

  it('puts validation details in the description', async () => {
    const { context } = executeContext(
      {
        resource: 'coupon',
        operation: 'create',
        label: 'x',
        code: 'X',
        discountType: 'percent',
        percentOff: 10,
        duration: 'once',
        additionalFields: {},
      },
      [apiError(400, 'Invalid coupon data', [{ param: 'code', message: 'Code already exists' }])]
    );
    const error = await node.execute.call(context).catch((e) => e);
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('Invalid coupon data');
    expect(error.description).toBe('code: Code already exists');
    expect(error.httpCode).toBe('400');
  });

  it("keeps the API's message when n8n already wrapped the error in NodeApiError", () => {
    const wrapped = new NodeApiError(TEST_NODE, apiError(401, 'Invalid API key') as never);
    const error = toNodeApiError(TEST_NODE, wrapped);
    expect(error.message).toBe('Invalid API key');
    expect(error.httpCode).toBe('401');
  });

  it('continueOnFail returns the error as an item and keeps going', async () => {
    const { output } = await run(
      { resource: 'payment', operation: 'get', paymentId: 'p1', options: {} },
      [apiError(404, 'Payment not found'), { data: { id: 'p1' } }],
      { continueOnFail: true, items: 2 }
    );
    expect(output).toEqual([
      { json: { error: 'Payment not found' }, pairedItem: { item: 0 } },
      { json: { id: 'p1' }, pairedItem: { item: 1 } },
    ]);
  });
});

describe('load options', () => {
  const event = {
    data: {
      id: 'ev_1',
      ticketGroups: [
        { name: 'General', ticketTypes: [{ id: 'tt_1', name: 'Adult' }] },
        { name: 'Extras', ticketTypes: [{ id: 'tt_2', name: 'Parking' }] },
      ],
      fields: [
        { id: 'f_email', label: 'Email', required: true },
        { id: 'f_old', label: 'Old', disabled: true },
        { id: 'f_note', label: 'Notes' },
      ],
    },
  };

  it('lists every event across pages', async () => {
    const { context, http } = loadOptionsContext({}, [
      list([{ id: 'ev_1', title: 'Summer camp' }], true),
      list([{ id: 'ev_2', name: 'Gala' }]),
    ]);
    const options = await node.methods.loadOptions.getEvents.call(context);
    expect(options).toEqual([
      { name: 'Summer camp', value: 'ev_1' },
      { name: 'Gala', value: 'ev_2' },
    ]);
    expect(requestOptions(http, 1).qs).toEqual({ limit: 100, starting_after: 'ev_1' });
  });

  it("lists the selected event's ticket types", async () => {
    const { context, http } = loadOptionsContext({ eventId: 'ev_1' }, [event]);
    const options = await node.methods.loadOptions.getTicketTypes.call(context);
    expect(requestOptions(http).url).toBe(`${BASE}/v1/events/ev_1`);
    expect(options).toEqual([
      { name: 'General: Adult', value: 'tt_1' },
      { name: 'Extras: Parking', value: 'tt_2' },
    ]);
  });

  it("lists the selected event's enabled fields", async () => {
    const { context } = loadOptionsContext({ eventId: 'ev_1' }, [event]);
    const options = await node.methods.loadOptions.getEventFields.call(context);
    expect(options).toEqual([
      { name: 'Email', value: 'f_email', description: 'Required' },
      { name: 'Notes', value: 'f_note', description: undefined },
    ]);
  });

  it('returns nothing until an event is chosen', async () => {
    const { context, http } = loadOptionsContext({}, []);
    expect(await node.methods.loadOptions.getTicketTypes.call(context)).toEqual([]);
    expect(http).not.toHaveBeenCalled();
  });
});
