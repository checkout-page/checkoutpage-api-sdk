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
  EventTicketTypeList,
  EventTicketTypeResponse,
  CreateEventTicketTypeParams,
  CreateEventTicketTypeResponse,
  UpdateEventTicketTypeParams,
  UpdateEventTicketTypeResponse,
  DeleteEventTicketTypeResponse,
} from '../../types';

export class EventTicketTypesResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(pageId: string, ticketGroupId: string): Promise<EventTicketTypeList> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    return this.client.request<EventTicketTypeList>({
      method: 'GET',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}/ticket-types`,
    });
  }

  async create(
    pageId: string,
    ticketGroupId: string,
    params: CreateEventTicketTypeParams
  ): Promise<CreateEventTicketTypeResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    return this.client.request<CreateEventTicketTypeResponse>({
      method: 'POST',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}/ticket-types`,
      body: params,
    });
  }

  async get(
    pageId: string,
    ticketGroupId: string,
    ticketTypeId: string
  ): Promise<EventTicketTypeResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    if (!ticketTypeId) {
      throw new Error('Ticket type ID is required');
    }

    return this.client.request<EventTicketTypeResponse>({
      method: 'GET',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}/ticket-types/${ticketTypeId}`,
    });
  }

  async update(
    pageId: string,
    ticketGroupId: string,
    ticketTypeId: string,
    params: UpdateEventTicketTypeParams
  ): Promise<UpdateEventTicketTypeResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    if (!ticketTypeId) {
      throw new Error('Ticket type ID is required');
    }

    return this.client.request<UpdateEventTicketTypeResponse>({
      method: 'PATCH',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}/ticket-types/${ticketTypeId}`,
      body: params,
    });
  }

  async delete(
    pageId: string,
    ticketGroupId: string,
    ticketTypeId: string
  ): Promise<DeleteEventTicketTypeResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!ticketGroupId) {
      throw new Error('Ticket group ID is required');
    }

    if (!ticketTypeId) {
      throw new Error('Ticket type ID is required');
    }

    return this.client.request<DeleteEventTicketTypeResponse>({
      method: 'DELETE',
      path: `/v1/events/${pageId}/ticket-groups/${ticketGroupId}/ticket-types/${ticketTypeId}`,
    });
  }
}

export class EventTicketGroupsResource {
  public readonly ticketTypes: EventTicketTypesResource;

  constructor(private client: CheckoutPageApiClient) {
    this.ticketTypes = new EventTicketTypesResource(client);
  }

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
