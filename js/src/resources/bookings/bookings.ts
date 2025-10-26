import type { CheckoutPageApiClient } from '../../client';
import type { BookingList, BookingListParams } from '../../types';

export class BookingResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: BookingListParams = {}): Promise<BookingList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      status: args.status,
      pageId: args.pageId,
    };

    return this.client.request<BookingList>({
      method: 'GET',
      query,
      path: '/v1/bookings/',
    });
  }
}
