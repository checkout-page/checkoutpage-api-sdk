import type { CheckoutPageApiClient } from '../../client';
import type { SubscriptionPaymentList, SubscriptionPaymentListParams } from '../../types';

export class SubscriptionPaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: SubscriptionPaymentListParams = {}): Promise<SubscriptionPaymentList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      subscriptionId: args.subscriptionId,
      customerId: args.customerId,
      pageId: args.pageId,
      paymentStatus: args.paymentStatus,
      paid: args.paid,
      refunded: args.refunded,
      billingReason: args.billingReason,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
    };

    return this.client.request<SubscriptionPaymentList>({
      method: 'GET',
      query,
      path: '/v1/subscription-payments/',
    });
  }
}
