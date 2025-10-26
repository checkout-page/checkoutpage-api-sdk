import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingResource } from './bookings';
import { CheckoutPageApiClient } from '../../client';
import type { BookingList } from '../../types';

describe('BookingResource', () => {
  let client: CheckoutPageApiClient;
  let bookingResource: BookingResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    bookingResource = new BookingResource(client);
  });

  describe('list', () => {
    it('should fetch a list of bookings with default parameters', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: 'page_123',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
          {
            id: '6812fe6e9f39b6760576f01d',
            amount: 15000,
            status: 'pending',
            orderId: 'order_124',
            customerEmail: 'customer2@example.com',
            customerId: 'cust_124',
            sellerId: 'seller_123',
            pageId: 'page_124',
            currency: 'usd',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        total: 2,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({});

      expect(result).toEqual(mockBookingList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
          status: undefined,
          pageId: undefined,
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings with cursor-based pagination using starting_after', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: 'page_123',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        has_more: true,
        total: 100,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        limit: 10,
        starting_after: '507f1f77bcf86cd799439011',
      });

      expect(result).toEqual(mockBookingList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: '10',
          starting_after: '507f1f77bcf86cd799439011',
          ending_before: undefined,
          status: undefined,
          pageId: undefined,
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings with cursor-based pagination using ending_before', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: 'page_123',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        has_more: false,
        total: 100,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        limit: 10,
        ending_before: '507f1f77bcf86cd799439012',
      });

      expect(result).toEqual(mockBookingList);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: '10',
          starting_after: undefined,
          ending_before: '507f1f77bcf86cd799439012',
          status: undefined,
          pageId: undefined,
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings with search parameter', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'searched@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: 'page_123',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        search: 'searched@example.com',
        limit: 10,
      });

      expect(result).toEqual(mockBookingList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'searched@example.com',
          limit: '10',
          starting_after: undefined,
          ending_before: undefined,
          status: undefined,
          pageId: undefined,
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings filtered by status', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: 'page_123',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        total: 50,
        has_more: true,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        status: 'paid',
        limit: 1,
      });

      expect(result.data[0].status).toBe('paid');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: '1',
          starting_after: undefined,
          ending_before: undefined,
          status: 'paid',
          pageId: undefined,
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings filtered by pageId', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: '67fcbdac6a91c25ef2d3534a',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        total: 20,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        pageId: '67fcbdac6a91c25ef2d3534a',
      });

      expect(result.data[0].pageId).toBe('67fcbdac6a91c25ef2d3534a');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
          status: undefined,
          pageId: '67fcbdac6a91c25ef2d3534a',
        },
        path: '/v1/bookings/',
      });
    });

    it('should fetch bookings with multiple filters combined', async () => {
      const mockBookingList: BookingList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            orderId: 'order_123',
            customerEmail: 'customer@example.com',
            customerId: 'cust_123',
            sellerId: 'seller_123',
            pageId: '67fcbdac6a91c25ef2d3534a',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            taxBreakdown: [],
          },
        ],
        total: 5,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({
        status: 'paid',
        pageId: '67fcbdac6a91c25ef2d3534a',
        search: 'customer@example.com',
        limit: 20,
      });

      expect(result).toEqual(mockBookingList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'customer@example.com',
          limit: '20',
          starting_after: undefined,
          ending_before: undefined,
          status: 'paid',
          pageId: '67fcbdac6a91c25ef2d3534a',
        },
        path: '/v1/bookings/',
      });
    });

    it('should return empty list when no bookings exist', async () => {
      const mockBookingList: BookingList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockBookingList);

      const result = await bookingResource.list({});

      expect(result).toEqual(mockBookingList);
      expect(result.data).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });
  });
});
