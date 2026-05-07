import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('SubscriptionPaymentResource Integration Tests', () => {
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
    it('should return paginated list with proper envelope shape and typed records', async () => {
      const result = await client.subscriptionPayments.list();

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
        expect(payment).toHaveProperty('createdAt');
        expect(payment).toHaveProperty('updatedAt');

        expect(typeof payment.id).toBe('string');
        expect(typeof payment.amount).toBe('number');
        expect(typeof payment.createdAt).toBe('string');
        expect(typeof payment.updatedAt).toBe('string');
      }
    });

    it('should respect limit: 2', async () => {
      const result = await client.subscriptionPayments.list({
        limit: 2,
      });

      expect(result.data.length).toBe(2);
    });

    it('should use cursor-based pagination with starting_after producing a different first record', async () => {
      const firstPage = await client.subscriptionPayments.list({
        limit: 1,
      });

      const secondPage = await client.subscriptionPayments.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
    });

    it('should use cursor-based pagination with ending_before for paging backwards', async () => {
      const baseline = await client.subscriptionPayments.list({ limit: 2 });
      expect(baseline.data.length).toBeGreaterThanOrEqual(2);

      const forwardPage = await client.subscriptionPayments.list({
        limit: 1,
        starting_after: baseline.data[0].id,
      });
      expect(forwardPage.data.length).toBe(1);

      const backwardPage = await client.subscriptionPayments.list({
        limit: 1,
        ending_before: forwardPage.data[0].id,
      });

      expect(backwardPage.data.length).toBe(1);
      expect(forwardPage.data[0].id).not.toBe(backwardPage.data[0].id);
      expect(backwardPage.data[0].id).toBe(baseline.data[0].id);
    });

    it('should filter by paymentStatus: succeeded — every returned record has paymentStatus === succeeded', async () => {
      const result = await client.subscriptionPayments.list({
        paymentStatus: 'succeeded',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      for (const payment of result.data) {
        expect(payment.paymentStatus).toBe('succeeded');
      }
    });

    it('should filter by paid: true — every returned record has paid === true', async () => {
      const result = await client.subscriptionPayments.list({
        paid: 'true',
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

      for (const payment of result.data) {
        expect(payment.paid).toBe(true);
      }
    });

    it('should filter by subscriptionId — all returned records match the given subscriptionId', async () => {
      // Pick a known subscriptionId from the baseline list
      const baseline = await client.subscriptionPayments.list({ limit: 20 });

      const paymentWithSubscriptionId = baseline.data.find((p) => p.subscriptionId);

      if (!paymentWithSubscriptionId || !paymentWithSubscriptionId.subscriptionId) {
        throw new Error('No subscription payment with subscriptionId found for filter test');
      }

      const subscriptionId = paymentWithSubscriptionId.subscriptionId;
      const filtered = await client.subscriptionPayments.list({ subscriptionId });

      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThan(0);

      for (const payment of filtered.data) {
        expect(payment.subscriptionId).toBe(subscriptionId);
      }
    });

    it('should filter by customerId — all returned records match the given customerId', async () => {
      // Pick a known customerId from the baseline list
      const baseline = await client.subscriptionPayments.list({ limit: 20 });

      const paymentWithCustomerId = baseline.data.find((p) => p.customerId);

      if (!paymentWithCustomerId || !paymentWithCustomerId.customerId) {
        throw new Error('No subscription payment with customerId found for filter test');
      }

      const customerId = paymentWithCustomerId.customerId;
      const filtered = await client.subscriptionPayments.list({ customerId });

      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThan(0);

      for (const payment of filtered.data) {
        expect(payment.customerId).toBe(customerId);
      }
    });

    it('should filter by pageId — all returned records match the given pageId (skip if none have pageId)', async () => {
      const baseline = await client.subscriptionPayments.list({ limit: 20 });

      const paymentWithPageId = baseline.data.find((p) => p.pageId);

      if (!paymentWithPageId || !paymentWithPageId.pageId) {
        // Skip: no records with pageId in the baseline sample
        return;
      }

      const pageId = paymentWithPageId.pageId;
      const filtered = await client.subscriptionPayments.list({ pageId });

      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThan(0);

      for (const payment of filtered.data) {
        expect(payment.pageId).toBe(pageId);
      }
    });

    it('should filter by billingReason: subscription_create — every returned record matches', async () => {
      const result = await client.subscriptionPayments.list({
        billingReason: 'subscription_create',
      });

      expect(Array.isArray(result.data)).toBe(true);

      for (const payment of result.data) {
        expect(payment.billingReason).toBe('subscription_create');
      }
    });

    it('should filter by createdAfter / createdBefore — all results fall within the date range', async () => {
      // Pick a date from a baseline record, then query before that date
      const baseline = await client.subscriptionPayments.list({ limit: 10 });
      expect(baseline.data.length).toBeGreaterThan(0);

      // Use the most recent record's createdAt as our upper bound
      const latestRecord = baseline.data[0];
      const upperBound = latestRecord.createdAt;

      // Use a date far in the past as the lower bound
      const lowerBound = '2020-01-01T00:00:00.000Z';

      const result = await client.subscriptionPayments.list({
        createdAfter: lowerBound,
        createdBefore: upperBound,
      });

      expect(Array.isArray(result.data)).toBe(true);

      for (const payment of result.data) {
        expect(new Date(payment.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(upperBound).getTime()
        );
        expect(new Date(payment.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(lowerBound).getTime()
        );
      }
    });

    it('should support combined filters (paymentStatus + paid)', async () => {
      const result = await client.subscriptionPayments.list({
        paymentStatus: 'succeeded',
        paid: 'true',
      });

      expect(Array.isArray(result.data)).toBe(true);

      for (const payment of result.data) {
        expect(payment.paymentStatus).toBe('succeeded');
        expect(payment.paid).toBe(true);
      }
    });

    it('should include denormalized fields where source data exists', async () => {
      const result = await client.subscriptionPayments.list({ limit: 20 });

      expect(result.data.length).toBeGreaterThan(0);

      // Find a record with denormalized fields present
      const richRecord = result.data.find(
        (p) => p.customerEmail || p.customerName || p.productTitle || p.pageSlug || p.currency
      );

      if (richRecord) {
        if (richRecord.customerEmail !== undefined) {
          expect(typeof richRecord.customerEmail).toBe('string');
        }
        if (richRecord.customerName !== undefined) {
          expect(typeof richRecord.customerName).toBe('string');
        }
        if (richRecord.currency !== undefined) {
          expect(typeof richRecord.currency).toBe('string');
        }
      }
      // If no denormalized fields are present in the sample, the assertion passes silently
      // as denormalized fields are optional
    });

    it('should benchmark search/filter for known subscriptionIds within acceptable time', async () => {
      // Collect up to 5 distinct subscriptionIds from a baseline sample
      const baseline = await client.subscriptionPayments.list({ limit: 50 });

      const subscriptionIds = [
        ...new Set(baseline.data.map((p) => p.subscriptionId).filter(Boolean)),
      ].slice(0, 5) as string[];

      if (subscriptionIds.length === 0) {
        throw new Error('No records with subscriptionId found for benchmark test');
      }

      const MAX_MS_PER_QUERY = 5000;

      for (const subscriptionId of subscriptionIds) {
        const start = Date.now();
        const result = await client.subscriptionPayments.list({ subscriptionId });
        const elapsed = Date.now() - start;

        expect(result.data.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(MAX_MS_PER_QUERY);
      }
    });

    it('should verify cross-record consistency — list({ subscriptionId }) total > 0 for a subscription that has payments', async () => {
      const baseline = await client.subscriptionPayments.list({ limit: 20 });

      const paymentWithSubscriptionId = baseline.data.find((p) => p.subscriptionId);

      if (!paymentWithSubscriptionId || !paymentWithSubscriptionId.subscriptionId) {
        throw new Error('No subscription payment with subscriptionId found for consistency test');
      }

      const subscriptionId = paymentWithSubscriptionId.subscriptionId;
      const result = await client.subscriptionPayments.list({ subscriptionId });

      expect(result.total).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);

      for (const payment of result.data) {
        expect(payment.subscriptionId).toBe(subscriptionId);
      }
    });
  });
});
