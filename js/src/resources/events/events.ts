import type { CheckoutPageApiClient } from '../../client';
import type {
  EventList,
  EventListParams,
  CreateEventParams,
  CreateEventResponse,
  EventResponse,
  UpdateEventParams,
  UpdateEventResponse,
  DeleteEventResponse,
  EventTicketGroupList,
  EventTicketGroupResponse,
  CreateEventTicketGroupParams,
  CreateEventTicketGroupResponse,
  UpdateEventTicketGroupParams,
  UpdateEventTicketGroupResponse,
  DeleteEventTicketGroupResponse,
} from '../../types';

export class EventTicketGroupsResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(pageId: string): Promise<EventTicketGroupList> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<EventTicketGroupList>({
      method: 'GET',
      path: `/v1/events/${pageId}/ticket-groups`,
    });
  }

  async create(
    pageId: string,
    params: CreateEventTicketGroupParams
  ): Promise<CreateEventTicketGroupResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<CreateEventTicketGroupResponse>({
      method: 'POST',
      path: `/v1/events/${pageId}/ticket-groups`,
      body: params,
    });
  }

  async get(pageId: string, ticketGroupId: string): Promise<EventTicketGroupResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    return this.client.request<EventTicketGroupResponse>({
      method: 'GET',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}`,
    });
  }

  async update(
    pageId: string,
    ticketGroupId: string,
    params: UpdateEventTicketGroupParams
  ): Promise<UpdateEventTicketGroupResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    return this.client.request<UpdateEventTicketGroupResponse>({
      method: 'PATCH',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}`,
      body: params,
    });
  }

  async delete(pageId: string, ticketGroupId: string): Promise<DeleteEventTicketGroupResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    return this.client.request<DeleteEventTicketGroupResponse>({
      method: 'DELETE',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}`,
    });
  }
}

export class EventsResource {
  public readonly ticketGroups: EventTicketGroupsResource;

  constructor(private client: CheckoutPageApiClient) {
    this.ticketGroups = new EventTicketGroupsResource(client);
  }

  async list(args: EventListParams = {}): Promise<EventList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      status: args.status,
      search: args.search,
    };

    return this.client.request<EventList>({
      method: 'GET',
      path: '/v1/events/',
      query,
    });
  }

  async create(params: CreateEventParams): Promise<CreateEventResponse> {
    return this.client.request<CreateEventResponse>({
      method: 'POST',
      path: '/v1/events/',
      body: params,
    });
  }

  async get(pageId: string): Promise<EventResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<EventResponse>({
      method: 'GET',
      path: `/v1/events/${pageId}`,
    });
  }

  async update(pageId: string, params: UpdateEventParams): Promise<UpdateEventResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<UpdateEventResponse>({
      method: 'PATCH',
      path: `/v1/events/${pageId}`,
      body: params,
    });
  }

  async delete(pageId: string): Promise<DeleteEventResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<DeleteEventResponse>({
      method: 'DELETE',
      path: `/v1/events/${pageId}`,
    });
  }
}
