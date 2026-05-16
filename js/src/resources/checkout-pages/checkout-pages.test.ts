import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { CheckoutPagesResource } from './checkout-pages';
import type { CreateCheckoutPageParams, UpdateCheckoutPageParams } from '../../types';

describe('CheckoutPagesResource', () => {
  let client: CheckoutPageApiClient;
  let checkoutPagesResource: CheckoutPagesResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    checkoutPagesResource = new CheckoutPagesResource(client);
  });

  describe('list', () => {
    it('lists checkout pages and stringifies limit', async () => {
      const mockResponse: any = {
        data: [
          {
            id: 'page_123',
            name: 'Primary checkout',
            type: 'checkout',
            status: 'published',
            slug: '/primary-checkout',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
        total: 1,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await checkoutPagesResource.list({
        limit: 10,
        status: 'draft',
        search: 'primary',
        starting_after: 'page_120',
        ending_before: 'page_140',
      });

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/checkout-pages/',
        query: {
          limit: '10',
          starting_after: 'page_120',
          ending_before: 'page_140',
          status: 'draft',
          search: 'primary',
        },
      });
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const PAGE_1 = {
        data: [
          { id: 'p5', name: 'p5', type: 'checkout', status: 'published', slug: '/p5', createdAt: '', updatedAt: '' },
          { id: 'p4', name: 'p4', type: 'checkout', status: 'published', slug: '/p4', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const PAGE_2 = {
        data: [
          { id: 'p3', name: 'p3', type: 'checkout', status: 'published', slug: '/p3', createdAt: '', updatedAt: '' },
          { id: 'p2', name: 'p2', type: 'checkout', status: 'published', slug: '/p2', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const BACK_TO_PAGE_1 = { ...PAGE_1, has_more: false };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1 as any)
        .mockResolvedValueOnce(PAGE_2 as any)
        .mockResolvedValueOnce(BACK_TO_PAGE_1 as any);

      await checkoutPagesResource.list({ limit: 2 });
      await checkoutPagesResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await checkoutPagesResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query).toMatchObject({ limit: '2' });
      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();

      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 'p4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();

      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 'p3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates a checkout page', async () => {
      const params: CreateCheckoutPageParams = {
        name: 'Created checkout',
        productData: {
          title: 'Created product',
          price: {
            amount: 4900,
            currency: 'usd',
          },
        },
      };

      const mockResponse: any = {
        data: {
          id: 'page_123',
          name: 'Created checkout',
          type: 'checkout',
          status: 'published',
          slug: '/created-checkout',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await checkoutPagesResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/checkout-pages/',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when creating a checkout page', async () => {
      const params: CreateCheckoutPageParams = {
        name: 'Created checkout',
        slug: '/created-checkout',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'checkout',
            order: 0,
            enabled: true,
            config: {
              pageId: '507f1f77bcf86cd799439012',
            },
          },
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439013',
            },
          },
        ],
        productData: {
          title: 'Created product',
          price: {
            amount: 4900,
            currency: 'usd',
          },
        },
      };

      const mockResponse: any = { data: { id: 'page_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await checkoutPagesResource.create(params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/checkout-pages/',
        body: params,
      });
    });
  });

  describe('get', () => {
    it('gets a checkout page by id', async () => {
      const mockResponse: any = {
        data: {
          id: 'page_123',
          name: 'Existing checkout',
          type: 'checkout',
          status: 'published',
          slug: '/existing-checkout',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await checkoutPagesResource.get('page_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/checkout-pages/page_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(checkoutPagesResource.get('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('updates a checkout page and preserves null payloads', async () => {
      const params: UpdateCheckoutPageParams = {
        status: 'draft',
        redirectUrl: null,
        redirectPageId: null,
        notifyEmail: 'owner@example.com',
      };

      const mockResponse: any = {
        data: {
          id: 'page_123',
          name: 'Updated checkout',
          type: 'checkout',
          status: 'draft',
          slug: '/updated-checkout',
          notifyEmail: 'owner@example.com',
          redirectUrl: null,
          redirectPageId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await checkoutPagesResource.update('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/checkout-pages/page_123',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when updating a checkout page', async () => {
      const params: UpdateCheckoutPageParams = {
        slug: '/updated-checkout',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'confirmation',
            order: 2,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439012',
            },
          },
        ],
      };

      const mockResponse: any = { data: { id: 'page_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await checkoutPagesResource.update('page_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/checkout-pages/page_123',
        body: params,
      });
    });

    it('throws for missing page id', async () => {
      await expect(checkoutPagesResource.update('', {})).rejects.toThrow('Page ID is required');
    });
  });

  describe('delete', () => {
    it('archives a checkout page', async () => {
      const mockResponse: any = {
        data: {
          id: 'page_123',
          name: 'Archived checkout',
          type: 'checkout',
          status: 'archived',
          slug: '/archived-checkout',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await checkoutPagesResource.delete('page_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/checkout-pages/page_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(checkoutPagesResource.delete('')).rejects.toThrow('Page ID is required');
    });
  });
});
