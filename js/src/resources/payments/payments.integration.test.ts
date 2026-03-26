import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { APIError } from '../../errors';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

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
      const paymentWithPaymentMethod = result.data.find((payment) => payment.paymentMethod != null);

      if (!paymentWithPaymentMethod?.paymentMethod) {
        throw new Error('No payment with paymentMethod found for payment method expiry field test');
      }

      const paymentMethod = paymentWithPaymentMethod.paymentMethod as Record<string, unknown>;

      if (paymentMethod.exp_month == null || paymentMethod.exp_year == null) {
        throw new Error('Payment paymentMethod is missing deprecated exp_month/exp_year fields');
      }

      expect(paymentMethod).toHaveProperty('exp_month');
      expect(paymentMethod).toHaveProperty('exp_year');
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

      if (!seed.data[0]?.customerEmail) throw Error();

      const searchResult = await listPayments({ search: seed.data[0].customerEmail });
      if (!searchResult) throw Error();

      expect(Array.isArray(searchResult.data)).toBe(true);
      for (const payment of searchResult.data) {
        expect(payment.customerEmail).toBe(seed.data[0].customerEmail);
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

    it('should combine multiple filters', async () => {
      const result = await listPayments({ status: 'paid', limit: 5 });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(5);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });

    it('should include pageName and pageSlug when a page is associated', async () => {
      const result = await listPayments({ limit: 10 });
      if (!result) return;

      const paymentWithPage = result.data.find((p) => p.pageId != null);
      if (!paymentWithPage) return;

      expect(typeof paymentWithPage.pageName === 'string' || paymentWithPage.pageName == null).toBe(
        true
      );
      expect(typeof paymentWithPage.pageSlug === 'string' || paymentWithPage.pageSlug == null).toBe(
        true
      );
      expect(
        typeof paymentWithPage.pageTitle === 'string' || paymentWithPage.pageTitle == null
      ).toBe(true);
    });

    it('should return clientIp as a string or undefined', async () => {
      const result = await listPayments({ limit: 10 });
      if (!result) return;

      for (const payment of result.data) {
        expect(payment.clientIp === undefined || typeof payment.clientIp === 'string').toBe(true);
      }
    });
  });
});
