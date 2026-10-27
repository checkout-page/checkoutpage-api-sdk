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
   * `rules` replaces every stored rule rather than merging; an empty list makes
   * the coupon work on every checkout page and event. `pageIds` and
   * `ticketTypeIds` are deprecated: they are accepted only without `rules`, and
   * the API refuses them with a 400 when the coupon has rules they can't express.
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

  /**
   * Create a coupon. `rules` says where it works and what it discounts, one rule
   * per checkout page or event; omit it for a coupon that discounts the whole
   * order everywhere. `pageIds` and `ticketTypeIds` are deprecated in favour of
   * `rules` and cannot be sent with it.
   *
   * @example
   * await client.coupons.create({
   *   type: 'percent',
   *   label: 'Monthly plus workbook',
   *   code: 'BUNDLE20',
   *   percentOff: 20,
   *   duration: 'once',
   *   rules: [
   *     { pageId, appliesTo: 'pricesAndBumps', priceIds: [monthlyPriceId], bumpProductIds: [workbookId] },
   *   ],
   * });
   */
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
    if (params.appliesToTicketFees !== undefined) {
      body.appliesToTicketFees = params.appliesToTicketFees;
    }
    if (params.rules !== undefined) {
      body.rules = params.rules;
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
