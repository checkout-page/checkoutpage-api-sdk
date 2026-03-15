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
