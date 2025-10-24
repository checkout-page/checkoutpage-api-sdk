import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('CustomerResource Integration Tests', () => {
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
    it('should fetch a real customer by ID', async () => {
      const { data: customer } = await client.customers.get(config.testCustomerId);

      expect(customer).toHaveProperty('id');
      expect(customer).toHaveProperty('email');
      expect(customer).toHaveProperty('sellerId');
      expect(customer).toHaveProperty('createdAt');
      expect(customer).toHaveProperty('updatedAt');
      expect(customer.id).toBe(config.testCustomerId);

      expect(typeof customer.id).toBe('string');
      expect(typeof customer.email).toBe('string');
      expect(typeof customer.createdAt).toBe('string');
    });

    it('should throw NotFoundError for invalid customer ID', async () => {
      await expect(client.customers.get('000000000000000000000000')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should fetch a list of customers', async () => {
      const result = await client.customers.list({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');

      expect(result.data.length).toBeGreaterThan(0);

      /**
       * Expect all customers to have mandatory fields
       */
      for (const customer of result.data) {
        expect(customer).toHaveProperty('id');
        expect(customer).toHaveProperty('email');
        expect(customer).toHaveProperty('sellerId');
        expect(typeof customer.id).toBe('string');
        expect(typeof customer.email).toBe('string');
      }
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.customers.list({
        limit: 2,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect skip pagination parameter', async () => {
      // Get first page
      const firstPage = await client.customers.list({
        limit: 1,
      });

      // Get second page
      const secondPage = await client.customers.list({
        limit: 1,
        skip: 1,
      });

      if (firstPage.data.length > 0 && secondPage.data.length > 0) {
        expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      }
    });

    it('should filter customers by search query', async () => {
      const result = await client.customers.list({
        search: config.testCustomerEmail,
      });

      const foundCustomer = result.data.find((c) => c.email === config.testCustomerEmail);
      expect(foundCustomer).toBeDefined();
      expect(foundCustomer?.email).toBe(config.testCustomerEmail);
    });

    it('should return empty array when search has no matches', async () => {
      const result = await client.customers.list({
        search: 'nonexistent-email-12345@example.com',
      });

      expect(result.data).toEqual([]);
      expect(result.has_more).toBe(false);
    });

    it('should include total count when available', async () => {
      const result = await client.customers.list();
      expect(typeof result.total).toBe('number');
    });
  });
});
