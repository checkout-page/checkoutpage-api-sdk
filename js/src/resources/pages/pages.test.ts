import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageResource } from './pages';
import { CheckoutPageApiClient } from '../../client';
import type { Page, PageList, CreatePageParams, UpdatePageParams } from '../../types';

describe('PageResource', () => {
  let client: CheckoutPageApiClient;
  let pageResource: PageResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    pageResource = new PageResource(client);
  });

  describe('list', () => {
    it('should fetch a list of pages with default parameters', async () => {
      const mockPageList: PageList = {
        data: [
          {
            id: 'page_123',
            name: 'Test Page',
            type: 'checkout',
            status: 'published',
            sellerId: 'seller_123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPageList);

      const result = await pageResource.list({});

      expect(result).toEqual(mockPageList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          status: undefined,
          type: undefined,
          limit: undefined,
        },
        path: '/v1/pages/',
      });
    });

    it('should fetch pages with query parameters', async () => {
      const mockPageList: PageList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPageList);

      await pageResource.list({
        status: 'published',
        type: 'checkout',
        limit: 10,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          status: 'published',
          type: 'checkout',
          limit: '10',
        },
        path: '/v1/pages/',
      });
    });
  });

  describe('create', () => {
    it('should create a page with required fields', async () => {
      const params: CreatePageParams = {
        name: 'Test Page',
        type: 'checkout',
        status: 'published',
        savePaymentMethod: true,
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Test Page',
          type: 'checkout',
          status: 'published',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          savePaymentMethod: true,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/',
        body: {
          name: 'Test Page',
          type: 'checkout',
          status: 'published',
          savePaymentMethod: true,
        },
      });
    });

    it('should create a page with optional fields', async () => {
      const params: CreatePageParams = {
        name: 'Test Page',
        type: 'checkout',
        title: 'Buy Now',
        description: 'A test checkout page',
        slug: 'test-page',
        status: 'published',
        savePaymentMethod: true,
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Test Page',
          type: 'checkout',
          status: 'published',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          savePaymentMethod: true,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await pageResource.create(params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/',
        body: {
          name: 'Test Page',
          type: 'checkout',
          title: 'Buy Now',
          description: 'A test checkout page',
          slug: 'test-page',
          status: 'published',
          savePaymentMethod: true,
        },
      });
    });
  });

  describe('get', () => {
    it('should fetch a page by id', async () => {
      const mockPage: Page = {
        data: {
          id: 'page_123',
          name: 'Test Page',
          type: 'checkout',
          status: 'published',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockPage);

      const result = await pageResource.get('page_123');

      expect(result).toEqual(mockPage);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/pages/page_123',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageResource.get('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('should update a page', async () => {
      const params: UpdatePageParams = {
        name: 'Updated Page',
        title: 'Buy Now Updated',
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Updated Page',
          type: 'checkout',
          status: 'draft',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageResource.update('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/pages/page_123',
        body: {
          name: 'Updated Page',
          title: 'Buy Now Updated',
        },
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageResource.update('', {})).rejects.toThrow('Page ID is required');
    });
  });

  describe('delete', () => {
    it('should delete a page', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(undefined);

      await pageResource.delete('page_123');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/pages/page_123',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageResource.delete('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('publish', () => {
    it('should publish a page', async () => {
      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Test Page',
          type: 'checkout',
          status: 'published',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageResource.publish('page_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/publish',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageResource.publish('')).rejects.toThrow('Page ID is required');
    });
  });
});
