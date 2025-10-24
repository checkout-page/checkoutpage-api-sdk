import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('SubscriptionResource Integration Tests', () => {
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
    it('should fetch a list of subscriptions', async () => {
      const result = await client.subscriptions.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');

      for (const subscription of result.data) {
        expect(subscription).toHaveProperty('id');
        expect(subscription).toHaveProperty('amount');
        expect(subscription).toHaveProperty('createdAt');
        expect(subscription).toHaveProperty('updatedAt');

        expect(typeof subscription.id).toBe('string');
        expect(typeof subscription.amount).toBe('number');
      }
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.subscriptions.list({
        limit: 2,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect skip pagination parameter', async () => {
      // Get first page
      const firstPage = await client.subscriptions.list({
        limit: 1,
      });

      // Get second page
      const secondPage = await client.subscriptions.list({
        limit: 1,
        skip: 1,
      });

      if (firstPage.data.length > 0 && secondPage.data.length > 0) {
        expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      }
    });

    it('should filter subscriptions by status', async () => {
      const result = await client.subscriptions.list({
        status: 'active',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

      for (const subscription of result.data) {
        expect(subscription.status).toBe('active');
      }
    });

    it('should support searching subscriptions', async () => {
      const result = await client.subscriptions.list({
        limit: 10,
      });

      if (result.data.length > 0 && result.data[0].customerEmail) {
        const searchResult = await client.subscriptions.list({
          search: result.data[0].customerEmail,
        });

        expect(Array.isArray(searchResult.data)).toBe(true);
      } else {
        throw Error('No subscription with customerEmail found for search test');
      }
    });

    it('should filter subscriptions by pageId if available', async () => {
      const result = await client.subscriptions.list({
        limit: 1,
      });

      if (result.data.length > 0 && result.data[0].pageId) {
        const pageFilterResult = await client.subscriptions.list({
          pageId: result.data[0].pageId,
        });

        expect(Array.isArray(pageFilterResult.data)).toBe(true);

        for (const subscription of pageFilterResult.data) {
          expect(subscription.pageId).toBe(result.data[0].pageId);
        }
      } else {
        throw Error('No subscription with pageId found for filter test');
      }
    });

    it('should combine multiple filters', async () => {
      const result = await client.subscriptions.list({
        status: 'active',
        limit: 5,
        skip: 0,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);

      for (const subscription of result.data) {
        expect(subscription.status).toBe('active');
      }
    });
  });
});
