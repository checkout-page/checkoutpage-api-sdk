import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductResource } from './products';
import { CheckoutPageApiClient } from '../../client';
import type {
  CreateProductParams,
  CreateProductResponse,
  DeleteProductResponse,
  Product,
  UpdateProductParams,
} from '../../types';

const bumpProduct = {
  id: 'bump_123',
  title: 'Gift wrapping',
  type: 'charge',
  role: 'orderbump',
  price: { amount: 500, currency: 'usd' },
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
} as CreateProductResponse['data'];

describe('ProductResource order bump products', () => {
  let client: CheckoutPageApiClient;
  let productResource: ProductResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    productResource = new ProductResource(client);
  });

  describe('create', () => {
    it('posts the order bump product as given', async () => {
      const params: CreateProductParams = {
        role: 'orderbump',
        title: 'Gift wrapping',
        price: { amount: 500, currency: 'usd', setupFee: 100 },
        callToActionText: 'Yes! Add gift wrapping',
        features: [{ text: 'Recycled paper', icon: 'check' }],
      };
      const mockResponse: CreateProductResponse = { data: bumpProduct };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await productResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/products/',
        body: params,
      });
    });
  });

  describe('delete', () => {
    const mockResponse: DeleteProductResponse = {
      data: { success: true, message: 'Product deleted successfully' },
    };

    it('deletes a product without fromAllPages by default', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await productResource.delete('bump_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/products/bump_123',
        query: { fromAllPages: undefined },
      });
    });

    it.each([true, false])('sends fromAllPages=%s as a query string', async (fromAllPages) => {
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await productResource.delete('bump_123', { fromAllPages });

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/products/bump_123',
        query: { fromAllPages: String(fromAllPages) },
      });
    });

    it('requires a product id', async () => {
      const request = vi.spyOn(client, 'request');

      await expect(productResource.delete('')).rejects.toThrow('Product ID is required');
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('forwards the role filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], has_more: false, total: 0 });

      await productResource.list({ role: 'orderbump' });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/v1/products/',
          query: expect.objectContaining({ role: 'orderbump' }),
        })
      );
    });
  });

  describe('update', () => {
    it('sends the order bump card fields, including nulls that clear them', async () => {
      const params: UpdateProductParams = {
        shortDescription: 'Wrapped in recycled paper.',
        callToActionText: 'Yes! Add gift wrapping',
        headingText: null,
        features: [{ text: 'Handwritten note', icon: 'none' }],
        calloutText: null,
        calloutIcon: 'gift',
      };
      vi.spyOn(client, 'request').mockResolvedValue({ data: bumpProduct } as Product);

      await productResource.update('bump_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/bump_123',
        body: params,
      });
    });
  });
});
