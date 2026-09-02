import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketResource } from './tickets';
import { CheckoutPageApiClient } from '../../client';
import type { TicketList, ValidateTicketResponse } from '../../types';

const TICKET_ID = '6812fe6e9f39b6760576f01c';
const PAGE_ID = '67fcbdac6a91c25ef2d3534a';
const BOOKING_ID = '6812fe6e9f39b6760576f01d';
const CUSTOMER_ID = '507f1f77bcf86cd799439010';
const TICKET_TYPE_ID = '507f1f77bcf86cd799439011';
const CURSOR = '507f1f77bcf86cd799439013';

const BASE_TICKET: TicketList['data'][number] = {
  id: TICKET_ID,
  seller: 'seller_123',
  sellerId: 'seller_123',
  charge: BOOKING_ID,
  bookingId: BOOKING_ID,
  orderId: 'order_123',
  page: PAGE_ID,
  pageId: PAGE_ID,
  ticketType: TICKET_TYPE_ID,
  ticketTypeId: TICKET_TYPE_ID,
  originalPrice: 1000,
  discountAmount: 0,
  feeAmount: 0,
  taxAmount: 0,
  couponAmount: 0,
  revenue: 1000,
  customer: CUSTOMER_ID,
  customerId: CUSTOMER_ID,
  ticketShortId: 'ABC12345',
  checkInCode: TICKET_ID,
  status: 'PAID',
  checkIns: [],
  customerName: 'Customer Example',
  attendeeName: 'Customer Example',
  customerEmail: 'customer@example.com',
  attendeeEmail: 'customer@example.com',
  livemode: true,
  orderedAt: '2024-01-01T00:00:00.000Z',
  metadata: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const LIST_RESPONSE: TicketList = {
  data: [BASE_TICKET],
  total: 1,
  has_more: false,
};

const DEFAULT_LIST_QUERY = {
  pageId: undefined,
  bookingId: undefined,
  orderId: undefined,
  customerId: undefined,
  ticketTypeId: undefined,
  status: undefined,
  checkInStatus: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
  search: undefined,
  limit: undefined,
  starting_after: undefined,
  ending_before: undefined,
};

describe('TicketResource', () => {
  let client: CheckoutPageApiClient;
  let ticketResource: TicketResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    ticketResource = new TicketResource(client);
  });

  describe('list', () => {
    it('lists tickets with no params', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(LIST_RESPONSE);

      const result = await ticketResource.list();

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/tickets/',
        query: DEFAULT_LIST_QUERY,
      });
      expect(result).toEqual(LIST_RESPONSE);
    });

    it('passes all filters through and serializes limit', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(LIST_RESPONSE);

      await ticketResource.list({
        pageId: PAGE_ID,
        bookingId: BOOKING_ID,
        orderId: 'order_123',
        customerId: CUSTOMER_ID,
        ticketTypeId: TICKET_TYPE_ID,
        status: 'PAID',
        checkInStatus: 'CHECKEDIN',
        createdAfter: '2024-01-01T00:00:00.000Z',
        createdBefore: '2024-02-01T00:00:00.000Z',
        search: 'alice',
        limit: 25,
        starting_after: CURSOR,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/tickets/',
        query: {
          ...DEFAULT_LIST_QUERY,
          pageId: PAGE_ID,
          bookingId: BOOKING_ID,
          orderId: 'order_123',
          customerId: CUSTOMER_ID,
          ticketTypeId: TICKET_TYPE_ID,
          status: 'PAID',
          checkInStatus: 'CHECKEDIN',
          createdAfter: '2024-01-01T00:00:00.000Z',
          createdBefore: '2024-02-01T00:00:00.000Z',
          search: 'alice',
          limit: '25',
          starting_after: CURSOR,
        },
      });
    });
  });

  describe('update', () => {
    it('updates the attendee name and email', async () => {
      const updated = {
        ...BASE_TICKET,
        attendeeName: 'Jane Updated',
        attendeeEmail: 'jane-updated@example.com',
      };
      vi.spyOn(client, 'request').mockResolvedValue({ data: updated });

      const result = await ticketResource.update(TICKET_ID, {
        attendeeName: 'Jane Updated',
        attendeeEmail: 'jane-updated@example.com',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/tickets/${TICKET_ID}`,
        body: {
          attendeeName: 'Jane Updated',
          attendeeEmail: 'jane-updated@example.com',
        },
      });
      expect(result.data.attendeeName).toBe('Jane Updated');
    });

    it('omits fields that were not supplied', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: BASE_TICKET });

      await ticketResource.update(TICKET_ID, { attendeeName: 'Only Name' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/tickets/${TICKET_ID}`,
        body: { attendeeName: 'Only Name' },
      });
    });

    it('passes null through to clear the attendee name', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: BASE_TICKET });

      await ticketResource.update(TICKET_ID, { attendeeName: null });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/tickets/${TICKET_ID}`,
        body: { attendeeName: null },
      });
    });

    it('throws when the ticket id is missing', async () => {
      await expect(ticketResource.update('', { attendeeName: 'X' })).rejects.toThrow(
        'Ticket ID is required',
      );
    });
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
          attendeeEmail: 'customer@example.com',
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
          attendeeEmail: 'customer@example.com',
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
          attendeeEmail: 'customer@example.com',
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
          attendeeEmail: 'customer@example.com',
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
          attendeeEmail: 'customer@example.com',
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
          attendeeEmail: 'customer@example.com',
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
