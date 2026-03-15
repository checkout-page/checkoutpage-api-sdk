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
} from '../../types';

export class EventsResource {
  constructor(private client: CheckoutPageApiClient) {}

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
