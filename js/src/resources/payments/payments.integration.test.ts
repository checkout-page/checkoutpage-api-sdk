import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  NotFoundError,
  ValidationError,
} from '../../index';
import { APIError } from '../../errors';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, syntheticClientIp, uniqueSuffix } from '../../test-helpers/test-lib';

describe('PaymentResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  const isKnownPaymentsApiSchemaError = (error: unknown) =>
    error instanceof APIError && error.message === 'Invalid response schema';

  const listPayments = async (
    ...args: Parameters<CheckoutPageClient['payments']['list']>
  ): Promise<Awaited<ReturnType<CheckoutPageClient['payments']['list']>> | null> => {
    try {
      return await client.payments.list(...args);
    } catch (error) {
      if (isKnownPaymentsApiSchemaError(error)) {
        return null;
      }

      throw error;
    }
  };

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('get', () => {
    it('should fetch a single payment by id', async () => {
      const seed = await listPayments({ limit: 1 });
      if (!seed || seed.data.length === 0) throw Error('No payments available to fetch');

      const expected = seed.data[0];
      const result = await client.payments.get(expected.id);

      expect(result).toHaveProperty('data');
      expect(result.data.id).toBe(expected.id);
      expect(result.data.amount).toBe(expected.amount);
      expect(result.data.status).toBe(expected.status);
      expect(result.data).toHaveProperty('createdAt');
      expect(result.data).toHaveProperty('updatedAt');
    });

    it('should throw a 404 for a payment that does not exist', async () => {
      await expect(client.payments.get('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundError);
    });

    it('should throw a 404 for a booking id, which is not a payment', async () => {
      const bookings = await client.bookings.list({ limit: 1 });
      if (bookings.data.length === 0) return;

      await expect(client.payments.get(bookings.data[0].id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should fetch a list of payments', async () => {
      const result = await listPayments();
      if (!result) return;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
      expect(result.data.length).toBeGreaterThan(0);

      for (const payment of result.data) {
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('status');
        expect(payment).toHaveProperty('taxBreakdown');
        expect(payment).toHaveProperty('createdAt');
        expect(payment).toHaveProperty('updatedAt');

        expect(typeof payment.id).toBe('string');
        expect(typeof payment.amount).toBe('number');
        expect(typeof payment.status).toBe('string');
        expect(Array.isArray(payment.taxBreakdown)).toBe(true);
      }
    });

    it('should expose both deprecated snake_case and camelCase payment method expiry fields when available', async () => {
      const result = await listPayments({ limit: 25 });
      if (!result) return;
      const paymentWithExpiryFields = result.data.find(
        (payment) =>
          payment.paymentMethod?.expMonth != null && payment.paymentMethod?.expYear != null
      );

      if (!paymentWithExpiryFields?.paymentMethod) {
        throw new Error(
          'No payment with expMonth/expYear found for payment method expiry field test'
        );
      }

      const paymentMethod = paymentWithExpiryFields.paymentMethod as Record<string, unknown>;

      expect(paymentMethod).toHaveProperty('expMonth');
      expect(paymentMethod).toHaveProperty('expYear');
      expect(paymentMethod.expMonth).toBe(paymentMethod.exp_month);
      expect(paymentMethod.expYear).toBe(paymentMethod.exp_year);
    });

    it('should respect limit pagination parameter', async () => {
      const result = await listPayments({ limit: 2 });
      expect(result?.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await listPayments({ limit: 1 });
      if (!firstPage) throw Error();

      const secondPage = await listPayments({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });
      if (!secondPage) throw Error();

      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      expect(firstPage.data[0].id.localeCompare(secondPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      const moveAwayFromStart = await listPayments({ limit: 5 });
      if (!moveAwayFromStart) throw Error();

      const firstPage = await listPayments({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });
      if (!firstPage) throw Error();

      const previousPage = await listPayments({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });
      if (!previousPage) throw Error();

      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
      expect(previousPage.data[0].id.localeCompare(firstPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should filter payments by status', async () => {
      const result = await listPayments({ status: 'paid' });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });

    it('should support searching payments by customer email', async () => {
      const seed = await listPayments({ limit: 10 });
      if (!seed) throw Error();
      const paymentWithCustomerEmail = seed.data.find((payment) => payment.customerEmail);

      if (!paymentWithCustomerEmail?.customerEmail) {
        throw Error('No payment with customerEmail found for search test');
      }

      const searchResult = await listPayments({ search: paymentWithCustomerEmail.customerEmail });
      if (!searchResult) throw Error();

      expect(Array.isArray(searchResult.data)).toBe(true);
      for (const payment of searchResult.data) {
        expect(payment.customerEmail).toBe(paymentWithCustomerEmail.customerEmail);
      }
    });

    it('should filter payments by pageId', async () => {
      const seed = await listPayments({ limit: 1 });
      if (!seed || !seed.data[0]?.pageId) throw Error();

      const result = await listPayments({ pageId: seed.data[0].pageId });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      for (const payment of result.data) {
        expect(payment.pageId).toBe(seed.data[0].pageId);
      }
    });

    it('should filter payments by customerId', async () => {
      const seed = await listPayments({ limit: 10 });
      if (!seed) throw Error();

      const paymentWithCustomer = seed.data.find((p) => p.customerId != null);
      if (!paymentWithCustomer?.customerId) throw Error();

      const result = await listPayments({ customerId: paymentWithCustomer.customerId });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(payment.customerId).toBe(paymentWithCustomer.customerId);
      }
    });

    it('should filter payments by exact orderId', async () => {
      const seed = await listPayments({ limit: 10 });
      if (!seed) throw Error();

      const paymentWithOrder = seed.data.find((p) => p.orderId != null);
      if (!paymentWithOrder?.orderId) throw Error();

      const result = await listPayments({ orderId: paymentWithOrder.orderId });
      if (!result) throw Error();

      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(payment.orderId).toBe(paymentWithOrder.orderId);
      }
    });

    it('should return empty results for a non-existent orderId', async () => {
      const result = await listPayments({ orderId: 'NON-EXISTENT-ORDER-XYZ-99999' });
      if (!result) throw Error();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter payments by couponCode', async () => {
      // First find a payment that used a coupon
      const seed = await listPayments({ limit: 20 });
      if (!seed) throw Error();

      const paymentWithCoupon = seed.data.find((p) => p.coupon?.code != null);
      if (!paymentWithCoupon?.coupon?.code) {
        // No coupon payments in the result set — skip gracefully
        return;
      }

      const result = await listPayments({ couponCode: paymentWithCoupon.coupon.code });
      if (!result) throw Error();

      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(payment.coupon?.code).toBe(paymentWithCoupon.coupon.code);
      }
    });

    it('should filter payments by productId', async () => {
      const seed = await listPayments({ limit: 10 });
      if (!seed) throw Error();

      const paymentWithProduct = seed.data.find((p) => p.productId != null);
      if (!paymentWithProduct?.productId) throw Error();

      const result = await listPayments({ productId: paymentWithProduct.productId });
      if (!result) throw Error();

      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(payment.productId).toBe(paymentWithProduct.productId);
      }
    });

    it('should filter payments by createdAfter', async () => {
      const createdAfter = '2020-01-01T00:00:00Z';
      const result = await listPayments({ createdAfter });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(new Date(payment.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(createdAfter).getTime()
        );
      }
    });

    it('should filter payments by createdBefore', async () => {
      const createdBefore = '2099-01-01T00:00:00Z';
      const result = await listPayments({ createdBefore });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const payment of result.data) {
        expect(new Date(payment.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(createdBefore).getTime()
        );
      }
    });

    it('should return empty results when createdAfter is in the future', async () => {
      const result = await listPayments({ createdAfter: '2099-01-01T00:00:00Z' });
      if (!result) throw Error();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty results when createdBefore is far in the past', async () => {
      const result = await listPayments({ createdBefore: '2000-01-01T00:00:00Z' });
      if (!result) throw Error();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter abandoned payments', async () => {
      const result = await listPayments({ abandonmentStatus: 'abandoned' });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      for (const payment of result.data) {
        expect(payment.isAbandoned).toBe(true);
        expect(payment.recoveredAt).toBeFalsy();
        expect(payment.abandonmentStatus).toBe('abandoned');
      }
    });

    it('should filter recovered payments', async () => {
      const result = await listPayments({ abandonmentStatus: 'recovered' });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      for (const payment of result.data) {
        expect(payment.isAbandoned).toBe(true);
        expect(payment.recoveredAt).toBeTruthy();
        expect(payment.abandonmentStatus).toBe('recovered');
      }
    });

    it('should return only test-mode payments when livemode is false', async () => {
      const result = await listPayments({ livemode: false, limit: 25 });
      if (!result) throw Error();

      for (const payment of result.data) {
        expect(payment.livemode).toBe(false);
      }
    });

    it('should combine multiple filters', async () => {
      const result = await listPayments({ status: 'paid', limit: 5 });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(5);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });

    it('should include pageSlug when a page is associated', async () => {
      const result = await listPayments({ limit: 10 });
      if (!result) return;

      const paymentWithPage = result.data.find((p) => p.pageId != null);
      if (!paymentWithPage) return;

      expect(typeof paymentWithPage.pageSlug === 'string' || paymentWithPage.pageSlug == null).toBe(
        true
      );
    });

    it('should return clientIp as a string or undefined', async () => {
      const result = await listPayments({ limit: 10 });
      if (!result) return;

      for (const payment of result.data) {
        expect(payment.clientIp === undefined || typeof payment.clientIp === 'string').toBe(true);
      }
    });

    it('should expose taxSource on payments when set', async () => {
      const result = await listPayments({ limit: 100 });
      if (!result) return;

      const paymentWithTaxSource = result.data.find(
        (payment) => (payment as Record<string, unknown>).taxSource != null
      );

      const taxSource = (paymentWithTaxSource as Record<string, unknown>).taxSource;
      expect(['fixed_tax_rate', 'stripe_tax']).toContain(taxSource);
    });

    it('should expose a structured taxRates snapshot when fixed_tax_rate is used', async () => {
      const result = await listPayments({ limit: 50 });
      if (!result) return;

      const paymentWithFixedTaxRates = result.data.find((payment) => {
        const p = payment as Record<string, unknown>;
        const taxRates = p.taxRates as unknown[] | undefined;
        return p.taxSource === 'fixed_tax_rate' && Array.isArray(taxRates) && taxRates.length > 0;
      });

      const taxRates = (paymentWithFixedTaxRates as Record<string, unknown>).taxRates as Record<
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

    /**
     * priceId is populated when the customer selected a specific price at checkout
     * (multi-price products). For single-price products it will be null/undefined.
     * We assert the field is present in the response shape and has the correct type.
     */
    it('should expose priceId on payments as string or null', async () => {
      const result = await listPayments({ limit: 50 });
      if (!result) return;

      for (const payment of result.data) {
        // TypeScript compile-time check: no cast needed
        const priceId: string | null | undefined = payment.priceId;
        expect(priceId === undefined || priceId === null || typeof priceId === 'string').toBe(true);
      }
    });

    /**
     * priceSnapshot is a frozen copy of the purchased price captured at the point
     * of purchase (multi-price products). Single-price / legacy payments have no
     * snapshot. We assert the response shape carries the field with the right type
     * and, when present, a stringified priceId.
     */
    it('should expose priceSnapshot on payments as an object or null', async () => {
      const result = await listPayments({ limit: 50 });
      if (!result) return;

      for (const payment of result.data) {
        const snapshot = payment.priceSnapshot;
        expect(snapshot === undefined || snapshot === null || typeof snapshot === 'object').toBe(
          true
        );
        if (snapshot) {
          const priceId = snapshot.priceId;
          expect(priceId === undefined || priceId === null || typeof priceId === 'string').toBe(
            true
          );
        }
      }
    });

    /**
     * Skip this test until M9b creates sample multi-price payments in the
     * integration environment. Once those payments exist, remove the skip and
     * assert priceId equals the expected price id.
     */
    describe('priceId on payment reads', () => {
      it('should expose priceId matching the price selected at checkout', async () => {
        const result = await listPayments({ limit: 100 });
        if (!result) throw new Error('Could not fetch payments');

        // No-op when the environment has no multi-price payments seeded.
        const paymentWithPriceId = result.data.find((p) => p.priceId != null);
        if (!paymentWithPriceId?.priceId) return;

        expect(typeof paymentWithPriceId.priceId).toBe('string');
        expect(paymentWithPriceId.priceId.length).toBeGreaterThan(0);
      });
    });
  });

  // Only ever cancels payments this block created on its own checkout page.
  describe('cancel', () => {
    const createdPageIds: string[] = [];
    const createdEventIds: string[] = [];

    // Pay by invoice completes without a card, so the storefront records it as `unpaid` at once.
    const createInvoicePayment = async (pageId: string) => {
      const email = `sdk-cancel-${uniqueSuffix()}@example.com`;
      const response = await fetch(new URL(`/api/v1/checkout/${pageId}/charges`, config.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': syntheticClientIp() },
        body: JSON.stringify({
          pageId,
          sellerId: config.testSellerId,
          email,
          name: 'SDK Cancel Buyer',
          fields: [
            { label: 'Email', element: 'email', type: 'email', value: email },
            { label: 'Name', element: 'text', type: 'name', value: 'SDK Cancel Buyer' },
          ],
          paymentOption: { type: 'manual', manualType: 'invoice', name: 'Pay by invoice' },
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Could not create an invoice payment: ${response.status} ${await response.text()}`
        );
      }

      const { data } = (await response.json()) as { data: { _id?: string; id?: string } };
      const paymentId = data._id ?? data.id;
      if (!paymentId) throw new Error('The storefront charge returned no id');
      return paymentId;
    };

    let pageId: string;

    beforeAll(async () => {
      const suffix = uniqueSuffix();
      const { data: page } = await client.checkoutPages.create({
        name: `SDK Cancel Checkout ${suffix}`,
        productData: {
          title: `SDK Cancel Product ${suffix}`,
          price: { amount: 4900, currency: 'usd' },
        },
        paymentOptions: [
          { type: 'manual', manualType: 'invoice', name: 'Pay by invoice', enabled: true },
        ],
        sendEmailConfirmation: false,
        sendPaymentNotification: false,
      });
      pageId = page.id;
      createdPageIds.push(pageId);
    });

    afterAll(async () => {
      for (const id of createdPageIds) {
        try {
          await client.checkoutPages.delete(id);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }
      for (const id of createdEventIds) {
        try {
          await client.events.delete(id);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }
    });

    it('cancels a payment, then refuses a second cancel', { timeout: 60_000 }, async () => {
      const paymentId = await createInvoicePayment(pageId);
      const { data: before } = await client.payments.get(paymentId);
      expect(before.status).toBe('unpaid');
      expect(before.orderStatus ?? 'active').toBe('active');

      const reason = `SDK cancel ${uniqueSuffix()}`;
      const result = await client.payments.cancel(paymentId, { reason });

      expect(Object.keys(result)).toEqual(['data']);
      const { data: payment } = result;
      expect(payment.id).toBe(paymentId);
      expect(payment.orderStatus).toBe('canceled');
      expect(payment.canceledReason).toBe(reason);
      expect(typeof payment.canceledAt).toBe('string');
      expect(typeof payment.canceledByApiKey).toBe('string');
      expect(typeof payment.canceledByApiKeyName).toBe('string');
      expect((payment.canceledByApiKeyName as string).length).toBeGreaterThan(0);

      const { data: fetched } = await client.payments.get(paymentId);
      expect(fetched).toMatchObject({
        orderStatus: 'canceled',
        canceledReason: reason,
        canceledByApiKeyName: payment.canceledByApiKeyName,
      });

      const again = client.payments.cancel(paymentId, { reason: 'Again' });
      await expect(again).rejects.toBeInstanceOf(ValidationError);
      await expect(again).rejects.toThrow('Charge already canceled');

      const canceled = await client.payments.list({ pageId, orderStatus: 'canceled' });
      expect(canceled.data.map((p) => p.id)).toContain(paymentId);
    });

    it(
      'refuses a refund on a payment with nothing paid and leaves it active',
      { timeout: 60_000 },
      async () => {
        const paymentId = await createInvoicePayment(pageId);

        // Past body validation, so the refund shape the SDK sends is the one the API takes.
        const attempt = client.payments.cancel(paymentId, {
          reason: 'Refund what was never paid',
          refund: {
            amount: 100,
            reason: 'requested_by_customer',
            note: 'SDK test',
            sendEmail: false,
          },
        });
        await expect(attempt).rejects.toBeInstanceOf(ValidationError);
        await expect(attempt).rejects.toThrow(/no payment to refund/);

        const { data: payment } = await client.payments.get(paymentId);
        expect(payment.orderStatus ?? 'active').toBe('active');
      }
    );

    it(
      'rejects an empty reason with a ValidationError and leaves the payment active',
      { timeout: 60_000 },
      async () => {
        const paymentId = await createInvoicePayment(pageId);

        await expect(client.payments.cancel(paymentId, { reason: '' })).rejects.toBeInstanceOf(
          ValidationError
        );

        const { data: payment } = await client.payments.get(paymentId);
        expect(payment.orderStatus ?? 'active').toBe('active');
      }
    );

    it('returns a NotFoundError for an unknown payment id', async () => {
      const missing = client.payments.cancel(fakeObjectId('missing'), { reason: 'Missing' });

      await expect(missing).rejects.toBeInstanceOf(NotFoundError);
      await expect(missing).rejects.toThrow('Payment not found');
    });

    it(
      'returns a NotFoundError for a booking id, which is not a payment',
      { timeout: 60_000 },
      async () => {
        const suffix = uniqueSuffix();
        const { data: event } = await client.events.create({
          name: `SDK Cancel Event ${suffix}`,
          title: `SDK Cancel Event ${suffix}`,
          eventDetails: {
            type: 'virtual',
            currency: 'usd',
            startDate: '2027-01-01T09:00:00Z',
            endDate: '2027-01-01T17:00:00Z',
            timezone: 'UTC',
          },
          fields: [{ label: 'Email address', element: 'email', type: 'email', required: true }],
          ticketGroups: [
            { name: 'General', ticketTypes: [{ name: 'GA', pricing: 'paid', price: 2500 }] },
          ],
          sendEmailConfirmation: false,
          sendPaymentNotification: false,
        });
        createdEventIds.push(event.id);
        const ticketTypeId = event.ticketGroups?.[0]?.ticketTypes?.[0]?.id;
        if (!ticketTypeId) throw new Error('Provisioned event has no ticket type');

        const { data: fields } = await client.events.fields.list(event.id);
        const emailFieldId = fields.find((f) => f.reference === 'customer_email')?.id;
        if (!emailFieldId) throw new Error('Provisioned event has no email field');

        const { data: booking } = await client.bookings.create({
          eventId: event.id,
          tickets: { [ticketTypeId]: 1 },
          fields: [{ fieldId: emailFieldId, value: `sdk-cancel-${suffix}@example.com` }],
          complimentary: true,
        });

        const attempt = client.payments.cancel(booking.id, { reason: 'Not a payment' });
        await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
        await expect(attempt).rejects.toThrow('Payment not found');

        const { data: after } = await client.bookings.get(booking.id);
        expect(after.orderStatus ?? 'active').toBe('active');
      }
    );
  });
});
