import type { CheckoutPageApiClient } from '../../client';
import type {
  SubscriptionPaymentList,
  SubscriptionPaymentListParams,
  SubscriptionPaymentResponse,
} from '../../types';

export class SubscriptionPaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve a single subscription payment by ID — one charge within a
   * subscription's billing cycle, not the subscription itself. For every
   * payment on a subscription, use `list({ subscriptionId })`.
   *
   * @example
   * const { data: payment } = await client.subscriptionPayments.get(paymentId);
   */
  async get(subscriptionPaymentId: string): Promise<SubscriptionPaymentResponse> {
    if (!subscriptionPaymentId) {
      throw new Error('Subscription payment ID is required');
    }

    return this.client.request<SubscriptionPaymentResponse>({
      method: 'GET',
      path: `/v1/subscription-payments/${subscriptionPaymentId}`,
    });
  }

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
