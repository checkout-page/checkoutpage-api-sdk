import type { CheckoutPageApiClient } from '../../client';
import type { Product, UpdateProductParams } from '../../types';

export class ProductResource {
  constructor(private client: CheckoutPageApiClient) {}

  async get(productId: string): Promise<Product> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.client.request<Product>({
      method: 'GET',
      path: `/v1/products/${productId}`,
    });
  }

  async update(productId: string, params: UpdateProductParams): Promise<Product> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const body: Record<string, unknown> = {};

    if (params.title !== undefined) {
      body.title = params.title;
    }
    if (params.description !== undefined) {
      body.description = params.description;
    }
    if (params.price !== undefined) {
      body.price = params.price;
    }
    if (params.currency !== undefined) {
      body.currency = params.currency;
    }
    if (params.interval !== undefined) {
      body.interval = params.interval;
    }
    if (params.intervalCount !== undefined) {
      body.intervalCount = params.intervalCount;
    }
    if (params.trialPeriodDays !== undefined) {
      body.trialPeriodDays = params.trialPeriodDays;
    }
    if (params.setupFee !== undefined) {
      body.setupFee = params.setupFee;
    }
    if (params.planIterations !== undefined) {
      body.planIterations = params.planIterations;
    }
    if (params.payWhatYouWant !== undefined) {
      body.payWhatYouWant = params.payWhatYouWant;
    }
    if (params.stock !== undefined) {
      body.stock = params.stock;
    }
    if (params.hasUnlimitedStock !== undefined) {
      body.hasUnlimitedStock = params.hasUnlimitedStock;
    }
    if (params.sku !== undefined) {
      body.sku = params.sku;
    }

    return this.client.request<Product>({
      method: 'PATCH',
      path: `/v1/products/${productId}`,
      body,
    });
  }
}
