import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PaymentResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch a list of payments', async () => {
      const result = await client.payments.list();

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

    it('should respect limit pagination parameter', async () => {
      const result = await client.payments.list({
        limit: 2,
      });

      expect(result.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.payments.list({
        limit: 1,
      });

      const secondPage = await client.payments.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      expect(firstPage.data[0].id.localeCompare(secondPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      /**
       * We can't be at the start of the list for this test to be affective. We'll be paging backwards.
       */
      const moveAwayFromStart = await client.payments.list({
        limit: 5,
      });

      const firstPage = await client.payments.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });

      const previousPage = await client.payments.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
      expect(previousPage.data[0].id.localeCompare(firstPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should filter payments by status', async () => {
      const result = await client.payments.list({
        status: 'paid',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });

    it('should support searching payments', async () => {
      const result = await client.payments.list({
        limit: 10,
      });

      if (result.data.length > 0 && result.data[0].customerEmail) {
        const searchResult = await client.payments.list({
          search: result.data[0].customerEmail,
        });

        expect(Array.isArray(searchResult.data)).toBe(true);
      } else {
        throw Error();
      }
    });

    it('should filter payments by pageId if available', async () => {
      const result = await client.payments.list({
        limit: 1,
      });

      if (result.data.length > 0 && result.data[0].pageId) {
        const pageFilterResult = await client.payments.list({
          pageId: result.data[0].pageId,
        });

        expect(Array.isArray(pageFilterResult.data)).toBe(true);

        for (const payment of pageFilterResult.data) {
          expect(payment.pageId).toBe(result.data[0].pageId);
        }
      } else {
        throw Error();
      }
    });

    it('should combine multiple filters', async () => {
      const result = await client.payments.list({
        status: 'paid',
        limit: 5,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(5);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });
  });
});
