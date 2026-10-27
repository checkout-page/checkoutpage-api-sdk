import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { CheckoutPage } from '../nodes/CheckoutPage/CheckoutPage.node';
import { SIMPLIFIED_FIELDS } from '../nodes/CheckoutPage/simplify';
import { executeContext } from './helpers';

const node = new CheckoutPage();

async function run(params: IDataObject, responses: unknown[]) {
  const { context } = executeContext(params, responses);
  return (await node.execute.call(context))[0];
}

function list(data: IDataObject[]) {
  return { data, has_more: false, total: data.length };
}

function getMany(resource: string, simplify: boolean): IDataObject {
  return { resource, operation: 'getAll', returnAll: false, limit: 10, filters: {}, simplify };
}

const booking = {
  id: 'bk_1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  eventTitle: 'Summer camp',
  amount: 2500,
  currency: 'usd',
  status: 'paid',
  orderId: 'ORD-1',
  pageId: 'ev_1',
  createdAt: '2026-10-01T09:00:00.000Z',
  sellerId: 'sel_1',
  userAgent: 'Mozilla/5.0',
  tickets: [{ id: 'tt_1', quantity: 1 }],
};

const simplifiedBooking = {
  id: 'bk_1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  eventTitle: 'Summer camp',
  amount: 2500,
  currency: 'usd',
  status: 'paid',
  orderId: 'ORD-1',
  pageId: 'ev_1',
  createdAt: '2026-10-01T09:00:00.000Z',
};

describe('simplify', () => {
  it('is offered on every get and get many, on by default', () => {
    const shown: Record<string, string[]> = {};
    for (const property of node.description.properties) {
      if (property.name !== 'simplify') continue;
      expect(property.type).toBe('boolean');
      expect(property.default).toBe(true);
      expect(property.displayName).toBe('Simplify');
      expect(property.description).toBe(
        'Whether to return a simplified version of the response instead of the raw data'
      );
      const resource = (property.displayOptions?.show?.resource as string[])[0];
      shown[resource] = property.displayOptions?.show?.operation as string[];
    }
    expect(shown).toEqual({
      booking: ['get', 'getAll'],
      checkoutPage: ['get', 'getAll'],
      coupon: ['getAll'],
      customer: ['get', 'getAll'],
      event: ['get', 'getAll'],
      form: ['get', 'getAll'],
      payment: ['get', 'getAll'],
      subscription: ['get', 'getAll'],
    });
  });

  it('keeps at most 10 fields per resource, starting with the id', () => {
    for (const [resource, fields] of Object.entries(SIMPLIFIED_FIELDS)) {
      expect(fields.length, resource).toBeLessThanOrEqual(10);
      expect(fields[0], resource).toBe('id');
    }
  });

  it('get returns the picked fields when on', async () => {
    const output = await run(
      { resource: 'booking', operation: 'get', bookingId: 'bk_1', options: {}, simplify: true },
      [{ data: booking }]
    );
    expect(output).toEqual([{ json: simplifiedBooking, pairedItem: { item: 0 } }]);
  });

  it('get returns the raw record when off', async () => {
    const output = await run(
      { resource: 'booking', operation: 'get', bookingId: 'bk_1', options: {}, simplify: false },
      [{ data: booking }]
    );
    expect(output[0].json).toEqual(booking);
  });

  it('get many simplifies every record when on', async () => {
    const output = await run(getMany('booking', true), [
      list([booking, { ...booking, id: 'bk_2' }]),
    ]);
    expect(output.map((item) => item.json)).toEqual([
      simplifiedBooking,
      { ...simplifiedBooking, id: 'bk_2' },
    ]);
  });

  it('get many returns raw records when off', async () => {
    const output = await run(getMany('booking', false), [list([booking])]);
    expect(output[0].json).toEqual(booking);
  });

  it('flattens nested values', async () => {
    const output = await run(
      { resource: 'customer', operation: 'get', customerId: 'cus_1', simplify: true },
      [
        {
          data: {
            id: 'cus_1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            address: { city: 'London', country: 'GB', line1: '1 Main St' },
            stripeCustomerId: 'cus_stripe',
          },
        },
      ]
    );
    expect(output[0].json).toEqual({
      id: 'cus_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      city: 'London',
      country: 'GB',
    });
  });

  it.each<[string, IDataObject, IDataObject]>([
    [
      'payment',
      { id: 'pay_1', productTitle: 'Gold', amount: 1000, stripeChargeId: 'ch_x' },
      { id: 'pay_1', productTitle: 'Gold', amount: 1000 },
    ],
    [
      'subscription',
      { id: 'sub_1', interval: 'month', currentPeriodEnd: '2026-11-01', stripeSubscriptionId: 'x' },
      { id: 'sub_1', interval: 'month', currentPeriodEnd: '2026-11-01' },
    ],
    [
      'coupon',
      { id: 'co_1', code: 'SPRING', percentOff: 10, stripeCouponId: 'x', deleted: false },
      { id: 'co_1', code: 'SPRING', percentOff: 10 },
    ],
    [
      'event',
      {
        id: 'ev_1',
        title: 'Summer camp',
        eventDetails: { startDate: '2026-07-01T09:00:00.000Z', location: 'Hall' },
        ticketGroups: [],
      },
      { id: 'ev_1', title: 'Summer camp', startDate: '2026-07-01T09:00:00.000Z', location: 'Hall' },
    ],
    [
      'checkoutPage',
      { id: 'cp_1', name: 'Membership', product: { title: 'Gold', price: 1000 }, fields: [] },
      { id: 'cp_1', name: 'Membership', productTitle: 'Gold' },
    ],
    [
      'form',
      { id: 'fm_1', title: 'Volunteer', submissionCount: 3, formLayout: [] },
      { id: 'fm_1', title: 'Volunteer', submissionCount: 3 },
    ],
  ])('%s get many picks its own fields', async (resource, record, expected) => {
    const output = await run(getMany(resource, true), [list([record])]);
    expect(output[0].json).toEqual(expected);
  });

  it('page get simplifies too', async () => {
    const output = await run(
      { resource: 'event', operation: 'get', pageId: 'ev_1', simplify: true },
      [{ data: { id: 'ev_1', title: 'Summer camp', fields: [] } }]
    );
    expect(output[0].json).toEqual({ id: 'ev_1', title: 'Summer camp' });
  });
});
