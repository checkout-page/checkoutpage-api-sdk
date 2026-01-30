import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductResource } from './products';
import { CheckoutPageApiClient } from '../../client';
import type { Product, UpdateProductParams } from '../../types';

describe('ProductResource', () => {
  let client: CheckoutPageApiClient;
  let productResource: ProductResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    productResource = new ProductResource(client);
  });

  describe('get', () => {
    it('should fetch a product by id', async () => {
      const mockProduct: Product = {
        data: {
          id: 'product_123',
          title: 'Test Product',
          price: 4900,
          currency: 'usd',
          type: 'charge',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockProduct);

      const result = await productResource.get('product_123');

      expect(result).toEqual(mockProduct);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/products/product_123',
      });
    });

    it('should throw error for missing product id', async () => {
      await expect(productResource.get('')).rejects.toThrow('Product ID is required');
    });
  });

  describe('update', () => {
    it('should update a product with required fields', async () => {
      const params: UpdateProductParams = {
        title: 'Updated Product',
        price: 5900,
      };

      const mockResponse: Product = {
        data: {
          id: 'product_123',
          title: 'Updated Product',
          price: 5900,
          currency: 'usd',
          type: 'charge',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await productResource.update('product_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          title: 'Updated Product',
          price: 5900,
        },
      });
    });

    it('should update product with optional fields', async () => {
      const params: UpdateProductParams = {
        title: 'Updated Product',
        price: 5900,
        description: 'Updated description',
        stock: 100,
        hasUnlimitedStock: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          title: 'Updated Product',
          price: 5900,
          description: 'Updated description',
          stock: 100,
          hasUnlimitedStock: false,
        },
      });
    });

    it('should throw error for missing product id', async () => {
      await expect(productResource.update('', {})).rejects.toThrow('Product ID is required');
    });
  });
});
