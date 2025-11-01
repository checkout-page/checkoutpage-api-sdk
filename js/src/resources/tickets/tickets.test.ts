import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketResource } from './tickets';
import { CheckoutPageApiClient } from '../../client';
import type { ValidateTicketResponse } from '../../types';

describe('TicketResource', () => {
  let client: CheckoutPageApiClient;
  let ticketResource: TicketResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    ticketResource = new TicketResource(client);
  });

  describe('validate', () => {
    it('should validate a ticket with QR code without metadata', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123');

      expect(result).toEqual(mockValidationResponse);
      expect(result.success).toBe(true);
      expect(result.ticket.id).toBe('ticket_123');
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tickets/validate/qrcode_123',
        body: {},
      });
    });

    it('should validate a ticket with metadata', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          metadata: [
            {
              key: 'door',
              value: 'main_entrance',
              addedAt: '2024-01-01T10:00:00.000Z',
            },
            {
              key: 'validator',
              value: 'john_doe',
              addedAt: '2024-01-01T10:00:00.000Z',
            },
          ],
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123', {
        metadata: [
          { key: 'door', value: 'main_entrance' },
          { key: 'validator', value: 'john_doe' },
        ],
      });

      expect(result).toEqual(mockValidationResponse);
      expect(result.ticket.metadata).toHaveLength(2);
      expect(result.ticket.metadata![0].key).toBe('door');
      expect(result.ticket.metadata![1].key).toBe('validator');
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tickets/validate/qrcode_123',
        body: {
          metadata: [
            { key: 'door', value: 'main_entrance' },
            { key: 'validator', value: 'john_doe' },
          ],
        },
      });
    });

    it('should validate a ticket with metadata containing null values', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123', {
        metadata: [{ key: 'door', value: null }],
      });

      expect(result.success).toBe(true);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tickets/validate/qrcode_123',
        body: {
          metadata: [{ key: 'door', value: null }],
        },
      });
    });

    it('should include check-in history in the response', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [
            {
              method: 'QRSCAN',
              checkedInAt: '2024-01-01',
              checkedInByUserId: 'user_123',
              status: 'CHECKEDIN',
            },
          ],
          latestCheckIn: {
            method: 'QRSCAN',
            checkedInAt: '2024-01-01',
            checkedInByUserId: 'user_123',
            status: 'CHECKEDIN',
          },
          ticketShortId: 'TICK123',
          checkInStatus: 'CHECKEDIN',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123');

      expect(result.ticket.checkIns).toHaveLength(1);
      expect(result.ticket.checkIns[0].status).toBe('CHECKEDIN');
      expect(result.ticket.latestCheckIn).toBeDefined();
      expect(result.ticket.checkInStatus).toBe('CHECKEDIN');
    });

    it('should include pricing information in the response', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 10000,
          discountAmount: 1000,
          feeAmount: 500,
          taxAmount: 800,
          couponAmount: 500,
          revenue: 9800,
          currency: 'usd',
          livemode: true,
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123');

      expect(result.ticket.originalPrice).toBe(10000);
      expect(result.ticket.discountAmount).toBe(1000);
      expect(result.ticket.feeAmount).toBe(500);
      expect(result.ticket.taxAmount).toBe(800);
      expect(result.ticket.couponAmount).toBe(500);
      expect(result.ticket.revenue).toBe(9800);
      expect(result.ticket.currency).toBe('usd');
    });

    it('should include customer information in the response', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'PAID',
          orderId: 'order_123',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123');

      expect(result.ticket.customerName).toBe('John Doe');
      expect(result.ticket.customerEmail).toBe('john@example.com');
    });

    it('should handle canceled tickets', async () => {
      const mockValidationResponse: ValidateTicketResponse = {
        success: true,
        ticket: {
          id: 'ticket_123',
          sellerId: 'seller_123',
          chargeId: 'charge_123',
          pageId: 'page_123',
          status: 'CANCELED',
          orderId: 'order_123',
          customerEmail: 'customer@example.com',
          ticketTypeId: 'ticket_type_123',
          checkIns: [],
          ticketShortId: 'TICK123',
          originalPrice: 5000,
          discountAmount: 0,
          feeAmount: 500,
          taxAmount: 400,
          couponAmount: 0,
          revenue: 5900,
          livemode: true,
          canceledAt: '2024-01-02T00:00:00.000Z',
          orderedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: mockValidationResponse });

      const result = await ticketResource.validate('qrcode_123');

      expect(result.ticket.status).toBe('CANCELED');
      expect(result.ticket.canceledAt).toBe('2024-01-02T00:00:00.000Z');
    });
  });
});
