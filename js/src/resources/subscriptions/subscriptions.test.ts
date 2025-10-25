import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionResource } from './subscriptions';
import { CheckoutPageApiClient } from '../../client';
import type { SubscriptionList } from '../../types';

describe('SubscriptionResource', () => {
  let client: CheckoutPageApiClient;
  let subscriptionResource: SubscriptionResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    subscriptionResource = new SubscriptionResource(client);
  });

  describe('list', () => {
    it('should fetch a list of subscriptions with default parameters', async () => {
      const mockSubscriptionList: SubscriptionList = {
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

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list();

      expect(result).toEqual(mockSubscriptionList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          pageId: undefined,
          status: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with cursor-based pagination using starting_after', async () => {
      const mockSubscriptionList: SubscriptionList = {
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

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        limit: 10,
        starting_after: '507f1f77bcf86cd799439011',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          pageId: undefined,
          status: undefined,
          limit: '10',
          starting_after: '507f1f77bcf86cd799439011',
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with status filter', async () => {
      const mockSubscriptionList: SubscriptionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '6812fe6e9f39b6760576f01e',
            amount: 14999,
            status: 'active',
            createdAt: '2024-01-03T00:00:00.000Z',
            updatedAt: '2024-01-03T00:00:00.000Z',
          },
        ],
        total: 2,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        status: 'active',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(result.data.every((subscription) => subscription.status === 'active')).toBe(true);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          pageId: undefined,
          status: 'active',
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with cursor-based pagination using ending_before', async () => {
      const mockSubscriptionList: SubscriptionList = {
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

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        limit: 10,
        ending_before: '507f1f77bcf86cd799439012',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          pageId: undefined,
          status: undefined,
          limit: '10',
          starting_after: undefined,
          ending_before: '507f1f77bcf86cd799439012',
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with search parameter', async () => {
      const mockSubscriptionList: SubscriptionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            customerEmail: 'test@example.com',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        search: 'test@example.com',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(result.data[0].customerEmail).toBe('test@example.com');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          pageId: undefined,
          status: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with pageId filter', async () => {
      const mockSubscriptionList: SubscriptionList = {
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

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        pageId: '67fcbdac6a91c25ef2d3534a',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(result.data[0].pageId).toBe('67fcbdac6a91c25ef2d3534a');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          pageId: '67fcbdac6a91c25ef2d3534a',
          status: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should fetch subscriptions with multiple filters', async () => {
      const mockSubscriptionList: SubscriptionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            status: 'active',
            pageId: '67fcbdac6a91c25ef2d3534a',
            customerEmail: 'test@example.com',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list({
        status: 'active',
        pageId: '67fcbdac6a91c25ef2d3534a',
        search: 'test@example.com',
        limit: 20,
        starting_after: '507f1f77bcf86cd799439011',
      });

      expect(result).toEqual(mockSubscriptionList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          pageId: '67fcbdac6a91c25ef2d3534a',
          status: 'active',
          limit: '20',
          starting_after: '507f1f77bcf86cd799439011',
          ending_before: undefined,
        },
        path: '/v1/subscriptions/',
      });
    });

    it('should return empty list when no subscriptions exist', async () => {
      const mockSubscriptionList: SubscriptionList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list();

      expect(result).toEqual(mockSubscriptionList);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });
});
