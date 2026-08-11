import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductResource } from './products';
import { CheckoutPageApiClient } from '../../client';
import type { Product, ProductData, Price, ProductVariant, UpdateProductParams } from '../../types';

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
          type: 'charge',
          price: {
            amount: 4900,
            currency: 'usd',
          },
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

    it('response carries the product-level subscription and file-access settings', async () => {
      const mockResponse: Product = {
        data: {
          id: 'product_123',
          title: 'Membership',
          type: 'subscription',
          enableFileAccessForInactiveSubscriptions: true,
          limitSubscriptions: {
            enabled: true,
            limitSubscriptionsStripe: { enabled: false },
          },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await productResource.get('product_123');

      expect(result.data.enableFileAccessForInactiveSubscriptions).toBe(true);
      expect(result.data.limitSubscriptions).toEqual({
        enabled: true,
        limitSubscriptionsStripe: { enabled: false },
      });
    });

    it('should include prices[] and defaultPriceId in the response', async () => {
      const monthlyPrice: Price = {
        id: 'price_monthly',
        label: 'Monthly',
        order: 0,
        enabled: true,
        isDefault: true,
        billingType: 'recurring',
        amount: 2900,
        currency: 'usd',
        recurring: {
          interval: 'month',
          intervalCount: 1,
          trialPeriodDays: null,
          planIterations: null,
          billingCycleAnchorConfig: null,
          startDate: null,
        },
      };

      const annualPrice: Price = {
        id: 'price_annual',
        label: 'Annual',
        order: 1,
        enabled: true,
        isDefault: false,
        billingType: 'recurring',
        amount: 29000,
        currency: 'usd',
        recurring: {
          interval: 'year',
          intervalCount: 1,
          trialPeriodDays: null,
          planIterations: null,
          billingCycleAnchorConfig: null,
          startDate: null,
        },
      };

      const mockProduct: Product = {
        data: {
          id: 'product_multi',
          title: 'Multi-Price Product',
          type: 'subscription',
          price: {
            amount: 2900,
            currency: 'usd',
          },
          prices: [monthlyPrice, annualPrice],
          defaultPriceId: 'price_monthly',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockProduct);

      const result = await productResource.get('product_multi');

      expect(result).toEqual(mockProduct);

      // Type-level assertions: these must compile (no cast needed)
      const product: ProductData = result.data;
      const prices: Price[] | null | undefined = product?.prices;
      const defaultPriceId: string | null | undefined = product?.defaultPriceId;

      expect(prices).toHaveLength(2);
      expect(defaultPriceId).toBe('price_monthly');

      const first = prices![0];
      // billingType is the key distinguishing field on Price
      expect(first.billingType).toBe('recurring');
      expect(first.amount).toBe(2900);
      expect(first.currency).toBe('usd');
      expect(first.recurring?.interval).toBe('month');
    });

    it('should include variant priceIds in the response', async () => {
      const mockVariant: ProductVariant = {
        id: 'variant_plan',
        name: 'Plan',
        priceIds: ['price_monthly', 'price_annual'],
      };

      const mockProduct: Product = {
        data: {
          id: 'product_variants',
          title: 'Product with Variant Price Scoping',
          type: 'subscription',
          price: {
            amount: 2900,
            currency: 'usd',
          },
          prices: [],
          defaultPriceId: null,
          variants: [mockVariant],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockProduct);

      const result = await productResource.get('product_variants');

      const variant: ProductVariant = result.data!.variants![0];
      const priceIds: string[] | null | undefined = variant.priceIds;

      expect(priceIds).toEqual(['price_monthly', 'price_annual']);
    });
  });

  describe('update', () => {
    it('should update a product title and price', async () => {
      const params: UpdateProductParams = {
        title: 'Updated Product',
        price: { amount: 5900 },
      };

      const mockResponse: Product = {
        data: {
          id: 'product_123',
          title: 'Updated Product',
          type: 'charge',
          price: {
            amount: 5900,
            currency: 'usd',
          },
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
          price: { amount: 5900 },
        },
      });
    });

    it('should update product with stock fields', async () => {
      const params: UpdateProductParams = {
        price: { amount: 5900 },
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
          price: { amount: 5900 },
          description: 'Updated description',
          stock: 100,
          hasUnlimitedStock: false,
        },
      });
    });

    it('should update product with a recurring price', async () => {
      const params: UpdateProductParams = {
        price: {
          amount: 2900,
          currency: 'usd',
          recurring: {
            interval: 'month',
            intervalCount: 1,
            trialPeriodDays: 14,
          },
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          price: {
            amount: 2900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
              trialPeriodDays: 14,
            },
          },
        },
      });
    });

    it('should update product with a payment plan price', async () => {
      const params: UpdateProductParams = {
        price: {
          amount: 12000,
          currency: 'usd',
          paymentPlan: {
            interval: 'month',
            intervalCount: 1,
            planIterations: 3,
          },
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          price: {
            amount: 12000,
            currency: 'usd',
            paymentPlan: {
              interval: 'month',
              intervalCount: 1,
              planIterations: 3,
            },
          },
        },
      });
    });

    it('should only include defined fields in the request body', async () => {
      const params: UpdateProductParams = {
        title: 'Only Title',
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: { title: 'Only Title' },
      });
    });

    it('should throw error for missing product id', async () => {
      await expect(productResource.update('', {})).rejects.toThrow('Product ID is required');
    });

    it('forwards enableFileAccessForInactiveSubscriptions', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', {
        enableFileAccessForInactiveSubscriptions: true,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: { enableFileAccessForInactiveSubscriptions: true },
      });
    });

    it('forwards enableFileAccessForInactiveSubscriptions when disabling it', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', {
        enableFileAccessForInactiveSubscriptions: false,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: { enableFileAccessForInactiveSubscriptions: false },
      });
    });

    it('forwards the nested limitSubscriptions shape intact', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', {
        limitSubscriptions: {
          enabled: true,
          limitSubscriptionsStripe: { enabled: true },
        },
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          limitSubscriptions: {
            enabled: true,
            limitSubscriptionsStripe: { enabled: true },
          },
        },
      });
    });

    it('omits the product-behaviour fields when they are undefined', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', { title: 'Only Title' });

      const body = vi.mocked(client.request).mock.calls[0][0].body as Record<string, unknown>;
      expect(body).not.toHaveProperty('enableFileAccessForInactiveSubscriptions');
      expect(body).not.toHaveProperty('limitSubscriptions');
    });

    it('creates a request body with prices[] — one-time + monthly + yearly', async () => {
      const params: UpdateProductParams = {
        prices: [
          {
            billingType: 'one_time',
            amount: 4900,
            currency: 'usd',
          },
          {
            billingType: 'recurring',
            amount: 1000,
            currency: 'usd',
            recurring: { interval: 'month', intervalCount: 1 },
          },
          {
            billingType: 'recurring',
            amount: 9900,
            currency: 'usd',
            recurring: { interval: 'year', intervalCount: 1 },
          },
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/products/product_123',
        body: {
          prices: [
            { billingType: 'one_time', amount: 4900, currency: 'usd' },
            {
              billingType: 'recurring',
              amount: 1000,
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
            },
            {
              billingType: 'recurring',
              amount: 9900,
              currency: 'usd',
              recurring: { interval: 'year', intervalCount: 1 },
            },
          ],
        },
      });
    });

    it('update path — amends an existing price amount', async () => {
      const params: UpdateProductParams = {
        prices: [
          {
            id: 'price_existing_001',
            billingType: 'recurring',
            amount: 1500,
            currency: 'usd',
            recurring: { interval: 'month', intervalCount: 1 },
          },
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      const call = (client.request as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
      expect(call.body).toMatchObject({
        prices: [expect.objectContaining({ id: 'price_existing_001', amount: 1500 })],
      });
    });

    it('variant scope — create with variant priceIds referencing two recurring prices', async () => {
      const params: UpdateProductParams = {
        prices: [
          {
            id: 'price_monthly',
            billingType: 'recurring',
            amount: 1000,
            currency: 'usd',
            recurring: { interval: 'month', intervalCount: 1 },
          },
          {
            id: 'price_annual',
            billingType: 'recurring',
            amount: 9900,
            currency: 'usd',
            recurring: { interval: 'year', intervalCount: 1 },
          },
        ],
        variants: [
          {
            name: 'Support tier',
            options: [{ name: 'Standard', additionalChargeAmount: 0 }],
            priceIds: ['price_monthly', 'price_annual'],
          } as any,
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await productResource.update('product_123', params);

      const call = (client.request as ReturnType<typeof vi.spyOn>).mock.calls[0][0];
      expect(call.body).toMatchObject({
        variants: [expect.objectContaining({ priceIds: ['price_monthly', 'price_annual'] })],
      });
    });
  });

  describe('get — multi-price response shape', () => {
    it('response includes prices[] with billingType / amount / currency', async () => {
      const monthlyPrice: Price = {
        id: 'price_monthly',
        label: 'Monthly',
        order: 0,
        enabled: true,
        isDefault: true,
        billingType: 'recurring',
        amount: 2900,
        currency: 'usd',
        recurring: {
          interval: 'month',
          intervalCount: 1,
          trialPeriodDays: null,
          planIterations: null,
          billingCycleAnchorConfig: null,
          startDate: null,
        },
      };

      const annualPrice: Price = {
        id: 'price_annual',
        label: 'Annual',
        order: 1,
        enabled: true,
        isDefault: false,
        billingType: 'recurring',
        amount: 29000,
        currency: 'usd',
        recurring: {
          interval: 'year',
          intervalCount: 1,
          trialPeriodDays: null,
          planIterations: null,
          billingCycleAnchorConfig: null,
          startDate: null,
        },
      };

      const mockProduct: Product = {
        data: {
          id: 'product_multi',
          title: 'Multi-Price Product',
          type: 'subscription',
          price: { amount: 2900, currency: 'usd' },
          prices: [monthlyPrice, annualPrice],
          defaultPriceId: 'price_monthly',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockProduct);

      const result = await productResource.get('product_multi');

      const product: ProductData = result.data;
      const prices: Price[] | null | undefined = product?.prices;
      const defaultPriceId: string | null | undefined = product?.defaultPriceId;

      expect(prices).toHaveLength(2);
      expect(defaultPriceId).toBe('price_monthly');
      expect(prices![0].billingType).toBe('recurring');
      expect(prices![0].amount).toBe(2900);
      expect(prices![0].recurring?.interval).toBe('month');
    });

    it('response includes variant priceIds scoping', async () => {
      const mockVariant: ProductVariant = {
        id: 'variant_plan',
        name: 'Plan',
        priceIds: ['price_monthly', 'price_annual'],
      };

      const mockProduct: Product = {
        data: {
          id: 'product_variants',
          title: 'Product with Variant Price Scoping',
          type: 'subscription',
          price: { amount: 2900, currency: 'usd' },
          prices: [],
          defaultPriceId: null,
          variants: [mockVariant],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockProduct);

      const result = await productResource.get('product_variants');
      const variant: ProductVariant = result.data!.variants![0];
      const priceIds: string[] | null | undefined = variant.priceIds;

      expect(priceIds).toEqual(['price_monthly', 'price_annual']);
    });
  });
});
