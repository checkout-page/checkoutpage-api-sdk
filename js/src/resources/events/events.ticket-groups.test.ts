import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { EventsResource } from './events';
import type {
  CreateEventTicketGroupParams,
  CreateEventTicketGroupResponse,
  EventTicketGroupList,
  EventTicketGroupResponse,
  UpdateEventTicketGroupParams,
  UpdateEventTicketGroupResponse,
  DeleteEventTicketGroupResponse,
} from '../../types';

describe('EventsResource ticketGroups', () => {
  let client: CheckoutPageApiClient;
  let eventsResource: EventsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    eventsResource = new EventsResource(client);
  });

  it('lists ticket groups for an event', async () => {
    const mockResponse: EventTicketGroupList = {
      data: [
        {
          id: 'group_123',
          name: 'General Admission',
          ticketTypeIds: ['ticket_1'],
        },
      ],
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.list('event_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/event_123/ticket-groups',
    });
  });

  it('creates a ticket group', async () => {
    const params: CreateEventTicketGroupParams = {
      name: 'VIP',
      availabilityBehavior: 'always_available',
    };

    const mockResponse: CreateEventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'VIP',
        availabilityBehavior: 'always_available',
        ticketTypeIds: [],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.create('event_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/events/event_123/ticket-groups',
      body: params,
    });
  });

  it('gets a ticket group by id', async () => {
    const mockResponse: EventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'VIP',
        ticketTypeIds: ['ticket_1'],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.get('event_123', 'group_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/event_123/ticket-groups/group_123',
    });
  });

  it('updates a ticket group and preserves null payloads', async () => {
    const params: UpdateEventTicketGroupParams = {
      description: null,
      capacity: null,
      hideWhenUnavailable: true,
    };

    const mockResponse: UpdateEventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'VIP',
        description: null,
        capacity: null,
        hideWhenUnavailable: true,
        ticketTypeIds: [],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.update('event_123', 'group_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/events/event_123/ticket-groups/group_123',
      body: params,
    });
  });

  it('creates a ticket group that shows its booking fee separately', async () => {
    const params: CreateEventTicketGroupParams = {
      name: 'General admission',
      feeDisplay: 'separate',
      layout: { showTicketFee: true },
    };

    const mockResponse: CreateEventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'General admission',
        feeDisplay: 'separate',
        layout: { showTicketFee: true },
        ticketTypeIds: [],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.create('event_123', params);

    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/events/event_123/ticket-groups',
      body: {
        name: 'General admission',
        feeDisplay: 'separate',
        layout: { showTicketFee: true },
      },
    });
    expect(result.data.feeDisplay).toBe('separate');
    expect(result.data.layout?.showTicketFee).toBe(true);
  });

  it('updates how a ticket group shows its booking fee', async () => {
    const params: UpdateEventTicketGroupParams = {
      feeDisplay: 'separate',
      layout: { showTicketFee: true },
    };

    const mockResponse: UpdateEventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'General admission',
        feeDisplay: 'separate',
        layout: { showTicketFee: true },
        ticketTypeIds: [],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.update('event_123', 'group_123', params);

    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/events/event_123/ticket-groups/group_123',
      body: { feeDisplay: 'separate', layout: { showTicketFee: true } },
    });
    expect(result.data.feeDisplay).toBe('separate');
    expect(result.data.layout?.showTicketFee).toBe(true);
  });

  it('archives a ticket group', async () => {
    const mockResponse: DeleteEventTicketGroupResponse = {
      data: {
        id: 'group_123',
        name: 'VIP',
        status: 'archived',
        ticketTypeIds: [],
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.ticketGroups.delete('event_123', 'group_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/events/event_123/ticket-groups/group_123',
    });
  });

  it('throws for missing page ids or ticket group ids', async () => {
    await expect(eventsResource.ticketGroups.list('')).rejects.toThrow('Page ID is required');
    await expect(eventsResource.ticketGroups.create('', { name: 'VIP' })).rejects.toThrow(
      'Page ID is required'
    );
    await expect(eventsResource.ticketGroups.get('event_123', '')).rejects.toThrow(
      'Ticket group ID is required'
    );
    await expect(
      eventsResource.ticketGroups.update('event_123', '', { name: 'VIP' })
    ).rejects.toThrow('Ticket group ID is required');
    await expect(eventsResource.ticketGroups.delete('event_123', '')).rejects.toThrow(
      'Ticket group ID is required'
    );
  });
});
