import type { CheckoutPageApiClient } from '../../client';
import type {
  SubscriptionCancelParams,
  SubscriptionCancelResponse,
  SubscriptionList,
  SubscriptionListParams,
} from '../../types';

export class SubscriptionResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: SubscriptionListParams = {}): Promise<SubscriptionList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      pageId: args.pageId,
      status: args.status,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<SubscriptionList>({
      method: 'GET',
      query,
      path: '/v1/subscriptions/',
    });
  }

  /**
   * Cancel a subscription. Cancels immediately by default; pass
   * `cancelAtPeriodEnd: true` to defer until the end of the current billing
   * period, or `cancelAt: <ISO timestamp>` to schedule a specific future
   * moment. The two timing fields are mutually exclusive — enforced at the
   * type level via the {@link SubscriptionCancelParams} discriminated union
   * and at the server via zod. Cancellation is one-way; a canceled Stripe
   * subscription cannot be un-canceled.
   *
   * @example
   * await client.subscriptions.cancel(id);                                  // immediate (default)
   * await client.subscriptions.cancel(id, { reason: 'Customer requested' }); // immediate + note
   * await client.subscriptions.cancel(id, { cancelAtPeriodEnd: true });
   * await client.subscriptions.cancel(id, { cancelAt: '2026-12-31T23:59:59.000Z' });
   */
  async cancel(
    subscriptionId: string,
    params: SubscriptionCancelParams = {},
  ): Promise<SubscriptionCancelResponse> {
    return this.client.request<SubscriptionCancelResponse>({
      method: 'POST',
      path: `/v1/subscriptions/${subscriptionId}/cancel`,
      body: params,
    });
  }
}
