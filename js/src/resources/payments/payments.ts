import type { CheckoutPageApiClient } from '../../client';
import type { PaymentList, PaymentListParams } from '../../types';

export class PaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: PaymentListParams = {}): Promise<PaymentList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      status: args.status,
      pageId: args.pageId,
      customerId: args.customerId,
      orderId: args.orderId,
      couponCode: args.couponCode,
      productId: args.productId,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      abandonmentStatus: args.abandonmentStatus,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<PaymentList>({
      method: 'GET',
      query,
      path: '/v1/payments/',
    });
  }
}
