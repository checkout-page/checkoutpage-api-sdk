import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('EventTicketsResource Integration Tests', () => {
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
    it('should fetch a paginated list of tickets', async () => {
      const result = await client.events.tickets.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('should return proper structure for ticket objects', async () => {
      const result = await client.events.tickets.list({ limit: 1 });
      const ticket = result.data[0];

      if (!ticket) {
        throw new Error('No tickets found in the integration environment for structure test');
      }

      expect(typeof ticket.id).toBe('string');
      expect(typeof ticket.ticketShortId).toBe('string');
      expect(['PAID', 'CANCELED']).toContain(ticket.status);
      expect(typeof ticket.bookingId).toBe('string');
      expect(typeof ticket.pageId).toBe('string');
      expect(typeof ticket.ticketTypeId).toBe('string');
      expect(typeof ticket.customerEmail).toBe('string');
      expect(Array.isArray(ticket.checkIns)).toBe(true);
      expect(ticket.livemode).toBe(true);
      expect(new Date(ticket.createdAt).toString()).not.toBe('Invalid Date');
      expect(new Date(ticket.orderedAt).toString()).not.toBe('Invalid Date');
    });

    it('should respect limit and report has_more', async () => {
      const result = await client.events.tickets.list({ limit: 1 });

      expect(result.data.length).toBeLessThanOrEqual(1);
      if (result.total > 1) {
        expect(result.has_more).toBe(true);
      }
    });

    it('should filter by pageId', async () => {
      const all = await client.events.tickets.list({ limit: 1 });
      const ticket = all.data[0];
      if (!ticket) {
        throw new Error('No tickets found in the integration environment for pageId filter test');
      }

      const filtered = await client.events.tickets.list({ pageId: ticket.pageId, limit: 100 });

      expect(filtered.data.length).toBeGreaterThan(0);
      expect(filtered.data.every((t) => t.pageId === ticket.pageId)).toBe(true);
    });

    it('should filter by orderId', async () => {
      const all = await client.events.tickets.list({ limit: 1 });
      const ticket = all.data[0];
      if (!ticket) {
        throw new Error('No tickets found in the integration environment for orderId filter test');
      }

      const filtered = await client.events.tickets.list({ orderId: ticket.orderId, limit: 100 });

      expect(filtered.data.length).toBeGreaterThan(0);
      expect(filtered.data.every((t) => t.orderId === ticket.orderId)).toBe(true);
    });

    it('should filter by status', async () => {
      const paid = await client.events.tickets.list({ status: 'PAID', limit: 100 });

      expect(paid.data.every((t) => t.status === 'PAID')).toBe(true);
    });

    it('should filter by checkInStatus CHECKEDIN', async () => {
      const checkedIn = await client.events.tickets.list({ checkInStatus: 'CHECKEDIN', limit: 100 });

      expect(checkedIn.data.every((t) => t.latestCheckIn?.status === 'CHECKEDIN')).toBe(true);
    });

    it('should paginate with starting_after', async () => {
      const page1 = await client.events.tickets.list({ limit: 1 });
      if (page1.total <= 1 || !page1.data[0]) {
        return;
      }

      const page2 = await client.events.tickets.list({ limit: 1, starting_after: page1.data[0].id });

      expect(page2.data.length).toBe(1);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
    });
  });
});
