import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  NotFoundError,
  ValidationError,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('BookingResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('get', () => {
    it('should fetch a single booking by id', async () => {
      const seed = await client.bookings.list({ limit: 1 });
      if (seed.data.length === 0) throw Error('No bookings available to fetch');

      const expected = seed.data[0];
      const result = await client.bookings.get(expected.id);

      expect(result).toHaveProperty('data');
      expect(result.data.id).toBe(expected.id);
      expect(result.data.amount).toBe(expected.amount);
      expect(result.data.status).toBe(expected.status);
      expect(result.data).toHaveProperty('createdAt');
      expect(result.data).toHaveProperty('updatedAt');
    });

    it('should throw a 404 for a booking that does not exist', async () => {
      await expect(client.bookings.get('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundError);
    });

    it('should throw a 404 for a payment id, which is not a booking', async () => {
      const payments = await client.payments.list({ limit: 1 });
      if (payments.data.length === 0) return;

      await expect(client.bookings.get(payments.data[0].id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('downloadTicketPdf', () => {
    it('downloads the ticket PDF as bytes for a booking that has one', async () => {
      const seed = await client.bookings.list({ limit: 5, status: 'paid' });
      if (seed.data.length === 0) throw Error('No bookings available to download a PDF for');

      let pdf: ArrayBuffer | null = null;
      for (const booking of seed.data) {
        try {
          pdf = await client.bookings.downloadTicketPdf(booking.id);
          break;
        } catch (err) {
          // Unpaid/abandoned bookings have no PDF; keep looking.
          if (err instanceof NotFoundError) continue;
          throw err;
        }
      }

      if (!pdf) throw Error('No booking with a ticket PDF found in the first page');

      expect(pdf.byteLength).toBeGreaterThan(0);
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    });

    it('should throw a 404 for a booking that does not exist', async () => {
      await expect(client.bookings.downloadTicketPdf('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('list', () => {
    it('should fetch a list of bookings', async () => {
      const result = await client.bookings.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('should return proper structure for booking objects', async () => {
      const result = await client.bookings.list({ limit: 1 });
      const booking = result.data[0];

      expect(result.data.length).toBe(1);
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('status');
      expect(booking).toHaveProperty('amount');
      expect(booking).toHaveProperty('createdAt');
      expect(booking).toHaveProperty('updatedAt');
      expect(booking).toHaveProperty('taxBreakdown');

      expect(typeof booking.id).toBe('string');
      expect(typeof booking.status).toBe('string');
      expect(typeof booking.amount).toBe('number');
      expect(Array.isArray(booking.taxBreakdown)).toBe(true);
    });

    it('should expose both deprecated snake_case and camelCase payment method expiry fields when available', async () => {
      const result = await client.bookings.list({ limit: 25 });
      const bookingWithExpiryFields = result.data.find(
        (booking) =>
          booking.paymentMethod?.expMonth != null && booking.paymentMethod?.expYear != null
      );

      if (!bookingWithExpiryFields?.paymentMethod) {
        throw new Error(
          'No booking with expMonth/expYear found for payment method expiry field test'
        );
      }

      const paymentMethod = bookingWithExpiryFields.paymentMethod as Record<string, unknown>;

      expect(paymentMethod).toHaveProperty('expMonth');
      expect(paymentMethod).toHaveProperty('expYear');
      expect(paymentMethod.expMonth).toBe(paymentMethod.exp_month);
      expect(paymentMethod.expYear).toBe(paymentMethod.exp_year);
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.bookings.list({ limit: 5 });
      expect(result.data.length).toEqual(5);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.bookings.list({ limit: 1 });

      const secondPage = await client.bookings.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(secondPage.data.length).toBeGreaterThan(0);
      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      const moveAwayFromStart = await client.bookings.list({ limit: 5 });

      const firstPage = await client.bookings.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });

      const previousPage = await client.bookings.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      expect(previousPage.data.length).toBeGreaterThan(0);
      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
    });

    it('should filter bookings by search query', async () => {
      const result = await client.bookings.list({
        search: 'integration@checkoutpage.com',
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter bookings by status', async () => {
      const result = await client.bookings.list({ status: 'paid', limit: 10 });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);

      for (const booking of result.data) {
        expect(booking.status).toBe('paid');
      }
    });

    it('should filter bookings by pageId', async () => {
      const allBookings = await client.bookings.list({ limit: 5 });

      const pageId = allBookings.data[0].pageId;
      const filtered = await client.bookings.list({ pageId, limit: 10 });

      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThanOrEqual(1);

      for (const booking of filtered.data) {
        expect(booking.pageId).toBe(pageId);
      }
    });

    it('should filter bookings by customerId', async () => {
      const seed = await client.bookings.list({ limit: 10 });
      const bookingWithCustomer = seed.data.find((b) => b.customerId != null);
      if (!bookingWithCustomer?.customerId) throw Error();

      const result = await client.bookings.list({ customerId: bookingWithCustomer.customerId });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const booking of result.data) {
        expect(booking.customerId).toBe(bookingWithCustomer.customerId);
      }
    });

    it('should filter bookings by exact orderId', async () => {
      const seed = await client.bookings.list({ limit: 10 });
      const bookingWithOrder = seed.data.find((b) => b.orderId != null);
      if (!bookingWithOrder?.orderId) throw Error();

      const result = await client.bookings.list({ orderId: bookingWithOrder.orderId });

      expect(result.data.length).toBeGreaterThan(0);
      for (const booking of result.data) {
        expect(booking.orderId).toBe(bookingWithOrder.orderId);
      }
    });

    it('should return empty results for a non-existent orderId', async () => {
      const result = await client.bookings.list({ orderId: 'NON-EXISTENT-ORDER-XYZ-99999' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter bookings by couponCode', async () => {
      const seed = await client.bookings.list({ limit: 20 });
      const bookingWithCoupon = seed.data.find((b) => b.coupon?.code != null);
      if (!bookingWithCoupon?.coupon?.code) {
        // No coupon bookings in the result set — skip gracefully
        return;
      }

      const result = await client.bookings.list({ couponCode: bookingWithCoupon.coupon.code });

      expect(result.data.length).toBeGreaterThan(0);
      for (const booking of result.data) {
        expect(booking.coupon?.code).toBe(bookingWithCoupon.coupon.code);
      }
    });

    it('should filter bookings by createdAfter', async () => {
      const createdAfter = '2020-01-01T00:00:00Z';
      const result = await client.bookings.list({ createdAfter });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const booking of result.data) {
        expect(new Date(booking.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(createdAfter).getTime()
        );
      }
    });

    it('should filter bookings by createdBefore', async () => {
      const createdBefore = '2099-01-01T00:00:00Z';
      const result = await client.bookings.list({ createdBefore });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const booking of result.data) {
        expect(new Date(booking.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(createdBefore).getTime()
        );
      }
    });

    it('should return empty results when createdAfter is in the future', async () => {
      const result = await client.bookings.list({ createdAfter: '2099-01-01T00:00:00Z' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty results when createdBefore is far in the past', async () => {
      const result = await client.bookings.list({ createdBefore: '2000-01-01T00:00:00Z' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter abandoned bookings', async () => {
      const result = await client.bookings.list({ abandonmentStatus: 'abandoned' });

      expect(Array.isArray(result.data)).toBe(true);
      for (const booking of result.data) {
        expect(booking.isAbandoned).toBe(true);
        expect(booking.recoveredAt).toBeFalsy();
        expect(booking.abandonmentStatus).toEqual('abandoned');
      }
    });

    it('should filter recovered bookings', async () => {
      const result = await client.bookings.list({ abandonmentStatus: 'recovered' });

      expect(Array.isArray(result.data)).toBe(true);
      for (const booking of result.data) {
        expect(booking.isAbandoned).toBe(true);
        expect(booking.recoveredAt).toBeTruthy();
        expect(booking.abandonmentStatus).toEqual('recovered');
      }
    });

    it('should return empty array when search has no matches', async () => {
      const result = await client.bookings.list({ search: 'nonexistent-booking-query-12345-xyz' });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(0);
    });

    it('should include total count', async () => {
      const result = await client.bookings.list();
      expect(typeof result.total).toBe('number');
      expect(result.total).toBeGreaterThan(0);
    });

    it('should return consistent pagination info', async () => {
      const result = await client.bookings.list({ limit: 10 });

      expect(result.has_more).toBe(typeof result.has_more === 'boolean' ? result.has_more : false);
      expect(result.total).toBeGreaterThanOrEqual(result.data.length);
    });

    it('should include pageSlug when a page is associated', async () => {
      const result = await client.bookings.list({ limit: 10 });

      const bookingWithPage = result.data.find((b) => b.pageId != null);
      if (!bookingWithPage) return;

      expect(typeof bookingWithPage.pageSlug === 'string' || bookingWithPage.pageSlug == null).toBe(
        true
      );
    });

    it('should return clientIp as a string or undefined', async () => {
      const result = await client.bookings.list({ limit: 10 });

      for (const booking of result.data) {
        expect(booking.clientIp === undefined || typeof booking.clientIp === 'string').toBe(true);
      }
    });

    it('should expose taxSource on bookings when set', async () => {
      const result = await client.bookings.list({ limit: 25 });
      const bookingWithTaxSource = result.data.find(
        (booking) => (booking as Record<string, unknown>).taxSource != null
      );

      const taxSource = (bookingWithTaxSource as Record<string, unknown>).taxSource;
      expect(['fixed_tax_rate', 'stripe_tax']).toContain(taxSource);
    });

    it('should expose a structured taxRates snapshot when fixed_tax_rate is used', async () => {
      const result = await client.bookings.list({ limit: 50 });

      const bookingWithFixedTaxRates = result.data.find((booking) => {
        const b = booking as Record<string, unknown>;
        const taxRates = b.taxRates as unknown[] | undefined;
        return b.taxSource === 'fixed_tax_rate' && Array.isArray(taxRates) && taxRates.length > 0;
      });

      const taxRates = (bookingWithFixedTaxRates as Record<string, unknown>).taxRates as Record<
        string,
        unknown
      >[];
      expect(Array.isArray(taxRates)).toBe(true);
      expect(taxRates.length).toBeGreaterThan(0);

      for (const snapshot of taxRates) {
        expect(typeof snapshot.taxRate).toBe('string');
        expect(typeof snapshot.stripeId).toBe('string');
        expect(typeof snapshot.displayName).toBe('string');
        expect(typeof snapshot.inclusive).toBe('boolean');
        expect(typeof snapshot.percentage).toBe('number');
      }
    });
  });

  describe.only('create', () => {
    const createdEventIds: string[] = [];
    let eventId: string;
    let ticketTypeId: string;
    let fieldIdByReference: Map<string, string>;

    // Bookings address fields by id only, and the event response does not carry
    // them, so resolve the ids the endpoint expects from the fields list.
    const fieldId = (reference: string): string => {
      const id = fieldIdByReference.get(reference);
      if (!id) throw new Error(`Provisioned event has no field with reference "${reference}"`);
      return id;
    };

    beforeAll(async () => {
      const suffix = uniqueSuffix();
      const response = await client.events.create({
        name: `SDK Booking Event ${suffix}`,
        title: `SDK Booking Event ${suffix}`,
        eventDetails: {
          type: 'virtual',
          currency: 'usd',
          startDate: '2026-11-01T09:00:00Z',
          endDate: '2026-11-01T17:00:00Z',
          timezone: 'UTC',
        },
        // Required fields must all be supplied on create; keep the fixture
        // minimal (email only) and carry a tax-ID field for the meta tests.
        fields: [
          {
            label: 'Email address',
            element: 'email',
            type: 'email',
            required: true,
          },
          { label: 'Name', element: 'text', type: 'name' },
          { label: 'VAT number', element: 'tax-id' },
        ],
        ticketGroups: [
          {
            name: 'General Admission',
            ticketTypes: [{ name: 'GA', pricing: 'paid', price: 2500 }],
          },
        ],
      });

      eventId = response.data.id;
      createdEventIds.push(eventId);
      const ticketType = response.data.ticketGroups?.[0]?.ticketTypes?.[0];
      if (!ticketType?.id) throw new Error('Provisioned event has no ticket type');
      ticketTypeId = ticketType.id;

      // The client exposes no fields resource, and its low-level request method
      // is private, so read the list over plain HTTP.
      const fieldsResponse = await fetch(`${config.baseUrl}/v1/events/${eventId}/fields`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (!fieldsResponse.ok) {
        throw new Error(`Could not list event fields: ${fieldsResponse.status}`);
      }

      const fields = (await fieldsResponse.json()) as {
        data: { id: string; reference?: string | null }[];
      };

      fieldIdByReference = new Map(
        fields.data
          .filter((field): field is { id: string; reference: string } => Boolean(field.reference))
          .map((field) => [field.reference, field.id])
      );
    });

    afterAll(async () => {
      for (const id of createdEventIds) {
        try {
          await client.events.delete(id);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }
    });

    it('creates an unpaid manual booking with hydrated fields', { timeout: 60_000 }, async () => {
      const email = `sdk-booking-${uniqueSuffix()}@checkoutpage.com`;

      const result = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 2 },
        fields: [
          { fieldId: fieldId('customer_email'), value: email },
          { fieldId: fieldId('customer_name'), value: 'SDK Booking Test' },
        ],
        paymentOption: { manualType: 'invoice' },
      });

      expect(result.data.status).toBe('unpaid');
      expect(result.data.amount).toBe(5000);
      expect(result.data.amountDue).toBe(5000);
      expect(result.data.customerEmail).toBe(email);
      expect(result.data.customerName).toBe('SDK Booking Test');
      expect(result.data.paymentOption?.manualType).toBe('invoice');
      expect(result.data.tickets?.[0]?.ticketTypeId).toBe(ticketTypeId);
      expect(result.data.tickets?.[0]?.quantity).toBe(2);
      // Fields carry the event's own labels, not caller-supplied ones.
      const emailField = result.data.fields?.find((f) => f.reference === 'customer_email');
      expect(emailField?.label).toBe('Email address');
      expect(emailField?.value).toBe(email);

      // Read-back parity with bookings.get.
      const fetched = await client.bookings.get(result.data.id);
      expect(fetched.data.status).toBe('unpaid');
      expect(fetched.data.amount).toBe(5000);
    });

    it('creates an unpaid manual booking with hydrated fields', { timeout: 60_000 }, async () => {
      const email = `sdk-booking-${uniqueSuffix()}@example.com`;

      const result = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 2 },
        fields: [
          { fieldId: fieldId('customer_email'), value: email },
          { fieldId: fieldId('customer_name'), value: 'SDK Booking Test' },
        ],
        paymentOption: { manualType: 'invoice' },
      });

      expect(result.data.status).toBe('unpaid');
      expect(result.data.amount).toBe(5000);
      expect(result.data.amountDue).toBe(5000);
      expect(result.data.customerEmail).toBe(email);
      expect(result.data.customerName).toBe('SDK Booking Test');
      expect(result.data.paymentOption?.manualType).toBe('invoice');
      expect(result.data.tickets?.[0]?.ticketTypeId).toBe(ticketTypeId);
      expect(result.data.tickets?.[0]?.quantity).toBe(2);
      // Fields carry the event's own labels, not caller-supplied ones.
      const emailField = result.data.fields?.find((f) => f.reference === 'customer_email');
      expect(emailField?.label).toBe('Email address');
      expect(emailField?.value).toBe(email);

      // Read-back parity with bookings.get.
      const fetched = await client.bookings.get(result.data.id);
      expect(fetched.data.status).toBe('unpaid');
      expect(fetched.data.amount).toBe(5000);
    });

    // Every property BookingResponse declares. Grouped by whether an unpaid
    // manual booking can populate it, so a field that silently stops being
    // returned fails here rather than going unnoticed.
    it('returns every declared booking property', { timeout: 60_000 }, async () => {
      const email = `sdk-booking-full-${uniqueSuffix()}@example.com`;

      const { data: booking } = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 2 },
        fields: [
          { fieldId: fieldId('customer_email'), value: email },
          { fieldId: fieldId('customer_name'), value: 'Exhaustive Booking' },
        ],
        paymentOption: { manualType: 'invoice' },
      });

      // Always populated on a created booking.
      for (const key of [
        'id',
        'orderId',
        'orderStatus',
        'customerEmail',
        'customerName',
        'customerId',
        'sellerId',
        'pageId',
        'pageSlug',
        'currency',
        'amount',
        'amountPaid',
        'amountDue',
        'amountRefunded',
        'amountUsd',
        'taxAmount',
        'taxBreakdown',
        'fees',
        'billing',
        'fields',
        'livemode',
        'status',
        'paymentMethod',
        'paymentOption',
        'locale',
        'transactionIds',
        'isAbandoned',
        'createdAt',
        'updatedAt',
        'eventTitle',
        'tickets',
        'dynamicPrice',
        'stripeTaxCalculationId',
        'upsell',
        'abandonedCartEmailStatus',
        'isComplimentary',
      ]) {
        expect(booking, `expected booking to carry "${key}"`).toHaveProperty(key);
      }

      // Values, not just presence.
      expect(booking.status).toBe('unpaid');
      expect(booking.amount).toBe(5000);
      expect(booking.amountPaid).toBe(0);
      expect(booking.amountDue).toBe(5000);
      expect(booking.amountRefunded).toBe(0);
      expect(booking.currency).toBe('usd');
      expect(booking.orderStatus).toBe('active');
      expect(booking.livemode).toBe(true);
      expect(booking.isAbandoned).toBe(false);
      expect(booking.isComplimentary).toBe(false);
      expect(booking.customerEmail).toBe(email);
      expect(booking.customerName).toBe('Exhaustive Booking');
      expect(booking.paymentMethod).toMatchObject({ gateway: 'manual', method: 'manual' });
      // type/manualType are the contract; name/description/instructions are
      // derived from the merchant's own option config, not caller input.
      expect(booking.paymentOption).toMatchObject({ type: 'manual', manualType: 'invoice' });
      expect(typeof booking.paymentOption?.name).toBe('string');
      expect(Array.isArray(booking.transactionIds)).toBe(true);
      expect(booking.transactionIds?.length).toBeGreaterThan(0);
      expect(Array.isArray(booking.taxBreakdown)).toBe(true);
      expect(Array.isArray(booking.fees)).toBe(true);

      // Every property of the ticket line.
      const ticket = booking.tickets?.[0];
      expect(ticket).toBeDefined();
      for (const key of [
        'name',
        'ticketTypeId',
        'ticketGroupId',
        'ticketGroupName',
        'quantity',
        'price',
        'originalPrice',
        'pricing',
      ]) {
        expect(ticket, `expected ticket to carry "${key}"`).toHaveProperty(key);
      }
      expect(ticket?.ticketTypeId).toBe(ticketTypeId);
      expect(ticket?.quantity).toBe(2);
      expect(ticket?.price).toBe(2500);
      expect(ticket?.pricing).toBe('paid');
      expect(ticket).toHaveProperty('reference');
      expect(ticket).toHaveProperty('ticketGroupReference');
      // Uncapped fixture ticket type with no booking fee or discount.
      for (const key of ['capacity', 'ticketGroupCapacity', 'bookingFeeAmount', 'discount']) {
        expect(
          (ticket as Record<string, unknown>)[key],
          `expected ticket "${key}" to be absent on this fixture`
        ).toBeUndefined();
      }

      // Every field entry carries the event's own label/reference, hydrated
      // server-side rather than echoed from the request.
      for (const field of booking.fields ?? []) {
        expect(field).toHaveProperty('fieldId');
        expect(field).toHaveProperty('label');
        expect(field).toHaveProperty('value');
      }
      const emailField = booking.fields?.find((f) => f.reference === 'customer_email');
      expect(emailField?.label).toBe('Email address');

      // Not populated by an unpaid manual booking — asserted so that a change
      // in behaviour surfaces here instead of silently.
      for (const key of [
        'stripePaymentIntentId',
        'stripeChargeId',
        'stripeTaxTransactionId',
        'paymentError',
        'lastRefundAt',
        'lastRefundReason',
        'lastRefundReasonNote',
        'canceledAt',
        'canceledBy',
        'canceledReason',
        'recoveredAt',
        'abandonmentStatus',
        'abandonedCartEmailSentAt',
        'upsellPageId',
        'upsellChargeId',
        'upsellSubscriptionId',
        // The invoice is linked to the charge after the create response is
        // built — invoiceId appears on bookings.get, not on the 201.
        'invoiceId',
        // Not part of this booking: no coupon, no shipping/tax data, and the
        // browser-session keys an API booking never carries.
        'coupon',
        'complimentaryDiscountAmount',
        'discount',
        'shipping',
        'amountExcludingTax',
        'taxSource',
        'taxRates',
        'clientIp',
        'sessionId',
        'userAgent',
        'screenWidth',
        'visitId',
        'queryParameters',
      ]) {
        expect(
          (booking as Record<string, unknown>)[key],
          `expected "${key}" to be absent on an unpaid manual booking`
        ).toBeUndefined();
      }

      // The invoice link lands after creation: absent from the 201 above,
      // present on a subsequent get (invoicing-enabled sellers).
      const fetched = await client.bookings.get(booking.id);
      expect(fetched.data.invoiceId).toBeDefined();
    });

    it('records queryParameters against the booking', { timeout: 60_000 }, async () => {
      const queryParameters = {
        utm_source: 'box-office',
        utm_campaign: `sdk-${uniqueSuffix()}`,
      };

      const { data: booking } = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        queryParameters,
        fields: [
          {
            fieldId: fieldId('customer_email'),
            value: `sdk-booking-qp-${uniqueSuffix()}@example.com`,
          },
        ],
        paymentOption: { manualType: 'invoice' },
      });

      expect(booking.queryParameters).toEqual(queryParameters);

      const fetched = await client.bookings.get(booking.id);
      expect(fetched.data.queryParameters).toEqual(queryParameters);
    });

    it('applies a coupon discount to the booking', { timeout: 60_000 }, async () => {
      const email = `sdk-booking-coupon-${uniqueSuffix()}@example.com`;
      const code = `SDKBOOK${uniqueSuffix()}`.toUpperCase().replace(/[^A-Z0-9]/g, '');

      const { data: coupon } = await client.coupons.create({
        type: 'percent',
        label: `SDK booking coupon ${uniqueSuffix()}`,
        code,
        percentOff: 10,
        duration: 'once',
      });

      const { data: booking } = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        couponId: coupon.id,
        fields: [{ fieldId: fieldId('customer_email'), value: email }],
        paymentOption: { manualType: 'invoice' },
      });

      expect(booking.coupon).toBeDefined();
      expect(booking.coupon?.code).toBe(code);
      expect(booking.coupon?.percentOff).toBe(10);
      // 2500 less 10%.
      expect(booking.amount).toBe(2250);
    });

    it(
      'creates a complimentary booking as paid at zero with tickets at face value',
      { timeout: 60_000 },
      async () => {
        const email = `sdk-booking-comp-${uniqueSuffix()}@example.com`;

        const { data: booking } = await client.bookings.create({
          eventId,
          tickets: { [ticketTypeId]: 2 },
          fields: [
            { fieldId: fieldId('customer_email'), value: email },
            { fieldId: fieldId('customer_name'), value: 'Complimentary Booking' },
          ],
          complimentary: true,
        });

        expect(booking.status).toBe('paid');
        expect(booking.amount).toBe(0);
        expect(booking.amountPaid).toBe(0);
        expect(booking.amountDue).toBe(0);
        expect(booking.isComplimentary).toBe(true);
        // The ticket lines keep their face value, so the discount that zeroed
        // the booking is the 2 x 2500 they would have cost.
        expect(booking.complimentaryDiscountAmount).toBe(5000);
        expect(booking.tickets?.[0]?.ticketTypeId).toBe(ticketTypeId);
        expect(booking.tickets?.[0]?.quantity).toBe(2);
        expect(booking.tickets?.[0]?.price).toBe(2500);
        expect(booking.paymentOption).toBeFalsy();
        expect(booking.customerEmail).toBe(email);

        // Read-back parity with bookings.get.
        const fetched = await client.bookings.get(booking.id);
        expect(fetched.data.status).toBe('paid');
        expect(fetched.data.amount).toBe(0);
        expect(fetched.data.isComplimentary).toBe(true);
      }
    );

    it('filters complimentary bookings', { timeout: 60_000 }, async () => {
      const { data: complimentary } = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        fields: [
          {
            fieldId: fieldId('customer_email'),
            value: `sdk-booking-comp-filter-${uniqueSuffix()}@example.com`,
          },
        ],
        complimentary: true,
      });

      const { data: manual } = await client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        fields: [
          {
            fieldId: fieldId('customer_email'),
            value: `sdk-booking-manual-filter-${uniqueSuffix()}@example.com`,
          },
        ],
        paymentOption: { manualType: 'invoice' },
      });

      const onlyComplimentary = await client.bookings.list({
        pageId: eventId,
        isComplimentary: 'true',
        limit: 100,
      });
      expect(onlyComplimentary.data.map((b) => b.id)).toContain(complimentary.id);
      expect(onlyComplimentary.data.map((b) => b.id)).not.toContain(manual.id);
      for (const booking of onlyComplimentary.data) {
        expect(booking.isComplimentary).toBe(true);
      }

      const withoutComplimentary = await client.bookings.list({
        pageId: eventId,
        isComplimentary: 'false',
        limit: 100,
      });
      expect(withoutComplimentary.data.map((b) => b.id)).toContain(manual.id);
      expect(withoutComplimentary.data.map((b) => b.id)).not.toContain(complimentary.id);
    });

    it('rejects a complimentary booking that also carries a paymentOption', async () => {
      const attempt = client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        fields: [{ fieldId: fieldId('customer_email'), value: 'sdk-comp-both@example.com' }],
        complimentary: true,
        paymentOption: { manualType: 'invoice' },
      });

      await expect(attempt).rejects.toThrow(ValidationError);
      await expect(attempt).rejects.toThrow(/either paymentOption or complimentary/i);
    });

    it('rejects a coupon on a complimentary booking', async () => {
      // The coupon id below does not exist, so assert the message: a plain
      // "coupon not found" 400 would otherwise keep this green if the
      // mutual-exclusion rule were dropped.
      const attempt = client.bookings.create({
        eventId,
        tickets: { [ticketTypeId]: 1 },
        fields: [{ fieldId: fieldId('customer_email'), value: 'sdk-comp-coupon@example.com' }],
        complimentary: true,
        couponId: '65f4a1c2e4a9f3d2b1c0a9ec',
      });

      await expect(attempt).rejects.toThrow(ValidationError);
      await expect(attempt).rejects.toThrow(/coupon cannot be applied to a complimentary booking/i);
    });

    it('rejects a ticket type that is not on the event', async () => {
      await expect(
        client.bookings.create({
          eventId,
          tickets: { '507f1f77bcf86cd799439011': 1 },
          fields: [{ fieldId: fieldId('customer_email'), value: 'sdk-reject@example.com' }],
          paymentOption: { manualType: 'invoice' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects an unknown property rather than dropping it from a 201', async () => {
      await expect(
        client.bookings.create({
          eventId,
          tickets: { [ticketTypeId]: 1 },
          fields: [{ fieldId: fieldId('customer_email'), value: 'sdk-strict@example.com' }],
          paymentOption: { manualType: 'invoice' },
          notes: 'not a real field',
        } as never)
      ).rejects.toThrow(ValidationError);
    });

    it('rejects an unknown tax ID type on the tax-ID field', async () => {
      await expect(
        client.bookings.create({
          eventId,
          tickets: { [ticketTypeId]: 1 },
          fields: [
            { fieldId: fieldId('customer_email'), value: 'sdk-taxid@example.com' },
            { fieldId: fieldId('vat-number'), value: 'GB123', meta: { type: 'not_a_real_type' } },
          ],
          paymentOption: { manualType: 'invoice' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects meta on a field that is not a tax-ID field', async () => {
      await expect(
        client.bookings.create({
          eventId,
          tickets: { [ticketTypeId]: 1 },
          fields: [
            {
              fieldId: fieldId('customer_email'),
              value: 'x@example.com',
              meta: { type: 'gb_vat' },
            },
          ],
          paymentOption: { manualType: 'invoice' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('enforces required fields, matching the storefront form', { timeout: 60_000 }, async () => {
      // A default-fields event requires name, email and address.
      const suffix = uniqueSuffix();
      const { data: defaultEvent } = await client.events.create({
        name: `SDK Required Fields ${suffix}`,
        title: `SDK Required Fields ${suffix}`,
        eventDetails: {
          type: 'virtual',
          currency: 'usd',
          startDate: '2026-11-01T09:00:00Z',
          endDate: '2026-11-01T17:00:00Z',
          timezone: 'UTC',
        },
        ticketGroups: [{ name: 'GA', ticketTypes: [{ name: 'GA', pricing: 'paid', price: 1000 }] }],
      });
      createdEventIds.push(defaultEvent.id);
      const defaultTicketTypeId = defaultEvent.ticketGroups?.[0]?.ticketTypes?.[0]?.id;
      if (!defaultTicketTypeId) throw new Error('Provisioned default event has no ticket type');

      await expect(
        client.bookings.create({
          eventId: defaultEvent.id,
          tickets: { [defaultTicketTypeId]: 1 },
          fields: [{ fieldId: fieldId('customer_email'), value: 'sdk-required@example.com' }],
          paymentOption: { manualType: 'invoice' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a booking with no email field value', async () => {
      await expect(
        client.bookings.create({
          eventId,
          tickets: { [ticketTypeId]: 1 },
          fields: [{ fieldId: fieldId('customer_name'), value: 'No Email' }],
          paymentOption: { manualType: 'invoice' },
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
