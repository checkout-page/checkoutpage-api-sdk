import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionResource } from './subscriptions';
import { CheckoutPageApiClient } from '../../client';
import type { SubscriptionCancelResponse, SubscriptionList } from '../../types';

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

    // priceId field

    it('Subscription.priceId is typed as string | null | undefined and accessible without a cast', () => {
      const subscription: SubscriptionList['data'][number] = {
        id: '6812fe6e9f39b6760576f01c',
        amount: 9999,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        priceId: 'price_abc123',
      };
      // TypeScript would error here if priceId were not on the type.
      const priceId: string | null | undefined = subscription.priceId;
      expect(priceId).toBe('price_abc123');
    });

    it('Subscription.priceId accepts null without a cast', () => {
      const subscription: SubscriptionList['data'][number] = {
        id: '6812fe6e9f39b6760576f01c',
        amount: 9999,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        priceId: null,
      };
      const priceId: string | null | undefined = subscription.priceId;
      expect(priceId).toBeNull();
    });

    it('Subscription.priceId is undefined when absent', () => {
      const subscription: SubscriptionList['data'][number] = {
        id: '6812fe6e9f39b6760576f01c',
        amount: 9999,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const priceId: string | null | undefined = subscription.priceId;
      expect(priceId).toBeUndefined();
    });

    it('should return subscription with priceId from the client', async () => {
      const PRICE_ID = 'price_def456';
      const mockSubscriptionList: SubscriptionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            priceId: PRICE_ID,
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list();

      expect(result.data[0].priceId).toBe(PRICE_ID);
    });

    it('should return the priceSnapshot from the client', async () => {
      const priceSnapshot = {
        priceId: 'price_def456',
        reference: 'pro-monthly',
        label: 'Pro',
        billingType: 'recurring',
        amount: 9999,
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
      };
      const mockSubscriptionList: SubscriptionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            amount: 9999,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            priceSnapshot,
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubscriptionList);

      const result = await subscriptionResource.list();

      expect(result.data[0].priceSnapshot).toEqual(priceSnapshot);
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`, with the server responsible for returning the page
     * immediately newer than the cursor in newest-first order.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const PAGE_1: SubscriptionList = {
        data: [
          { id: 's5', amount: 100, createdAt: '', updatedAt: '' },
          { id: 's4', amount: 100, createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const PAGE_2: SubscriptionList = {
        data: [
          { id: 's3', amount: 100, createdAt: '', updatedAt: '' },
          { id: 's2', amount: 100, createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const BACK_TO_PAGE_1: SubscriptionList = { ...PAGE_1, has_more: false };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1)
        .mockResolvedValueOnce(PAGE_2)
        .mockResolvedValueOnce(BACK_TO_PAGE_1);

      await subscriptionResource.list({ limit: 2 });
      await subscriptionResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await subscriptionResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query).toMatchObject({
        limit: '2',
        starting_after: undefined,
        ending_before: undefined,
      });
      expect(spy.mock.calls[1][0].query).toMatchObject({
        limit: '2',
        starting_after: 's4',
        ending_before: undefined,
      });
      expect(spy.mock.calls[2][0].query).toMatchObject({
        limit: '2',
        starting_after: undefined,
        ending_before: 's3',
      });
    });
  });

  describe('cancel', () => {
    const mockResponse: SubscriptionCancelResponse = { data: { success: true } };

    it('forwards cancelImmediately + reason in the body', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await subscriptionResource.cancel('6812fe6e9f39b6760576f01c', {
        cancelImmediately: true,
        reason: 'Customer requested',
      });

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/subscriptions/6812fe6e9f39b6760576f01c/cancel',
        body: { cancelImmediately: true, reason: 'Customer requested' },
      });
    });

    it('forwards cancelAtPeriodEnd + sendCancellationEmail', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await subscriptionResource.cancel('6812fe6e9f39b6760576f01d', {
        cancelAtPeriodEnd: true,
        sendCancellationEmail: true,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/subscriptions/6812fe6e9f39b6760576f01d/cancel',
        body: {
          cancelAtPeriodEnd: true,
          sendCancellationEmail: true,
        },
      });
    });

    it('forwards a scheduled cancelAt ISO timestamp', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await subscriptionResource.cancel('6812fe6e9f39b6760576f01e', {
        cancelAt: '2026-12-31T23:59:59.000Z',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/subscriptions/6812fe6e9f39b6760576f01e/cancel',
        body: {
          cancelAt: '2026-12-31T23:59:59.000Z',
        },
      });
    });

    /**
     * The SDK's discriminated-union type prevents passing zero or multiple
     * timing fields at compile time. The test below uses `as never` to
     * defeat the type and verify that the SDK still forwards the body
     * verbatim — the server's zod XOR enforces the rule at the wire level,
     * so this lock-in catches refactors that might accidentally start
     * dropping fields if a misbehaving consumer manages to construct an
     * invalid body (e.g. via type-defeating dynamic input).
     */
    it('forwards multiple timing fields verbatim when the type is defeated', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await subscriptionResource.cancel('6812fe6e9f39b6760576f01c', {
        cancelImmediately: true,
        cancelAtPeriodEnd: true,
      } as never);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/subscriptions/6812fe6e9f39b6760576f01c/cancel',
        body: {
          cancelImmediately: true,
          cancelAtPeriodEnd: true,
        },
      });
    });
  });
});
