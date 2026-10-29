import { describe, expect, it } from 'vitest';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';
import { loadFunction } from './functions';
import { checkBodyKeys, findOperation, type SpecOperation, validateBody } from './spec';

const app = loadApp();
const bookingBody = loadFunction('bookingBody') as (p: object) => Record<string, unknown>;
const couponBody = loadFunction('couponBody') as (p: object) => Record<string, unknown>;
const customerBody = loadFunction('customerBody') as (p: object) => Record<string, unknown>;

const EVENT = '6'.repeat(24);
const TICKET = '1'.repeat(24);
const OTHER_TICKET = '3'.repeat(24);
const FIELD = '2'.repeat(24);
const PAGE = '7'.repeat(24);
const PRICE = '8'.repeat(24);

const bookingOp = findOperation('POST', '/v1/bookings/')!;
const couponOp = findOperation('POST', '/v1/coupons/')!;
const customerOp = findOperation('PATCH', '/v1/customers/' + '6'.repeat(24))!;

const ok = (op: SpecOperation, body: unknown) => {
  expect(validateBody(op, body)).toEqual([]);
  expect(checkBodyKeys(op, body)).toMatchObject({ unknown: [], deprecated: [] });
};

describe('bookingBody', () => {
  const booking = (overrides: object) =>
    bookingBody({
      eventId: EVENT,
      tickets: [{ ticketTypeId: TICKET, quantity: 1 }],
      fields: [{ fieldId: FIELD, value: 'a@b.co' }],
      ...overrides,
    });

  it('folds ticket rows into the keyed tickets object, summing duplicates', () => {
    const body = booking({
      tickets: [
        { ticketTypeId: TICKET, quantity: 1 },
        { ticketTypeId: TICKET, quantity: 2 },
        { ticketTypeId: OTHER_TICKET, quantity: 1 },
      ],
      recordAs: 'complimentary',
    });
    expect(body).toEqual({
      eventId: EVENT,
      tickets: { [TICKET]: 3, [OTHER_TICKET]: 1 },
      fields: [{ fieldId: FIELD, value: 'a@b.co' }],
      complimentary: true,
    });
    ok(bookingOp, body);
  });

  it('records a complimentary booking without a payment option', () => {
    const body = booking({ recordAs: 'complimentary' });
    expect(body.complimentary).toBe(true);
    expect(body).not.toHaveProperty('paymentOption');
    ok(bookingOp, body);
  });

  it.each(['invoice', 'cash_on_delivery'])(
    'records a booking to be paid by %s as a manual payment option',
    (manualType) => {
      const body = booking({ recordAs: manualType });
      expect(body.paymentOption).toEqual({ manualType });
      expect(body).not.toHaveProperty('complimentary');
      ok(bookingOp, body);
    }
  );

  it('sends pwyw amounts and a chosen coupon on a manual booking', () => {
    const body = booking({
      tickets: [{ ticketTypeId: TICKET, quantity: 1, pwywAmount: 1500 }],
      recordAs: 'invoice',
      couponId: PRICE,
    });
    expect(body).toMatchObject({
      paymentOption: { manualType: 'invoice' },
      ticketPwywAmounts: { [TICKET]: 1500 },
      couponId: PRICE,
    });
    ok(bookingOp, body);
    expect(booking({ recordAs: 'invoice', couponId: '' })).not.toHaveProperty('couponId');
  });

  it('drops the coupon from a complimentary booking', () => {
    const body = booking({ recordAs: 'complimentary', couponId: PRICE });
    expect(body).not.toHaveProperty('couponId');
    ok(bookingOp, body);
  });

  it('passes an address object through as the field value', () => {
    const address = {
      billing: {
        line1: '1 High Street',
        city: 'London',
        region: 'Greater London',
        postalCode: 'SW1A 1AA',
        country: 'GB',
      },
    };
    const body = booking({
      fields: [
        { fieldId: FIELD, value: 'a@b.co' },
        { fieldId: PAGE, value: address },
      ],
      recordAs: 'invoice',
    });
    expect(body.fields).toEqual([
      { fieldId: FIELD, value: 'a@b.co' },
      { fieldId: PAGE, value: address },
    ]);
    ok(bookingOp, body);
  });

  it('sends an array value as the option values of a multi-select field', () => {
    const body = booking({
      fields: [
        { fieldId: FIELD, value: 'a@b.co' },
        { fieldId: PAGE, value: ['google', 'facebook'] },
      ],
      recordAs: 'invoice',
    });
    expect(body.fields).toEqual([
      { fieldId: FIELD, value: 'a@b.co' },
      { fieldId: PAGE, values: ['google', 'facebook'] },
    ]);
    ok(bookingOp, body);
  });

  it('drops fields with no value', () => {
    const body = booking({
      fields: [
        { fieldId: FIELD, value: 'a@b.co' },
        { fieldId: OTHER_TICKET, value: '' },
        { fieldId: PAGE, value: [] },
      ],
      recordAs: 'cash_on_delivery',
    });
    expect(body.fields).toEqual([{ fieldId: FIELD, value: 'a@b.co' }]);
  });

  it.each([undefined, '', 'paid'])('rejects a booking recorded as %j', (recordAs) =>
    expect(() => booking({ recordAs })).toThrow('Choose how to record the booking')
  );

  it('rejects a booking without tickets', () => {
    expect(() => booking({ tickets: [], recordAs: 'complimentary' })).toThrow(
      'Add at least one ticket'
    );
    expect(() => booking({ tickets: undefined, recordAs: 'complimentary' })).toThrow(
      'Add at least one ticket'
    );
    expect(() =>
      booking({ tickets: [{ ticketTypeId: TICKET, quantity: 0 }], recordAs: 'complimentary' })
    ).toThrow('Add at least one ticket');
  });
});

describe('couponBody', () => {
  it('sends only the chosen discount and never pageIds', () => {
    const body = couponBody({
      label: 'L',
      code: 'C',
      discountType: 'percent',
      percentOff: 10,
      amountOff: 500,
      currency: 'usd',
      duration: 'once',
      durationInMonths: 3,
      rules: [{ pageId: PAGE, appliesTo: 'wholeOrder' }],
    });
    expect(body).toMatchObject({ percentOff: 10, duration: 'once' });
    expect(body).not.toHaveProperty('amountOff');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('durationInMonths');
    expect(body).not.toHaveProperty('pageIds');
    expect(body).not.toHaveProperty('ticketTypeIds');
    ok(couponOp, body);
    const amount = couponBody({
      label: 'L',
      code: 'C',
      discountType: 'amount',
      percentOff: 10,
      amountOff: 500,
      currency: 'USD',
      duration: 'repeating',
      durationInMonths: 2,
    });
    expect(amount).toEqual({
      label: 'L',
      code: 'C',
      duration: 'repeating',
      durationInMonths: 2,
      amountOff: 500,
      currency: 'usd',
    });
    ok(couponOp, amount);
  });

  it('sends the optional limits, an ISO redeem by date and filled rule lists only', () => {
    const body = couponBody({
      label: 'L',
      code: 'C',
      discountType: 'percent',
      percentOff: 25,
      duration: 'forever',
      maxRedemptions: 10,
      redeemBy: new Date('2026-12-31T23:59:00.000Z'),
      appliesToSetupFee: true,
      appliesToTicketFees: false,
      rules: [
        { pageId: PAGE, appliesTo: 'prices', priceIds: [PRICE, ''], ticketTypeIds: [] },
        { pageId: '', appliesTo: '' },
      ],
    });
    expect(body).toMatchObject({
      maxRedemptions: 10,
      redeemBy: '2026-12-31T23:59:00.000Z',
      appliesToSetupFee: true,
      appliesToTicketFees: false,
      rules: [{ pageId: PAGE, appliesTo: 'prices', priceIds: [PRICE] }],
    });
    ok(couponOp, body);
    expect(
      couponBody({ label: 'L', code: 'C', duration: 'once', redeemBy: '' })
    ).not.toHaveProperty('redeemBy');
  });
});

describe('customerBody', () => {
  it('patches only filled customer fields', () => {
    const body = customerBody({
      name: 'A',
      email: '',
      address: { line1: '', city: '' },
      shipping: { address: { line1: '1 St', city: 'X', country: 'US' } },
    });
    expect(body).toEqual({
      name: 'A',
      shipping: { address: { line1: '1 St', city: 'X', country: 'US' } },
    });
    ok(customerOp, body);
  });

  it('keeps every filled field and drops the customer ID', () => {
    const body = customerBody({
      customerId: '6'.repeat(24),
      name: 'A',
      email: 'a@b.co',
      phone: '+441234',
      companyName: 'Club',
      billingEmail: 'bills@b.co',
      address: {
        line1: '1 St',
        line2: 'Flat 2',
        city: 'X',
        state: 'Y',
        postalCode: 'Z1',
        country: 'GB',
      },
      shipping: { name: 'B', phone: '+449876', address: { line1: '', postalCode: 'Z2' } },
    });
    expect(body).not.toHaveProperty('customerId');
    expect(body.shipping).toEqual({ name: 'B', phone: '+449876', address: { postalCode: 'Z2' } });
    ok(customerOp, body);
  });

  it('rejects an update with nothing filled in', () => {
    expect(() => customerBody({})).toThrow('Fill in at least one field to update');
    expect(() =>
      customerBody({ customerId: '6'.repeat(24), name: '', address: { city: '' }, shipping: {} })
    ).toThrow('Fill in at least one field to update');
  });
});

describe('write modules', () => {
  it.each([
    ['createBooking', 'bookingBody', 'create'],
    ['createCoupon', 'couponBody', 'create'],
    ['updateCustomer', 'customerBody', 'update'],
  ])('%s calls %s', (id, fn, crud) => {
    const m = app.get('module', id);
    const c = m.code.communication as Record<string, any>;
    expect(c.body).toBe(`{{${fn}(parameters)}}`);
    expect(c.response).toEqual({ output: '{{body.data}}' });
    expect(conformance({ ...requestShape(c), bodyKeys: [] })).toEqual([]);
    expect(m.meta).toMatchObject({
      moduleType: 'action',
      actionCrud: crud,
      connection: 'checkoutPage',
    });
    expect(m.code.staticParams).toEqual([]);
    expect(m.code.scope).toEqual([]);
  });

  it('books onto an event picked from a list, so ticket types and fields can load', () => {
    const params = app.get('module', 'createBooking').code.mappableParams as any[];
    expect(params[0]).toMatchObject({
      name: 'eventId',
      type: 'select',
      options: 'rpc://listEvents',
      required: true,
    });
    const tickets = params.find((p) => p.name === 'tickets');
    expect(tickets).toMatchObject({
      type: 'array',
      required: true,
      help: 'Add one row per ticket type.',
    });
    expect(tickets.spec[0]).toMatchObject({
      name: 'ticketTypeId',
      options: 'rpc://listTicketTypes',
    });
    expect(tickets.spec[2]).toMatchObject({ name: 'pwywAmount', type: 'uinteger' });
    expect(params.map((p) => p.name)).not.toContain('complimentary');
    expect(params.map((p) => p.name)).not.toContain('manualType');
    expect(params.find((p) => p.name === 'recordAs')).toEqual({
      name: 'recordAs',
      type: 'select',
      label: 'Record as',
      required: true,
      options: [
        { label: 'Complimentary', value: 'complimentary' },
        { label: 'To be paid by invoice', value: 'invoice' },
        { label: 'To be paid on arrival', value: 'cash_on_delivery' },
      ],
    });
    expect(params.find((p) => p.name === 'couponId')).toMatchObject({
      help: 'Ignored for complimentary bookings.',
    });
    const fields = params.find((p) => p.name === 'fields');
    expect(fields).toMatchObject({
      type: 'array',
      required: true,
      help: 'Include the email field.',
    });
    expect(fields.spec[0]).toMatchObject({ name: 'fieldId', options: 'rpc://listEventFields' });
    expect(fields.spec[1]).toMatchObject({ name: 'value', type: 'any' });
  });

  it('updates the customer named in the URL', () => {
    const m = app.get('module', 'updateCustomer');
    expect((m.code.communication as any).url).toBe('/v1/customers/{{parameters.customerId}}');
    expect((m.code.mappableParams as any[])[0]).toMatchObject({
      name: 'customerId',
      options: 'rpc://listCustomers',
      required: true,
    });
  });
});
