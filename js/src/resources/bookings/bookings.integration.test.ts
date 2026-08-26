import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, NotFoundError } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

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
});
