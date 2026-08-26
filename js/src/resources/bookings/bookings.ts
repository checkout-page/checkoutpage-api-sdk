import type { CheckoutPageApiClient } from '../../client';
import type { BookingList, BookingListParams, BookingResponse } from '../../types';

export class BookingResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve a single booking by ID. Only event bookings are returned —
   * a checkout charge is a payment, and 404s here.
   *
   * @example
   * const { data: booking } = await client.bookings.get(bookingId);
   */
  async get(bookingId: string): Promise<BookingResponse> {
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    return this.client.request<BookingResponse>({
      method: 'GET',
      path: `/v1/bookings/${bookingId}`,
    });
  }

  async list(args: BookingListParams = {}): Promise<BookingList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      status: args.status,
      pageId: args.pageId,
      customerId: args.customerId,
      orderId: args.orderId,
      couponCode: args.couponCode,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      abandonmentStatus: args.abandonmentStatus,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<BookingList>({
      method: 'GET',
      query,
      path: '/v1/bookings/',
    });
  }
}
