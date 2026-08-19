import type { CheckoutPageApiClient } from '../../client';
import type { PaymentList, PaymentListParams, PaymentResponse } from '../../types';

export class PaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve a single payment by ID. Only checkout payments are returned —
   * an event charge is a booking, and 404s here.
   *
   * @example
   * const { data: payment } = await client.payments.get(paymentId);
   */
  async get(paymentId: string): Promise<PaymentResponse> {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    return this.client.request<PaymentResponse>({
      method: 'GET',
      path: `/v1/payments/${paymentId}`,
    });
  }

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
