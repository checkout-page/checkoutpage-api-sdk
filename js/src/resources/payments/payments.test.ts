import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentResource } from './payments';
import { CheckoutPageClient } from '../../client';
import type { PaymentList } from '../../types';

describe('PaymentResource', () => {
  let client: CheckoutPageClient;
  let paymentResource: PaymentResource;

  beforeEach(() => {
    client = new CheckoutPageClient({ apiKey: 'test_api_key' });
    paymentResource = new PaymentResource(client);
  });

  describe('list', () => {
    it('should fetch a list of payments with default parameters', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '6812fe6e9f39b6760576f01d',
            amount: 25000,
            status: 'pending',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        total: 2,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list();

      expect(result).toEqual(mockPaymentList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          status: undefined,
          pageId: undefined,
          limit: undefined,
          skip: undefined,
        },
        path: '/v1/payments/',
      });
    });

    it('should fetch payments with pagination parameters', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 100,
        has_more: true,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list({
        limit: 10,
        skip: 5,
      });

      expect(result).toEqual(mockPaymentList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          status: undefined,
          pageId: undefined,
          limit: '10',
          skip: '5',
        },
        path: '/v1/payments/',
      });
    });

    it('should fetch payments with status filter', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '6812fe6e9f39b6760576f01e',
            amount: 15000,
            status: 'paid',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-03T00:00:00.000Z',
            updatedAt: '2024-01-03T00:00:00.000Z',
          },
        ],
        total: 2,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list({
        status: 'paid',
      });

      expect(result).toEqual(mockPaymentList);
      expect(result.data.every((payment) => payment.status === 'paid')).toBe(true);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          status: 'paid',
          pageId: undefined,
          limit: undefined,
          skip: undefined,
        },
        path: '/v1/payments/',
      });
    });

    it('should fetch payments with search parameter', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            currency: 'usd',
            customerEmail: 'test@example.com',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list({
        search: 'test@example.com',
      });

      expect(result).toEqual(mockPaymentList);
      expect(result.data[0].customerEmail).toBe('test@example.com');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          status: undefined,
          pageId: undefined,
          limit: undefined,
          skip: undefined,
        },
        path: '/v1/payments/',
      });
    });

    it('should fetch payments with pageId filter', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            pageId: '67fcbdac6a91c25ef2d3534a',
            currency: 'usd',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list({
        pageId: '67fcbdac6a91c25ef2d3534a',
      });

      expect(result).toEqual(mockPaymentList);
      expect(result.data[0].pageId).toBe('67fcbdac6a91c25ef2d3534a');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          status: undefined,
          pageId: '67fcbdac6a91c25ef2d3534a',
          limit: undefined,
          skip: undefined,
        },
        path: '/v1/payments/',
      });
    });

    it('should fetch payments with multiple filters', async () => {
      const mockPaymentList: PaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 10000,
            status: 'paid',
            pageId: '67fcbdac6a91c25ef2d3534a',
            currency: 'usd',
            customerEmail: 'test@example.com',
            taxBreakdown: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list({
        status: 'paid',
        pageId: '67fcbdac6a91c25ef2d3534a',
        search: 'test@example.com',
        limit: 20,
        skip: 0,
      });

      expect(result).toEqual(mockPaymentList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          status: 'paid',
          pageId: '67fcbdac6a91c25ef2d3534a',
          limit: '20',
          skip: '0',
        },
        path: '/v1/payments/',
      });
    });

    it('should return empty list when no payments exist', async () => {
      const mockPaymentList: PaymentList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list();

      expect(result).toEqual(mockPaymentList);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });
});
