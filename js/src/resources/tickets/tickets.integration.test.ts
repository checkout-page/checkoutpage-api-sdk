import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('TicketResource Integration Tests', () => {
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
      const result = await client.tickets.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('should return proper structure for ticket objects', async () => {
      const result = await client.tickets.list({ limit: 1 });
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
      const result = await client.tickets.list({ limit: 1 });

      expect(result.data.length).toBeLessThanOrEqual(1);
      if (result.total > 1) {
        expect(result.has_more).toBe(true);
      }
    });

    it('should filter by pageId', async () => {
      const all = await client.tickets.list({ limit: 1 });
      const ticket = all.data[0];
      if (!ticket) {
        throw new Error('No tickets found in the integration environment for pageId filter test');
      }

      const filtered = await client.tickets.list({ pageId: ticket.pageId, limit: 100 });

      expect(filtered.data.length).toBeGreaterThan(0);
      expect(filtered.data.every((t) => t.pageId === ticket.pageId)).toBe(true);
    });

    it('should filter by orderId', async () => {
      const all = await client.tickets.list({ limit: 1 });
      const ticket = all.data[0];
      if (!ticket) {
        throw new Error('No tickets found in the integration environment for orderId filter test');
      }

      const filtered = await client.tickets.list({ orderId: ticket.orderId, limit: 100 });

      expect(filtered.data.length).toBeGreaterThan(0);
      expect(filtered.data.every((t) => t.orderId === ticket.orderId)).toBe(true);
    });

    it('should filter by status', async () => {
      const paid = await client.tickets.list({ status: 'PAID', limit: 100 });

      expect(paid.data.every((t) => t.status === 'PAID')).toBe(true);
    });

    it('should filter by checkInStatus CHECKEDIN', async () => {
      const checkedIn = await client.tickets.list({ checkInStatus: 'CHECKEDIN', limit: 100 });

      expect(checkedIn.data.every((t) => t.latestCheckIn?.status === 'CHECKEDIN')).toBe(true);
    });

    it('should paginate with starting_after', async () => {
      const page1 = await client.tickets.list({ limit: 1 });

      const page2 = await client.tickets.list({ limit: 1, starting_after: page1.data[0].id });

      expect(page2.data.length).toBe(1);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
    });
  });

  describe('validate', () => {
    it('should validate a ticket with QR code', async () => {
      const result = await client.tickets.validate(config.testTicketId);

      expect(result).toHaveProperty('ticket');
      expect(result.success).toBe(true);
    });

    it('should return complete ticket structure', async () => {
      const result = await client.tickets.validate(config.testTicketId);
      const ticket = result.ticket;

      // Required fields
      expect(ticket).toHaveProperty('id');
      expect(ticket).toHaveProperty('sellerId');
      expect(ticket).toHaveProperty('chargeId');
      expect(ticket).toHaveProperty('pageId');
      expect(ticket).toHaveProperty('status');
      expect(ticket).toHaveProperty('orderId');
      expect(ticket).toHaveProperty('customerEmail');
      expect(ticket).toHaveProperty('ticketTypeId');
      expect(ticket).toHaveProperty('checkIns');
      expect(ticket).toHaveProperty('ticketShortId');
      expect(ticket).toHaveProperty('originalPrice');
      expect(ticket).toHaveProperty('discountAmount');
      expect(ticket).toHaveProperty('feeAmount');
      expect(ticket).toHaveProperty('taxAmount');
      expect(ticket).toHaveProperty('couponAmount');
      expect(ticket).toHaveProperty('revenue');
      expect(ticket).toHaveProperty('livemode');
      expect(ticket).toHaveProperty('orderedAt');
      expect(ticket).toHaveProperty('createdAt');
      expect(ticket).toHaveProperty('updatedAt');

      // Type validation
      expect(typeof ticket.id).toBe('string');
      expect(typeof ticket.status).toBe('string');
      expect(typeof ticket.customerEmail).toBe('string');
      expect(typeof ticket.originalPrice).toBe('number');
      expect(typeof ticket.revenue).toBe('number');
      expect(typeof ticket.livemode).toBe('boolean');
      expect(Array.isArray(ticket.checkIns)).toBe(true);
    });

    it('should validate ticket status is either PAID or CANCELED', async () => {
      const result = await client.tickets.validate(config.testTicketId);

      expect(['PAID', 'CANCELED']).toContain(result.ticket.status);
    });

    it('should include pricing breakdown', async () => {
      const result = await client.tickets.validate(config.testTicketId);
      const ticket = result.ticket;

      expect(typeof ticket.originalPrice).toBe('number');
      expect(typeof ticket.discountAmount).toBe('number');
      expect(typeof ticket.feeAmount).toBe('number');
      expect(typeof ticket.taxAmount).toBe('number');
      expect(typeof ticket.couponAmount).toBe('number');
      expect(typeof ticket.revenue).toBe('number');

      expect(ticket.revenue).toBeGreaterThanOrEqual(0);
    });

    it('should include check-in information', async () => {
      const result = await client.tickets.validate(config.testTicketId);
      const ticket = result.ticket;

      expect(Array.isArray(ticket.checkIns)).toBe(true);

      const checkIn = ticket.checkIns[0];
      expect(checkIn).toHaveProperty('method');
      expect(checkIn).toHaveProperty('checkedInAt');
      expect(checkIn).toHaveProperty('checkedInByUserId');
      expect(checkIn).toHaveProperty('status');
      expect(['QRSCAN', 'MANUAL']).toContain(checkIn.method);
      expect(['UNCHECKEDIN', 'CHECKEDIN']).toContain(checkIn.status);
    });

    it('should validate a ticket with metadata', async () => {
      const timestamp = new Date().toISOString();
      const result = await client.tickets.validate(config.testTicketId, {
        metadata: [
          { key: 'validated_by', value: 'integration_test' },
          { key: 'validation_timestamp', value: timestamp },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();

      expect(result.ticket.metadata).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'validated_by', value: 'integration_test' }),
          expect.objectContaining({ key: 'validation_timestamp', value: timestamp }),
        ])
      );
    });

    it('should delete metadata with null values', async () => {
      const result = await client.tickets.validate(config.testTicketId, {
        metadata: [{ key: 'validated_by', value: null }],
      });

      expect(result.success).toBe(true);

      expect(result.ticket.metadata).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'validated_by', value: 'integration_test' }),
        ])
      );
      expect(result.message).toEqual(
        'Ticket validated and metadata updated. Deleted: validated_by'
      );
    });

    it('should include customer information when available', async () => {
      const result = await client.tickets.validate(config.testTicketId);
      const ticket = result.ticket;

      expect(typeof ticket.customerEmail).toBe('string');
      expect(ticket.customerEmail.length).toBeGreaterThan(0);

      expect(typeof ticket.customerName).toBe('string');
    });
  });
});
