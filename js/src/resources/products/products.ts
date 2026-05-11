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
    if (params.sku !== undefined) {
      body.sku = params.sku;
    }
    if (params.hasUnlimitedStock !== undefined) {
      body.hasUnlimitedStock = params.hasUnlimitedStock;
    }
    if (params.stock !== undefined) {
      body.stock = params.stock;
    }
    if (params.taxBehavior !== undefined) {
      body.taxBehavior = params.taxBehavior;
    }
    if (params.taxCode !== undefined) {
      body.taxCode = params.taxCode;
    }
    if (params.imageIds !== undefined) {
      body.imageIds = params.imageIds;
    }
    if (params.fileIds !== undefined) {
      body.fileIds = params.fileIds;
    }
    if (params.variantsRequired !== undefined) {
      body.variantsRequired = params.variantsRequired;
    }
    if (params.variants !== undefined) {
      body.variants = params.variants;
    }
    if (params.discounts !== undefined) {
      body.discounts = params.discounts;
    }
    if (params.limitSubscriptions !== undefined) {
      body.limitSubscriptions = params.limitSubscriptions;
    }
    if (params.generateLicenseKeys !== undefined) {
      body.generateLicenseKeys = params.generateLicenseKeys;
    }
    if (params.fixedTaxRateIds !== undefined) {
      body.fixedTaxRateIds = params.fixedTaxRateIds;
    }

    return this.client.request<Product>({
      method: 'PATCH',
      path: `/v1/products/${productId}`,
      body,
    });
  }
}
