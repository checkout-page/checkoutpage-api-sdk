import type { CheckoutPageApiClient } from '../../client';
import type {
  CreateOrderBumpParams,
  DeleteOrderBumpResponse,
  OrderBumpList,
  OrderBumpResponse,
  ReorderOrderBumpsParams,
  UpdateOrderBumpParams,
} from '../../types';

export type OrderBumpPageResource = 'checkout-pages' | 'events';

/**
 * Order bumps offered on a checkout page or event (shown as add-ons on an event).
 * A bump is addressed by its order bump product ID.
 *
 * Reached as `client.checkoutPages.orderBumps` and `client.events.orderBumps`.
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

  /** Lists the order bumps on the page in display order, including unavailable ones. */
  async list(pageId: string): Promise<OrderBumpList> {
    return this.client.request<OrderBumpList>({
      method: 'GET',
      path: this.basePath(pageId),
    });
  }

  /** Offers an order bump product on the page. It is added last. */
  async create(pageId: string, params: CreateOrderBumpParams): Promise<OrderBumpResponse> {
    return this.client.request<OrderBumpResponse>({
      method: 'POST',
      path: this.basePath(pageId),
      body: params,
    });
  }

  /** Updates how the order bump is offered on the page. `showHideLogic` is replaced whole. */
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

  /** Stops offering the order bump on the page. The product is kept. */
  async delete(pageId: string, productId: string): Promise<DeleteOrderBumpResponse> {
    const path = this.basePath(pageId);

    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.client.request<DeleteOrderBumpResponse>({
      method: 'DELETE',
      path: `${path}/${productId}`,
    });
  }

  /** Sets the display order. `productIds` must list every order bump on the page exactly once. */
  async reorder(pageId: string, params: ReorderOrderBumpsParams): Promise<OrderBumpList> {
    return this.client.request<OrderBumpList>({
      method: 'POST',
      path: `${this.basePath(pageId)}/reorder`,
      body: params,
    });
  }
}
