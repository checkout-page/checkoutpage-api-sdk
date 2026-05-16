import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingResource } from './bookings';
import { CheckoutPageApiClient } from '../../client';
import type { BookingList } from '../../types';

const BOOKING_ID_1 = '6812fe6e9f39b6760576f01c';
const BOOKING_ID_2 = '6812fe6e9f39b6760576f01d';
const PAGE_ID = '67fcbdac6a91c25ef2d3534a';
const CUSTOMER_ID = '507f1f77bcf86cd799439010';
const CURSOR_1 = '507f1f77bcf86cd799439011';
const CURSOR_2 = '507f1f77bcf86cd799439012';

const BASE_BOOKING: BookingList['data'][number] = {
  id: BOOKING_ID_1,
  amount: 10000,
  status: 'paid',
  orderId: 'order_123',
  customerEmail: 'customer@example.com',
  customerId: CUSTOMER_ID,
  sellerId: 'seller_123',
  pageId: PAGE_ID,
  currency: 'usd',
  taxBreakdown: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const DEFAULT_QUERY = {
  search: undefined,
  status: undefined,
  pageId: undefined,
  customerId: undefined,
  orderId: undefined,
  couponCode: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
  abandonmentStatus: undefined,
  limit: undefined,
  starting_after: undefined,
  ending_before: undefined,
};

describe('BookingResource', () => {
  let client: CheckoutPageApiClient;
  let bookingResource: BookingResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    bookingResource = new BookingResource(client);
  });

  describe('list', () => {
    it('should call the bookings endpoint with all default query params when called with no args', async () => {
      const mockBookingList: BookingList = { data: [], total: 0, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      await bookingResource.list();

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: DEFAULT_QUERY,
        path: '/v1/bookings/',
      });
    });

    it('should return the response from the client', async () => {
      const mockBookingList: BookingList = {
        data: [
          BASE_BOOKING,
          { ...BASE_BOOKING, id: BOOKING_ID_2, amount: 15000, status: 'pending' },
        ],
        total: 2,
        has_more: false,
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list();

      expect(result).toEqual(mockBookingList);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty list when no bookings exist', async () => {
      const mockBookingList: BookingList = { data: [], total: 0, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    // Pagination

    it('should pass limit as a string', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ limit: 10 });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ limit: '10' }) })
      );
    });

    it('should pass starting_after for cursor pagination', async () => {
      const mockList: BookingList = { data: [BASE_BOOKING], total: 100, has_more: true };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await bookingResource.list({ limit: 10, starting_after: CURSOR_1 });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, limit: '10', starting_after: CURSOR_1 },
        path: '/v1/bookings/',
      });
    });

    it('should pass ending_before for cursor pagination', async () => {
      const mockList: BookingList = { data: [BASE_BOOKING], total: 100, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await bookingResource.list({ limit: 10, ending_before: CURSOR_2 });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, limit: '10', ending_before: CURSOR_2 },
        path: '/v1/bookings/',
      });
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const stub = (id: string): BookingList['data'][number] => ({ ...BASE_BOOKING, id });
      const PAGE_1: BookingList = { data: [stub('b5'), stub('b4')], has_more: true, total: 5 };
      const PAGE_2: BookingList = { data: [stub('b3'), stub('b2')], has_more: true, total: 5 };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1)
        .mockResolvedValueOnce(PAGE_2)
        .mockResolvedValueOnce({ ...PAGE_1, has_more: false });

      await bookingResource.list({ limit: 2 });
      await bookingResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await bookingResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 'b4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 'b3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });

    // Existing filters

    it('should pass search param', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ search: 'searched@example.com' });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ search: 'searched@example.com' }),
        })
      );
    });

    it('should pass status filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ status: 'paid' });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ status: 'paid' }) })
      );
    });

    it('should pass pageId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ pageId: PAGE_ID });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ pageId: PAGE_ID }) })
      );
    });

    // New filters

    it('should pass customerId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ customerId: CUSTOMER_ID });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, customerId: CUSTOMER_ID },
        path: '/v1/bookings/',
      });
    });

    it('should pass orderId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ orderId: 'ORD-9182' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, orderId: 'ORD-9182' },
        path: '/v1/bookings/',
      });
    });

    it('should pass couponCode filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ couponCode: 'SUMMER20' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, couponCode: 'SUMMER20' },
        path: '/v1/bookings/',
      });
    });

    it('should pass createdAfter filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ createdAfter: '2025-01-01T00:00:00Z' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, createdAfter: '2025-01-01T00:00:00Z' },
        path: '/v1/bookings/',
      });
    });

    it('should pass createdBefore filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ createdBefore: '2025-01-31T23:59:59Z' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, createdBefore: '2025-01-31T23:59:59Z' },
        path: '/v1/bookings/',
      });
    });

    it('should pass both createdAfter and createdBefore for a date range', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({
        createdAfter: '2025-01-01T00:00:00Z',
        createdBefore: '2025-01-31T23:59:59Z',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          ...DEFAULT_QUERY,
          createdAfter: '2025-01-01T00:00:00Z',
          createdBefore: '2025-01-31T23:59:59Z',
        },
        path: '/v1/bookings/',
      });
    });

    it('should pass abandonmentStatus=abandoned', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ abandonmentStatus: 'abandoned' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, abandonmentStatus: 'abandoned' },
        path: '/v1/bookings/',
      });
    });

    it('should pass abandonmentStatus=recovered', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ abandonmentStatus: 'recovered' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, abandonmentStatus: 'recovered' },
        path: '/v1/bookings/',
      });
    });

    it('should not include productId (payments-only field) in the query', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await bookingResource.list({ customerId: CUSTOMER_ID });

      const callArgs = vi.mocked(client.request).mock.calls[0][0] as {
        query: Record<string, unknown>;
      };
      expect(callArgs.query).not.toHaveProperty('productId');
    });

    it('should pass all supported filters together', async () => {
      const mockList: BookingList = { data: [BASE_BOOKING], total: 1, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await bookingResource.list({
        search: 'customer@example.com',
        status: 'paid',
        pageId: PAGE_ID,
        customerId: CUSTOMER_ID,
        orderId: 'ORD-9182',
        couponCode: 'SUMMER20',
        createdAfter: '2025-01-01T00:00:00Z',
        createdBefore: '2025-01-31T23:59:59Z',
        abandonmentStatus: 'abandoned',
        limit: 20,
        starting_after: CURSOR_1,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'customer@example.com',
          status: 'paid',
          pageId: PAGE_ID,
          customerId: CUSTOMER_ID,
          orderId: 'ORD-9182',
          couponCode: 'SUMMER20',
          createdAfter: '2025-01-01T00:00:00Z',
          createdBefore: '2025-01-31T23:59:59Z',
          abandonmentStatus: 'abandoned',
          limit: '20',
          starting_after: CURSOR_1,
          ending_before: undefined,
        },
        path: '/v1/bookings/',
      });
    });
  });
});
