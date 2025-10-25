import type { CheckoutPageApiClient } from '../../client';
import {
  CouponList,
  CouponListParams,
  CreateCouponParams,
  CreateCouponResponse,
} from '../../types';

export class CouponResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: CouponListParams = {}): Promise<CouponList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<CouponList>({
      method: 'GET',
      query,
      path: '/v1/coupons/',
    });
  }

  async create(params: CreateCouponParams): Promise<CreateCouponResponse> {
    const body: Record<string, unknown> = {
      label: params.label,
      code: params.code,
      duration: params.duration,
    };

    if (params.duration === 'repeating') {
      body.durationInMonths = (params as any).durationInMonths;
    }

    if (params.appliesToSetupFee !== undefined) {
      body.appliesToSetupFee = params.appliesToSetupFee;
    }
    if (params.pageIds !== undefined) {
      body.pageIds = params.pageIds;
    }
    if (params.maxRedemptions !== undefined) {
      body.maxRedemptions = params.maxRedemptions;
    }
    if (params.redeemBy !== undefined) {
      body.redeemBy = params.redeemBy;
    }

    if (params.type === 'amount') {
      body.amountOff = params.amountOff;
      body.currency = params.currency;
    } else {
      body.percentOff = params.percentOff;
    }

    return this.client.request<CreateCouponResponse>({
      method: 'POST',
      path: '/v1/coupons/',
      body,
    });
  }
}
