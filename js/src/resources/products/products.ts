import type { CheckoutPageApiClient } from '../../client';
import type {
  CreateProductParams,
  CreateProductResponse,
  DeleteProductParams,
  DeleteProductResponse,
  Product,
  ProductList,
  ProductListParams,
  UpdateProductParams,
} from '../../types';

export class ProductResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: ProductListParams = {}): Promise<ProductList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      role: args.role,
      search: args.search,
    };

    return this.client.request<ProductList>({
      method: 'GET',
      path: '/v1/products/',
      query,
    });
  }

  /** Creates an order bump product (`role: 'orderbump'`). Page products are created with their page. */
  async create(params: CreateProductParams): Promise<CreateProductResponse> {
    return this.client.request<CreateProductResponse>({
      method: 'POST',
      path: '/v1/products/',
      body: params,
    });
  }

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
    if (params.enableFileAccessForInactiveSubscriptions !== undefined) {
      body.enableFileAccessForInactiveSubscriptions =
        params.enableFileAccessForInactiveSubscriptions;
    }
    if (params.generateLicenseKeys !== undefined) {
      body.generateLicenseKeys = params.generateLicenseKeys;
    }
    if (params.fixedTaxRateIds !== undefined) {
      body.fixedTaxRateIds = params.fixedTaxRateIds;
    }
    if (params.prices !== undefined) {
      body.prices = params.prices;
    }
    if (params.defaultPriceId !== undefined) {
      body.defaultPriceId = params.defaultPriceId;
    }
    if (params.pricePicker !== undefined) {
      body.pricePicker = params.pricePicker;
    }
    for (const field of [
      'shortDescription',
      'callToActionText',
      'headingText',
      'features',
      'calloutText',
      'calloutIcon',
    ] as const) {
      if (params[field] !== undefined) {
        body[field] = params[field];
      }
    }

    return this.client.request<Product>({
      method: 'PATCH',
      path: `/v1/products/${productId}`,
      body,
    });
  }

  /** Deletes an order bump product that has never been bought. */
  async delete(
    productId: string,
    params: DeleteProductParams = {}
  ): Promise<DeleteProductResponse> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.client.request<DeleteProductResponse>({
      method: 'DELETE',
      path: `/v1/products/${productId}`,
      query: params.fromAllPages ? { fromAllPages: 'true' } : undefined,
    });
  }
}
