import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionPaymentResource } from './subscription-payments';
import { CheckoutPageApiClient } from '../../client';
import type { SubscriptionPaymentList } from '../../types';

describe('SubscriptionPaymentResource', () => {
  let client: CheckoutPageApiClient;
  let subscriptionPaymentResource: SubscriptionPaymentResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    subscriptionPaymentResource = new SubscriptionPaymentResource(client);
  });

  describe('list', () => {
    it('should fetch a list of subscription payments with default parameters', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '6812fe6e9f39b6760576f01d',
            amount: 19999,
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        total: 2,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list();

      expect(result).toEqual(mockList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
          subscriptionId: undefined,
          customerId: undefined,
          pageId: undefined,
          paymentStatus: undefined,
          paid: undefined,
          refunded: undefined,
          billingReason: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
        },
        path: '/v1/subscription-payments/',
      });
    });

    it('should convert numeric limit to string', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await subscriptionPaymentResource.list({ limit: 5 });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ limit: '5' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by subscriptionId', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            subscriptionId: '6812fe6e9f39b6760576a001',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        subscriptionId: '6812fe6e9f39b6760576a001',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ subscriptionId: '6812fe6e9f39b6760576a001' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by customerId', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            customerId: '6812fe6e9f39b6760576b001',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        customerId: '6812fe6e9f39b6760576b001',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ customerId: '6812fe6e9f39b6760576b001' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by pageId', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            pageId: '67fcbdac6a91c25ef2d3534a',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        pageId: '67fcbdac6a91c25ef2d3534a',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ pageId: '67fcbdac6a91c25ef2d3534a' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by paymentStatus', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            paymentStatus: 'succeeded',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        paymentStatus: 'succeeded',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ paymentStatus: 'succeeded' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by paid', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            paid: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        paid: 'true',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ paid: 'true' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by refunded', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            refunded: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        refunded: 'true',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ refunded: 'true' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by billingReason', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            billingReason: 'subscription_create',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        billingReason: 'subscription_create',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ billingReason: 'subscription_create' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by createdAfter', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-06-01T00:00:00.000Z',
            updatedAt: '2024-06-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        createdAfter: '2024-05-01T00:00:00.000Z',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ createdAfter: '2024-05-01T00:00:00.000Z' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should filter by createdBefore', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        createdBefore: '2024-03-01T00:00:00.000Z',
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: expect.objectContaining({ createdBefore: '2024-03-01T00:00:00.000Z' }),
        path: '/v1/subscription-payments/',
      });
    });

    it('should combine multiple filters', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            paymentStatus: 'succeeded',
            paid: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        paymentStatus: 'succeeded',
        paid: 'true',
        limit: 10,
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          limit: '10',
          starting_after: undefined,
          ending_before: undefined,
          subscriptionId: undefined,
          customerId: undefined,
          pageId: undefined,
          paymentStatus: 'succeeded',
          paid: 'true',
          refunded: undefined,
          billingReason: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
        },
        path: '/v1/subscription-payments/',
      });
    });

    it('should support cursor pagination with starting_after', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 100,
        has_more: true,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        limit: 10,
        starting_after: '507f1f77bcf86cd799439011',
      });

      expect(result).toEqual(mockList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          limit: '10',
          starting_after: '507f1f77bcf86cd799439011',
          ending_before: undefined,
          subscriptionId: undefined,
          customerId: undefined,
          pageId: undefined,
          paymentStatus: undefined,
          paid: undefined,
          refunded: undefined,
          billingReason: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
        },
        path: '/v1/subscription-payments/',
      });
    });

    it('should support cursor pagination with ending_before', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 100,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list({
        limit: 10,
        ending_before: '507f1f77bcf86cd799439012',
      });

      expect(result).toEqual(mockList);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          limit: '10',
          starting_after: undefined,
          ending_before: '507f1f77bcf86cd799439012',
          subscriptionId: undefined,
          customerId: undefined,
          pageId: undefined,
          paymentStatus: undefined,
          paid: undefined,
          refunded: undefined,
          billingReason: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
        },
        path: '/v1/subscription-payments/',
      });
    });

    it('should return the response shape unchanged', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            subscriptionId: '6812fe6e9f39b6760576a001',
            customerId: '6812fe6e9f39b6760576b001',
            pageId: '67fcbdac6a91c25ef2d3534a',
            paymentStatus: 'succeeded',
            paid: true,
            refunded: false,
            billingReason: 'subscription_cycle',
            customerEmail: 'buyer@example.com',
            customerName: 'Test Buyer',
            currency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list();

      expect(result).toEqual(mockList);
      expect(result.data[0].id).toBe('6812fe6e9f39b6760576f01c');
      expect(result.data[0].amount).toBe(9999);
      expect(result.data[0].paymentStatus).toBe('succeeded');
      expect(result.data[0].paid).toBe(true);
      expect(result.data[0].billingReason).toBe('subscription_cycle');
    });

    it('should return empty list when no subscription payments exist', async () => {
      const mockList: SubscriptionPaymentList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await subscriptionPaymentResource.list();

      expect(result).toEqual(mockList);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const stub = (id: string) => ({ id, amount: 1000, createdAt: '', updatedAt: '' });
      const PAGE_1: SubscriptionPaymentList = { data: [stub('p5'), stub('p4')], has_more: true, total: 5 };
      const PAGE_2: SubscriptionPaymentList = { data: [stub('p3'), stub('p2')], has_more: true, total: 5 };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1)
        .mockResolvedValueOnce(PAGE_2)
        .mockResolvedValueOnce({ ...PAGE_1, has_more: false });

      await subscriptionPaymentResource.list({ limit: 2 });
      await subscriptionPaymentResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await subscriptionPaymentResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 'p4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 'p3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });
  });
});
