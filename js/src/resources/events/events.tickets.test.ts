import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTicketsResource, EventsResource } from './events';
import { CheckoutPageApiClient } from '../../client';
import type { TicketList } from '../../types';

const TICKET_ID = '6812fe6e9f39b6760576f01c';
const PAGE_ID = '67fcbdac6a91c25ef2d3534a';
const BOOKING_ID = '6812fe6e9f39b6760576f01d';
const CUSTOMER_ID = '507f1f77bcf86cd799439010';
const TICKET_TYPE_ID = '507f1f77bcf86cd799439011';
const TICKET_GROUP_ID = '507f1f77bcf86cd799439012';
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
  status: 'PAID',
  checkIns: [],
  customerEmail: 'customer@example.com',
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

const DEFAULT_QUERY = {
  pageId: undefined,
  bookingId: undefined,
  orderId: undefined,
  customerId: undefined,
  ticketTypeId: undefined,
  ticketGroupId: undefined,
  status: undefined,
  checkInStatus: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
  search: undefined,
  limit: undefined,
  starting_after: undefined,
  ending_before: undefined,
};

describe('EventTicketsResource', () => {
  let client: CheckoutPageApiClient;
  let ticketsResource: EventTicketsResource;

  beforeEach(() => {
    client = {
      request: vi.fn().mockResolvedValue(LIST_RESPONSE),
    } as unknown as CheckoutPageApiClient;
    ticketsResource = new EventTicketsResource(client);
  });

  it('lists tickets with no params', async () => {
    const result = await ticketsResource.list();

    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/tickets/',
      query: DEFAULT_QUERY,
    });
    expect(result).toEqual(LIST_RESPONSE);
  });

  it('passes all filters through and serializes limit', async () => {
    await ticketsResource.list({
      pageId: PAGE_ID,
      bookingId: BOOKING_ID,
      orderId: 'order_123',
      customerId: CUSTOMER_ID,
      ticketTypeId: TICKET_TYPE_ID,
      ticketGroupId: TICKET_GROUP_ID,
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
        ...DEFAULT_QUERY,
        pageId: PAGE_ID,
        bookingId: BOOKING_ID,
        orderId: 'order_123',
        customerId: CUSTOMER_ID,
        ticketTypeId: TICKET_TYPE_ID,
        ticketGroupId: TICKET_GROUP_ID,
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

  it('is exposed as events.tickets', () => {
    const events = new EventsResource(client);

    expect(events.tickets).toBeInstanceOf(EventTicketsResource);
  });
});
