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
