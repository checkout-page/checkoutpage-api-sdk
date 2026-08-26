import type { CheckoutPageApiClient } from '../../client';
import {
  CouponList,
  CouponListParams,
  CreateCouponParams,
  CreateCouponResponse,
  UpdateCouponParams,
  UpdateCouponResponse,
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

  /**
   * Update an existing coupon. Only the fields you supply are changed.
   *
   * `pageIds` and `ticketTypeIds` replace the existing lists rather than
   * merging — pass an empty array to clear one.
   *
   * The discount itself (`code`, `amountOff`, `percentOff`, `currency`,
   * `duration`) is fixed once the coupon is mirrored into Stripe. To change a
   * discount, soft delete this coupon and create a replacement.
   *
   * @example
   * const { data: coupon } = await client.coupons.update(couponId, { deleted: true });
   */
  async update(couponId: string, params: UpdateCouponParams): Promise<UpdateCouponResponse> {
    if (!couponId) {
      throw new Error('Coupon ID is required');
    }

    return this.client.request<UpdateCouponResponse>({
      method: 'PATCH',
      path: `/v1/coupons/${couponId}`,
      body: params,
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
    if (params.ticketTypeIds !== undefined) {
      body.ticketTypeIds = params.ticketTypeIds;
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
