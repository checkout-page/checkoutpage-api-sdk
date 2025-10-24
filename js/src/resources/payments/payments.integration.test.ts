import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PaymentResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = new CheckoutPageClient({
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

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect skip pagination parameter', async () => {
      // Get first page
      const firstPage = await client.payments.list({
        limit: 1,
      });

      // Get second page
      const secondPage = await client.payments.list({
        limit: 1,
        skip: 1,
      });

      if (firstPage.data.length > 0 && secondPage.data.length > 0) {
        expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      }
    });

    it('should filter payments by status', async () => {
      const result = await client.payments.list({
        status: 'paid',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

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
        status: 'draft',
        limit: 5,
        skip: 0,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);

      for (const payment of result.data) {
        expect(payment.status).toBe('paid');
      }
    });
  });
});
