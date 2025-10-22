import type { CheckoutPageClient } from '../../client';
import { CouponList, CouponListParams } from '../../types';

export class CouponResource {
  constructor(private client: CheckoutPageClient) {}

  async list(args: CouponListParams = {}): Promise<CouponList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      limit: args.limit?.toString(),
      skip: args.skip?.toString(),
    };

    return this.client.request<CouponList>({
      method: 'GET',
      query,
      path: '/v1/coupons/',
    });
  }
}
