import type { CheckoutPageApiClient } from '../../client';
import type {
  TicketList,
  TicketListParams,
  UpdateTicketParams,
  UpdateTicketResponse,
  ValidateTicketData,
  ValidateTicketParams,
  ValidateTicketResponse,
} from '../../types';

export class TicketResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: TicketListParams = {}): Promise<TicketList> {
    const query: Record<string, string | undefined> = {
      pageId: args.pageId,
      bookingId: args.bookingId,
      orderId: args.orderId,
      customerId: args.customerId,
      ticketTypeId: args.ticketTypeId,
      status: args.status,
      checkInStatus: args.checkInStatus,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      search: args.search,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<TicketList>({
      method: 'GET',
      query,
      path: '/v1/tickets/',
    });
  }

  async update(ticketId: string, params: UpdateTicketParams): Promise<UpdateTicketResponse> {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    const body: Record<string, unknown> = {};

    if (params.attendeeName !== undefined) {
      body.attendeeName = params.attendeeName;
    }
    if (params.attendeeEmail !== undefined) {
      body.attendeeEmail = params.attendeeEmail;
    }
    if (params.metadata !== undefined) {
      body.metadata = params.metadata;
    }

    return this.client.request<UpdateTicketResponse>({
      method: 'PATCH',
      path: `/v1/tickets/${ticketId}`,
      body,
    });
  }

  async validate(qrCode: string, params?: ValidateTicketParams): Promise<ValidateTicketResponse> {
    const body = params || {};

    const response = await this.client.request<ValidateTicketData>({
      method: 'POST',
      path: `/v1/tickets/validate/${qrCode}`,
      body,
    });

    return response.data;
  }
}
