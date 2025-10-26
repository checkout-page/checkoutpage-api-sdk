import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('BookingResource Integration Tests', () => {
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
    it('should fetch a list of bookings', async () => {
      const result = await client.bookings.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('should return proper structure for booking objects', async () => {
      const result = await client.bookings.list({ limit: 1 });
      const booking = result.data[0];

      expect(result.data.length).toBe(1);
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('status');
      expect(booking).toHaveProperty('amount');
      expect(booking).toHaveProperty('createdAt');
      expect(booking).toHaveProperty('updatedAt');
      expect(booking).toHaveProperty('taxBreakdown');

      expect(typeof booking.id).toBe('string');
      expect(typeof booking.status).toBe('string');
      expect(typeof booking.amount).toBe('number');
      expect(Array.isArray(booking.taxBreakdown)).toBe(true);
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.bookings.list({
        limit: 5,
      });

      expect(result.data.length).toEqual(5);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.bookings.list({
        limit: 1,
      });

      const secondPage = await client.bookings.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(secondPage.data.length).toBeGreaterThan(0);
      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      // Get a few items first to have something to page backwards from
      const moveAwayFromStart = await client.bookings.list({
        limit: 5,
      });

      const firstPage = await client.bookings.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });

      const previousPage = await client.bookings.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      expect(previousPage.data.length).toBeGreaterThan(0);
      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
    });

    it('should filter bookings by search query', async () => {
      const result = await client.bookings.list({
        search: 'integration@checkoutpage.com',
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter bookings by status', async () => {
      const result = await client.bookings.list({
        status: 'paid',
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(1);

      for (const booking of result.data) {
        expect(booking.status).toBe('paid');
      }
    });

    it('should filter bookings by pageId', async () => {
      // First get a booking to extract a pageId
      const allBookings = await client.bookings.list({ limit: 5 });

      const pageId = allBookings.data[0].pageId;
      const filtered = await client.bookings.list({
        pageId,
        limit: 10,
      });

      expect(filtered).toHaveProperty('data');
      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThan(1);

      // If there are results, they should all be from the requested page
      for (const booking of filtered.data) {
        expect(booking.pageId).toBe(pageId);
      }
    });

    it('should return empty array when search has no matches', async () => {
      const result = await client.bookings.list({
        search: 'nonexistent-booking-query-12345-xyz',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(0);
    });

    it('should include total count', async () => {
      const result = await client.bookings.list();
      expect(typeof result.total).toBe('number');
      expect(result.total).toBeGreaterThan(0);
    });

    it('should return consistent pagination info', async () => {
      const result = await client.bookings.list({ limit: 10 });

      expect(result.has_more).toBe(typeof result.has_more === 'boolean' ? result.has_more : false);
      expect(result.total).toBeGreaterThanOrEqual(result.data.length);
    });
  });
});
