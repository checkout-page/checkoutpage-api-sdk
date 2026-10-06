import type { CheckoutPageApiClient } from '../../client';
import type {
  CreateOrderBumpParams,
  CreateOrderBumpResponse,
  OrderBumpDeleteResponse,
  OrderBumpList,
  OrderBumpResponse,
  ReorderOrderBumpsParams,
  ReorderOrderBumpsResponse,
  UpdateOrderBumpParams,
} from '../../types';

export type OrderBumpPageResource = 'checkout-pages' | 'events';

/**
 * The order bumps on a checkout page or event (`checkoutPages.orderBumps`,
 * `events.orderBumps`). Needs order bumps enabled for the store to write.
 */
export class OrderBumpsResource {
  constructor(
    private client: CheckoutPageApiClient,
    private pageResource: OrderBumpPageResource
  ) {}

  private basePath(pageId: string) {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return `/v1/${this.pageResource}/${pageId}/order-bumps`;
  }

  async list(pageId: string): Promise<OrderBumpList> {
    return this.client.request<OrderBumpList>({
      method: 'GET',
      path: this.basePath(pageId),
    });
  }

  async create(pageId: string, params: CreateOrderBumpParams): Promise<CreateOrderBumpResponse> {
    return this.client.request<CreateOrderBumpResponse>({
      method: 'POST',
      path: this.basePath(pageId),
      body: params,
    });
  }

  async update(
    pageId: string,
    productId: string,
    params: UpdateOrderBumpParams
  ): Promise<OrderBumpResponse> {
    const path = this.basePath(pageId);
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.client.request<OrderBumpResponse>({
      method: 'PATCH',
      path: `${path}/${productId}`,
      body: params,
    });
  }

  async delete(pageId: string, productId: string): Promise<OrderBumpDeleteResponse> {
    const path = this.basePath(pageId);
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.client.request<OrderBumpDeleteResponse>({
      method: 'DELETE',
      path: `${path}/${productId}`,
    });
  }

  async reorder(
    pageId: string,
    params: ReorderOrderBumpsParams
  ): Promise<ReorderOrderBumpsResponse> {
    return this.client.request<ReorderOrderBumpsResponse>({
      method: 'POST',
      path: `${this.basePath(pageId)}/reorder`,
      body: params,
    });
  }
}
