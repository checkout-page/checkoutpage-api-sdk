import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { EventsResource } from './events';
import type {
  CreateEventTicketTypeParams,
  CreateEventTicketTypeResponse,
  EventTicketTypeList,
  EventTicketTypeResponse,
  UpdateEventTicketTypeParams,
  UpdateEventTicketTypeResponse,
  DeleteEventTicketTypeResponse,
} from '../../types';

describe('EventsResource ticketGroups.ticketTypes', () => {
  let client: CheckoutPageApiClient;
  let eventsResource: EventsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    eventsResource = new EventsResource(client);
  });

  it('lists ticket types for a ticket group', async () => {
    const mockResponse: EventTicketTypeList = {
      data: [
        {
          id: 'ticket_123',
          name: 'General Admission',
        },
      ],
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.ticketTypes.list('event_123', 'group_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/event_123/ticket-groups/group_123/ticket-types',
    });
  });

  it('creates a ticket type', async () => {
    const params: CreateEventTicketTypeParams = {
      name: 'VIP',
      pricing: 'paid',
      price: 2500,
    };

    const mockResponse: CreateEventTicketTypeResponse = {
      data: {
        id: 'ticket_123',
        name: 'VIP',
        pricing: 'paid',
        price: 2500,
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.ticketTypes.create(
      'event_123',
      'group_123',
      params
    );

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/events/event_123/ticket-groups/group_123/ticket-types',
      body: params,
    });
  });

  it('gets a ticket type by id', async () => {
    const mockResponse: EventTicketTypeResponse = {
      data: {
        id: 'ticket_123',
        name: 'VIP',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.ticketTypes.get(
      'event_123',
      'group_123',
      'ticket_123'
    );

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/event_123/ticket-groups/group_123/ticket-types/ticket_123',
    });
  });

  it('updates a ticket type and preserves null payloads', async () => {
    const params: UpdateEventTicketTypeParams = {
      description: null,
      imageId: null,
      maxQuantity: 5,
    };

    const mockResponse: UpdateEventTicketTypeResponse = {
      data: {
        id: 'ticket_123',
        name: 'VIP',
        description: null,
        maxQuantity: 5,
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.ticketTypes.update(
      'event_123',
      'group_123',
      'ticket_123',
      params
    );

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/events/event_123/ticket-groups/group_123/ticket-types/ticket_123',
      body: params,
    });
  });

  it('archives a ticket type', async () => {
    const mockResponse: DeleteEventTicketTypeResponse = {
      data: {
        id: 'ticket_123',
        name: 'VIP',
        status: 'archived',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.ticketTypes.delete(
      'event_123',
      'group_123',
      'ticket_123'
    );

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/events/event_123/ticket-groups/group_123/ticket-types/ticket_123',
    });
  });

  it('throws for missing ids', async () => {
    await expect(eventsResource.ticketGroups.ticketTypes.list('', 'group_123')).rejects.toThrow(
      'Page ID is required'
    );
    await expect(
      eventsResource.ticketGroups.ticketTypes.create('event_123', '', { name: 'VIP' })
    ).rejects.toThrow('Ticket group ID is required');
    await expect(
      eventsResource.ticketGroups.ticketTypes.get('event_123', 'group_123', '')
    ).rejects.toThrow('Ticket type ID is required');
    await expect(
      eventsResource.ticketGroups.ticketTypes.update('event_123', 'group_123', '', { name: 'VIP' })
    ).rejects.toThrow('Ticket type ID is required');
    await expect(
      eventsResource.ticketGroups.ticketTypes.delete('event_123', 'group_123', '')
    ).rejects.toThrow('Ticket type ID is required');
  });
});
