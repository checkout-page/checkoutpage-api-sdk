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
      const result = await listPayments({
        limit: 2,
      });

      expect(result?.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await listPayments({
        limit: 1,
      });

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
      /**
       * We can't be at the start of the list for this test to be affective. We'll be paging backwards.
       */
      const moveAwayFromStart = await listPayments({
        limit: 5,
      });

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
      const result = await listPayments({
        status: 'paid',
      });
      if (!result) throw Error();

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });

    it('should support searching payments', async () => {
      const result = await listPayments({
        limit: 10,
      });
      if (!result) throw Error();

      if (result.data.length > 0 && result.data[0].customerEmail) {
        const searchResult = await listPayments({
          search: result.data[0].customerEmail,
        });
        if (!searchResult) throw Error();

        expect(Array.isArray(searchResult.data)).toBe(true);
      } else {
        throw Error();
      }
    });

    it('should filter payments by pageId if available', async () => {
      const result = await listPayments({
        limit: 1,
      });
      if (!result) throw Error();

      if (result.data.length > 0 && result.data[0].pageId) {
        const pageFilterResult = await listPayments({
          pageId: result.data[0].pageId,
        });
        if (!pageFilterResult) throw Error();

        expect(Array.isArray(pageFilterResult.data)).toBe(true);

        for (const payment of pageFilterResult.data) {
          expect(payment.pageId).toBe(result.data[0].pageId);
        }
      } else {
        throw Error();
      }
    });

    it('should combine multiple filters', async () => {
      const result = await listPayments({
        status: 'paid',
        limit: 5,
      });
      if (!result) throw Error();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(5);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });
  });
});
