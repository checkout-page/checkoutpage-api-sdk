import type { CheckoutPageApiClient } from '../../client';
import type {
  BookingList,
  BookingListParams,
  BookingResponse,
  CreateBookingParams,
  CreateBookingResponse,
} from '../../types';

export class BookingResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Create an event booking without collecting card payment. This is a real
   * booking: tickets are issued, the customer receives a confirmation email
   * with the ticket PDF, live-mode bookings decrement capacity, and booking webhooks fire.
   * Every booking is recorded as `unpaid`, to be settled outside checkout
   * via the chosen manual payment option; a free booking simply has nothing
   * due.
   *
   * Field entries carry a `fieldId` plus the value. Every required field on
   * the event must be supplied, and a stock event requires name, email and a
   * billing address. The ids come from `GET /v1/events/{eventId}/fields`,
   * which this client does not yet wrap.
   *
   * @example
   * const { data: booking } = await client.bookings.create({
   *   eventId,
   *   tickets: { [ticketTypeId]: 2 },
   *   fields: [
   *     { fieldId: emailFieldId, value: 'ada@example.com' },
   *     { fieldId: nameFieldId, value: 'Ada Lovelace' },
   *   ],
   *   paymentOption: { manualType: 'invoice' },
   * });
   */
  async create(params: CreateBookingParams): Promise<CreateBookingResponse> {
    return this.client.request<CreateBookingResponse>({
      method: 'POST',
      path: '/v1/bookings/',
      body: params,
    });
  }

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

  /**
   * Download the booking's ticket PDF (every ticket in the booking) as raw
   * bytes. The response reflects the current tickets, so attendee updates
   * appear on the next download. Throws NotFoundError when no PDF exists,
   * e.g. for unpaid or abandoned bookings.
   *
   * @example
   * const pdf = await client.bookings.downloadTicketPdf(bookingId);
   * fs.writeFileSync('tickets.pdf', Buffer.from(pdf));
   */
  async downloadTicketPdf(bookingId: string): Promise<ArrayBuffer> {
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    return this.client.requestRaw({
      method: 'GET',
      path: `/v1/bookings/${bookingId}/ticket-pdf`,
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
