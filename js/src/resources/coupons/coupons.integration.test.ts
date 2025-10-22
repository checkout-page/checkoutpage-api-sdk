import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPage } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('CouponResource Integration Tests', () => {
  let client: CheckoutPage;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = new CheckoutPage({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch a list of coupons', async () => {
      const result = await client.coupons.list();

      expect(result).toHaveProperty('data');
      expect(result.total).toBeGreaterThan(0);
      expect(result).toHaveProperty('has_more');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.coupons.list({
        limit: 2,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect skip pagination parameter', async () => {
      const firstPage = await client.coupons.list({
        limit: 1,
      });

      const secondPage = await client.coupons.list({
        limit: 1,
        skip: 1,
      });

      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
    });

    it('should filter coupons by search query', async () => {
      const result = await client.coupons.list({
        search: 'integrationtest',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should return empty array when search has no matches', async () => {
      const result = await client.coupons.list({
        search: 'nonexistent-coupon-12345',
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    it('should handle multiple query parameters together', async () => {
      const result = await client.coupons.list({
        limit: 2,
        skip: 0,
        search: 'test',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(typeof result.has_more).toBe('boolean');
    });
  });
});
