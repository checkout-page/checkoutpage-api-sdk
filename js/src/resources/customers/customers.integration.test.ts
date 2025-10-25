import { describe, it, expect, beforeAll } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  NotFoundError,
  ValidationError,
} from '../../index';
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

    it('should throw a NotFoundError for a missing customer ID', async () => {
      await expect(client.customers.get('6812fe6e9f39b6760576f01c')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid customer ID', async () => {
      await expect(client.customers.get('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('should fetch a list of customers', async () => {
      const result = await client.customers.list();

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

      expect(result.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.customers.list({
        limit: 1,
      });

      const secondPage = await client.customers.list({
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
      const moveAwayFromStart = await client.customers.list({
        limit: 5,
      });

      const firstPage = await client.customers.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });

      // Get previous page using cursor from first page
      const previousPage = await client.customers.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
      expect(previousPage.data[0].id.localeCompare(firstPage.data[0].id)).toBeGreaterThanOrEqual(0);
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
