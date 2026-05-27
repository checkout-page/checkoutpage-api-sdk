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
      expect(result.data.length).toBeGreaterThan(0);

      for (const subscription of result.data) {
        expect(subscription).toHaveProperty('id');
        expect(subscription).toHaveProperty('amount');
        expect(subscription).toHaveProperty('createdAt');
        expect(subscription).toHaveProperty('updatedAt');

        expect(typeof subscription.id).toBe('string');
        expect(typeof subscription.amount).toBe('number');
      }
    });

    it('should expose both deprecated snake_case and camelCase payment method expiry fields when available', async () => {
      const result = await client.subscriptions.list({ limit: 25 });
      const subscriptionWithPaymentMethod = result.data.find(
        (subscription) => subscription.paymentMethod != null
      );

      if (!subscriptionWithPaymentMethod?.paymentMethod) {
        throw new Error(
          'No subscription with paymentMethod found for payment method expiry field test'
        );
      }

      const paymentMethod = subscriptionWithPaymentMethod.paymentMethod as Record<string, unknown>;

      if (paymentMethod.expMonth == null || paymentMethod.expYear == null) {
        throw new Error('Subscription paymentMethod is missing expMonth/expYear fields');
      }

      expect(paymentMethod).toHaveProperty('expMonth');
      expect(paymentMethod).toHaveProperty('expYear');
      expect(paymentMethod.expMonth).toBe(paymentMethod.exp_month);
      expect(paymentMethod.expYear).toBe(paymentMethod.exp_year);
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.subscriptions.list({
        limit: 2,
      });

      expect(result.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.subscriptions.list({
        limit: 1,
      });

      const secondPage = await client.subscriptions.list({
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
      const moveAwayFromStart = await client.subscriptions.list({
        limit: 5,
      });

      const firstPage = await client.subscriptions.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });

      const previousPage = await client.subscriptions.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
      expect(previousPage.data[0].id.localeCompare(firstPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should filter subscriptions by status', async () => {
      const result = await client.subscriptions.list({
        status: 'active',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      for (const subscription of result.data) {
        expect(subscription.status).toBe('active');
      }
    });

    it('benchmarks subscription search queries', async () => {
      const baseline = await client.subscriptions.list({
        limit: 100,
      });

      const subscriptionWithCustomerEmail = baseline.data.find(
        (subscription) => subscription.customerEmail
      );

      if (!subscriptionWithCustomerEmail?.customerEmail) {
        throw new Error('No subscription with customerEmail found for search benchmark');
      }

      const searches = [
        '@gmail.com',
        'basic',
        '72602704',
        'sub_1QcLKnFdCGuDCwTS9kliOclj',
        'tapkids2',
        'tapkids2010chihiro',
        'matt',
        'john',
        'sander',
        'andy',
      ] as const;

      const results = await Promise.all(
        searches.map(async (search) => {
          const startedAt = Date.now();

          const searchResult = await client.subscriptions.list({
            limit: 10,
            search,
          });

          const result = {
            search,
            found: searchResult.data.length,
            total: searchResult.total,
            timeMs: Date.now() - startedAt,
          };

          await new Promise((resolve) => setTimeout(resolve, 1000));

          return result;
        })
      );

      for (const result of results) {
        expect(typeof result.search).toBe('string');
        expect(typeof result.found).toBe('number');
        expect(typeof result.total).toBe('number');
        expect(typeof result.timeMs).toBe('number');
      }
    });

    it('should support searching subscriptions', async () => {
      const result = await client.subscriptions.list({
        limit: 10,
      });
      const subscriptionWithCustomerEmail = result.data.find(
        (subscription) => subscription.customerEmail
      );

      if (subscriptionWithCustomerEmail?.customerEmail) {
        const searchResult = await client.subscriptions.list({
          search: subscriptionWithCustomerEmail.customerEmail,
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
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(5);

      for (const subscription of result.data) {
        expect(subscription.status).toBe('active');
      }
    });

    it('should include pageSlug when a page is associated', async () => {
      const result = await client.subscriptions.list({ limit: 10 });

      const subWithPage = result.data.find((s) => s.pageId != null);
      if (!subWithPage) return;

      expect(typeof subWithPage.pageSlug === 'string' || subWithPage.pageSlug == null).toBe(true);
    });

    it('should return clientIp as a string or undefined', async () => {
      const result = await client.subscriptions.list({ limit: 10 });

      for (const subscription of result.data) {
        expect(
          subscription.clientIp === undefined || typeof subscription.clientIp === 'string'
        ).toBe(true);
      }
    });

    it('should expose taxSource on subscriptions when set', async () => {
      const result = await client.subscriptions.list({ limit: 25 });
      const subscriptionWithTaxSource = result.data.find(
        (subscription) => (subscription as Record<string, unknown>).taxSource != null
      );

      const taxSource = (subscriptionWithTaxSource as Record<string, unknown>).taxSource;
      expect(['fixed_tax_rate', 'stripe_tax']).toContain(taxSource);
    });

    it('should expose a structured taxRates snapshot when fixed_tax_rate is used', async () => {
      const result = await client.subscriptions.list({ limit: 50 });

      const subscriptionWithFixedTaxRates = result.data.find((subscription) => {
        const s = subscription as Record<string, unknown>;
        const taxRates = s.taxRates as unknown[] | undefined;
        return s.taxSource === 'fixed_tax_rate' && Array.isArray(taxRates) && taxRates.length > 0;
      });

      const taxRates = (subscriptionWithFixedTaxRates as Record<string, unknown>)
        .taxRates as Record<string, unknown>[];
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

  describe('cancel', () => {
    it('rejects a cancel against a non-existent subscription with a 404', async () => {
      const fakeId = '6812fe6e9f39b6760576f01c';
      await expect(
        client.subscriptions.cancel(fakeId, { cancelImmediately: true }),
      ).rejects.toThrow(/not found/i);
    });

    /**
     * Server-side XOR enforcement on the timing fields. The SDK's
     * discriminated-union type prevents this combo at compile time, so we
     * defeat it via `as never` to assert the wire-level enforcement still
     * fires. Targets a non-existent id so the request can't accidentally
     * cancel a real subscription if the server XOR were ever removed.
     */
    it('rejects a body with multiple timing fields (server XOR — only one allowed)', async () => {
      const fakeId = '6812fe6e9f39b6760576f01c';
      await expect(
        client.subscriptions.cancel(fakeId, {
          cancelImmediately: true,
          cancelAtPeriodEnd: true,
        } as never),
      ).rejects.toThrow();
    });

    /**
     * End-to-end sanity: list subscriptions, find the first active one for
     * the test seller, and cancel it. Verifies the full SDK pipeline (auth,
     * path construction, body marshaling, response unwrapping) against a
     * live API. This is run locally only — production runs MUST NOT pick a
     * real customer's subscription to cancel; the integration env should
     * point at a test seller account.
     */
    it('cancels the first active subscription found via list (sanity)', async () => {
      const { data: subscriptions } = await client.subscriptions.list({
        status: 'active',
        limit: 10,
      });

      const target = subscriptions[0];
      if (!target) {
        throw new Error(
          'Integration target has no active subscriptions to cancel — seed one first.',
        );
      }

      const result = await client.subscriptions.cancel(target.id, {
        cancelImmediately: true,
        reason: 'SDK integration test',
      });

      expect(result.data.success).toBe(true);
    });
  });
});
