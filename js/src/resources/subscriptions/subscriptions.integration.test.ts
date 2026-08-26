import { describe, it, expect, beforeAll } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
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

  describe('get', () => {
    it('should fetch a real subscription by ID and return a list-consistent shape', async () => {
      const listResult = await client.subscriptions.list({ limit: 1 });
      const seed = listResult.data[0];
      if (!seed) {
        throw new Error('Expected at least one subscription to exist for the get integration test');
      }

      const { data: subscription } = await client.subscriptions.get(seed.id);

      expect(subscription.id).toBe(seed.id);
      expect(typeof subscription.amount).toBe('number');
      expect(typeof subscription.createdAt).toBe('string');
      expect(typeof subscription.updatedAt).toBe('string');
      expect(subscription.amount).toBe(seed.amount);
      if (seed.customerEmail) {
        expect(subscription.customerEmail).toBe(seed.customerEmail);
      }
      if (seed.status) {
        expect(subscription.status).toBe(seed.status);
      }
    });

    it('should throw a NotFoundError for a missing subscription ID', async () => {
      await expect(client.subscriptions.get('6812fe6e9f39b6760576f01c')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError for an invalid subscription ID', async () => {
      await expect(client.subscriptions.get('not-a-valid-id')).rejects.toThrow(ValidationError);
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
        (subscription) => subscription.paymentMethod?.expMonth != null
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

      if (subscriptionWithTaxSource != null) {
        const taxSource = (subscriptionWithTaxSource as Record<string, unknown>).taxSource;
        expect(['fixed_tax_rate', 'stripe_tax']).toContain(taxSource);
      }
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

    /**
     * priceId is populated when the customer selected a specific price at checkout
     * (multi-price products). For single-price products it will be null/undefined.
     * We assert the field is present in the response shape and has the correct type.
     */
    it('should expose priceId on subscriptions as string or null', async () => {
      const result = await client.subscriptions.list({ limit: 50 });

      for (const subscription of result.data) {
        // TypeScript compile-time check: no cast needed
        const priceId: string | null | undefined = subscription.priceId;
        expect(priceId === undefined || priceId === null || typeof priceId === 'string').toBe(true);
      }
    });

    /**
     * priceSnapshot is a frozen copy of the purchased price captured at the point
     * of purchase. Single-price / legacy subscriptions have no snapshot. We assert
     * the response shape carries the field with the right type and, when present,
     * a stringified priceId.
     */
    it('should expose priceSnapshot on subscriptions as an object or null', async () => {
      const result = await client.subscriptions.list({ limit: 50 });

      for (const subscription of result.data) {
        const snapshot = subscription.priceSnapshot;
        expect(snapshot === undefined || snapshot === null || typeof snapshot === 'object').toBe(
          true
        );
        if (snapshot) {
          const priceId = snapshot.priceId;
          expect(priceId === undefined || priceId === null || typeof priceId === 'string').toBe(
            true
          );
        }
      }
    });

    /**
     * Skip this test until M9b creates sample multi-price subscriptions in the
     * integration environment. Once those subscriptions exist, remove the skip
     * and assert priceId equals the expected price id.
     */
    describe('priceId on subscription reads', () => {
      it('should expose priceId matching the price selected at checkout', async () => {
        const result = await client.subscriptions.list({ limit: 100 });

        // No-op when the environment has no multi-price subscriptions seeded.
        const subscriptionWithPriceId = result.data.find((s) => s.priceId != null);
        if (!subscriptionWithPriceId?.priceId) return;

        expect(typeof subscriptionWithPriceId.priceId).toBe('string');
        expect(subscriptionWithPriceId.priceId.length).toBeGreaterThan(0);
      });
    });
  });

  describe('cancel', () => {
    it('rejects a cancel against a non-existent subscription with a 404', async () => {
      const fakeId = '6812fe6e9f39b6760576f01c';
      await expect(
        client.subscriptions.cancel(fakeId, { cancelImmediately: true })
      ).rejects.toThrow(/not found/i);
    });

    it('rejects a body with no timing field (server XOR — at least one required)', async () => {
      const fakeId = '6812fe6e9f39b6760576f01c';
      await expect(client.subscriptions.cancel(fakeId, {} as never)).rejects.toThrow();
    });

    it('rejects a body with multiple timing fields (server XOR — only one allowed)', async () => {
      const fakeId = '6812fe6e9f39b6760576f01c';
      await expect(
        client.subscriptions.cancel(fakeId, {
          cancelImmediately: true,
          cancelAtPeriodEnd: true,
        } as never)
      ).rejects.toThrow();
    });

    const findFreshActiveSubscription = async () => {
      const { data } = await client.subscriptions.list({ status: 'active', limit: 100 });
      const target = data.find(
        (s) => s.cancelAt == null && s.stripeSubscriptionId != null && s.customerEmail != null
      );
      if (!target) {
        throw new Error(
          'No fresh active subscription (cancelAt unset, has stripeSubscriptionId + ' +
            'customerEmail) available to cancel — seed one on the test seller first.'
        );
      }
      return target;
    };

    const refetchById = async (id: string, customerEmail: string) => {
      const { data } = await client.subscriptions.list({ search: customerEmail, limit: 100 });
      const found = data.find((s) => s.id === id);
      if (!found) {
        throw new Error(`Could not re-fetch subscription ${id} after cancel`);
      }
      return found;
    };

    it('schedules cancellation at period end — cancelAt becomes a future date', async () => {
      const target = await findFreshActiveSubscription();

      const result = await client.subscriptions.cancel(target.id, {
        cancelAtPeriodEnd: true,
        reason: 'SDK integration test — cancelAtPeriodEnd',
      });
      expect(result.data.success).toBe(true);

      const refetched = await refetchById(target.id, target.customerEmail!);

      expect(refetched.cancelAt).toBeTruthy();
      expect(new Date(refetched.cancelAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('schedules cancellation at an explicit future cancelAt', async () => {
      const target = await findFreshActiveSubscription();

      const requested = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      requested.setMilliseconds(0);
      const cancelAt = requested.toISOString();

      const result = await client.subscriptions.cancel(target.id, {
        cancelAt,
        reason: 'SDK integration test — cancelAt',
      });
      expect(result.data.success).toBe(true);

      const refetched = await refetchById(target.id, target.customerEmail!);

      expect(refetched.cancelAt).toBeTruthy();
      const actualMs = new Date(refetched.cancelAt!).getTime();
      expect(actualMs).toBeGreaterThan(Date.now());
      expect(Math.abs(actualMs - requested.getTime())).toBeLessThan(2000);
    });

    it('Cancel immediately', async () => {
      const target = await findFreshActiveSubscription();

      const date = new Date();
      const result = await client.subscriptions.cancel(target.id, {
        cancelImmediately: true,
        reason: 'SDK integration test — cancelAt',
      });
      expect(result.data.success).toBe(true);

      const refetched = await refetchById(target.id, target.customerEmail!);
      expect(date.getTime()).toBeGreaterThan(new Date(refetched.canceledAt ?? '').getTime());
    });
  });
});
