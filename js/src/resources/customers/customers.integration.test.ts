import { describe, it, expect, beforeAll, afterEach } from 'vitest';
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

  describe('update', () => {
    /**
     * Snapshot the test customer once and restore it after each mutating test.
     * Defensive: ensures one failing test doesn't poison subsequent runs.
     */
    let initialCustomer: Awaited<ReturnType<typeof client.customers.get>>['data'];

    beforeAll(async () => {
      ({ data: initialCustomer } = await client.customers.get(config.testCustomerId));
    });

    afterEach(async () => {
      if (!initialCustomer) return;
      await client.customers.update(config.testCustomerId, {
        name: initialCustomer.name ?? '',
        companyName: initialCustomer.companyName ?? '',
        email: initialCustomer.email,
        phone: initialCustomer.phone ?? '',
        billingEmail: initialCustomer.billingEmail ?? '',
        ...(initialCustomer.address ? { address: initialCustomer.address } : {}),
        ...(initialCustomer.shipping ? { shipping: initialCustomer.shipping } : {}),
      });
    });

    it('updates a customer and returns the new payload', async () => {
      const newCompanyName = `Updated ${Date.now()}`;

      const { data: after } = await client.customers.update(config.testCustomerId, {
        companyName: newCompanyName,
      });

      expect(after.id).toBe(config.testCustomerId);
      expect(after.companyName).toBe(newCompanyName);
    });

    it('updates multiple top-level fields in a single request', async () => {
      const stamp = Date.now();
      const updates = {
        name: `Name ${stamp}`,
        companyName: `Co ${stamp}`,
        phone: '+15555550100',
      };

      const { data: after } = await client.customers.update(config.testCustomerId, updates);

      expect(after.name).toBe(updates.name);
      expect(after.companyName).toBe(updates.companyName);
      expect(after.phone).toBe(updates.phone);
    });

    it('normalises a mixed-case email with surrounding whitespace', async () => {
      const stamp = Date.now();
      const input = `  Mixed.CASE+${stamp}@Example.COM  `;
      const expected = `mixed.case+${stamp}@example.com`;

      const { data: after } = await client.customers.update(config.testCustomerId, {
        email: input,
      });

      expect(after.email).toBe(expected);
    });

    it('normalises billingEmail the same way as email', async () => {
      const stamp = Date.now();
      const input = `  BILLING+${stamp}@Example.COM  `;
      const expected = `billing+${stamp}@example.com`;

      const { data: after } = await client.customers.update(config.testCustomerId, {
        billingEmail: input,
      });

      expect(after.billingEmail).toBe(expected);
    });

    it('rejects an invalid email format with ValidationError', async () => {
      await expect(
        client.customers.update(config.testCustomerId, { email: 'not-an-email' })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects an invalid billingEmail format with ValidationError', async () => {
      await expect(
        client.customers.update(config.testCustomerId, { billingEmail: 'still@not' })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects an empty request body with ValidationError', async () => {
      await expect(client.customers.update(config.testCustomerId, {})).rejects.toThrow(
        ValidationError
      );
    });

    it('replaces the address subdocument in full when a partial address is supplied', async () => {
      // Seed a fully-populated address first.
      await client.customers.update(config.testCustomerId, {
        address: {
          line1: '100 Initial St',
          line2: 'Suite 1',
          city: 'Initial City',
          state: 'CA',
          postalCode: '94000',
          country: 'US',
        },
      });

      // Now patch with a partial address — server should REPLACE, not merge.
      const { data: after } = await client.customers.update(config.testCustomerId, {
        address: {
          line1: '200 New St',
          city: 'New City',
        },
      });

      expect(after.address?.line1).toBe('200 New St');
      expect(after.address?.city).toBe('New City');
      expect(after.address?.line2).toBeUndefined();
      expect(after.address?.state).toBeUndefined();
      expect(after.address?.postalCode).toBeUndefined();
      expect(after.address?.country).toBeUndefined();
    });

    it('updates the nested shipping address subdocument', async () => {
      const { data: after } = await client.customers.update(config.testCustomerId, {
        shipping: {
          name: 'Ship Recipient',
          phone: '+15555550200',
          address: {
            line1: '1 Shipping Way',
            city: 'Seattle',
            state: 'WA',
            postalCode: '98101',
            country: 'US',
          },
        },
      });

      expect(after.shipping?.name).toBe('Ship Recipient');
      expect(after.shipping?.phone).toBe('+15555550200');
      expect(after.shipping?.address?.line1).toBe('1 Shipping Way');
      expect(after.shipping?.address?.city).toBe('Seattle');
    });

    it('bumps updatedAt on every successful update', async () => {
      const { data: before } = await client.customers.get(config.testCustomerId);

      // Ensure measurable time elapses before the next write.
      await new Promise((resolve) => setTimeout(resolve, 10));

      const { data: after } = await client.customers.update(config.testCustomerId, {
        name: `Touch ${Date.now()}`,
      });

      expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
        new Date(before.updatedAt).getTime()
      );
    });

    it('throws NotFoundError when the customer does not exist', async () => {
      await expect(
        client.customers.update('6812fe6e9f39b6760576f01c', { name: 'X' })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError for invalid customer ID', async () => {
      await expect(client.customers.update('not-a-valid-id', { name: 'X' })).rejects.toThrow(
        ValidationError
      );
    });
  });
});
