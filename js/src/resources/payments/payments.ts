import type { CheckoutPageApiClient } from '../../client';
import type { PaymentList, PaymentListParams } from '../../types';

export class PaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: PaymentListParams = {}): Promise<PaymentList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      status: args.status,
      pageId: args.pageId,
      limit: args.limit?.toString(),
      skip: args.skip?.toString(),
    };

    return this.client.request<PaymentList>({
      method: 'GET',
      query,
      path: '/v1/payments/',
    });
  }
}
