import type { CheckoutPageApiClient } from '../../client';
import type {
  CancelPaymentParams,
  CancelPaymentResponse,
  PaymentList,
  PaymentListParams,
  PaymentResponse,
  ReadOptions,
} from '../../types';

export class PaymentResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve a single payment by ID. Only checkout payments are returned —
   * an event charge is a booking, and 404s here.
   *
   * @example
   * const { data: payment } = await client.payments.get(paymentId);
   *
   * @example
   * // A test payment
   * const { data: testPayment } = await client.payments.get(paymentId, { livemode: false });
   */
  async get(paymentId: string, options: ReadOptions = {}): Promise<PaymentResponse> {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    return this.client.request<PaymentResponse>({
      method: 'GET',
      path: `/v1/payments/${paymentId}`,
      query: { livemode: options.livemode?.toString() },
    });
  }

  async list(args: PaymentListParams = {}): Promise<PaymentList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      status: args.status,
      orderStatus: args.orderStatus,
      pageId: args.pageId,
      customerId: args.customerId,
      orderId: args.orderId,
      couponCode: args.couponCode,
      productId: args.productId,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      abandonmentStatus: args.abandonmentStatus,
      livemode: args.livemode?.toString(),
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

  /**
   * Cancel a one-time payment. A cancel is final: it ends the whole order, puts the stock
   * back and removes the buyer's access to the order's files and license key. It does not
   * move money unless you pass `refund`, which runs first; if the refund fails the payment
   * is not canceled. Fires the `payment.canceled` webhook.
   *
   * Throws a `ValidationError` when the payment is already canceled, isn't complete yet,
   * or has nothing left to refund, and a `NotFoundError` for an unknown id or a booking id.
   *
   * @example
   * const { data: payment } = await client.payments.cancel(paymentId, {
   *   reason: 'Customer asked to cancel',
   * });
   *
   * @example
   * // Cancel, refund $25.00 and email the customer about both
   * await client.payments.cancel(paymentId, {
   *   reason: 'Event postponed',
   *   sendCancellationEmail: true,
   *   refund: { amount: 2500, reason: 'requested_by_customer', sendEmail: true },
   * });
   */
  async cancel(paymentId: string, params: CancelPaymentParams): Promise<CancelPaymentResponse> {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    return this.client.request<CancelPaymentResponse>({
      method: 'POST',
      path: `/v1/payments/${encodeURIComponent(paymentId)}/cancel`,
      body: params,
    });
  }
}
