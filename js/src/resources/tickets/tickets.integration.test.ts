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
