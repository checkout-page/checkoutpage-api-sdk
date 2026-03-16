import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { EventsResource } from './events';
import type {
  EventFieldDeleteResponse,
  EventFieldList,
  EventFieldResponse,
} from '../../types';

describe('EventsResource fields', () => {
  let client: CheckoutPageApiClient;
  let eventsResource: EventsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    eventsResource = new EventsResource(client);
  });

  it('lists all fields for an event', async () => {
    const mockResponse: EventFieldList = {
      data: [
        {
          id: 'field-default',
          label: 'Email',
          element: 'email',
          type: 'email',
          required: true,
          order: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'field-custom',
          label: 'Company Name',
          element: 'text',
          type: 'company-name',
          required: false,
          order: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.fields.list('page_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/page_123/fields',
    });
  });

  it('creates an event field', async () => {
    const mockResponse: EventFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Attendee Company',
        element: 'text',
        type: 'company-name',
        required: false,
        order: 2,
        placeholder: 'Acme Inc.',
        showHideLogic: {
          enabled: true,
          comparison: 'IS',
          value: 'option_123',
          element: {
            elementId: 'field_source',
            elementType: 'field',
            elementTitle: 'Ticket Type',
          },
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    };

    const params = {
      label: 'Attendee Company',
      element: 'text' as const,
      type: 'company-name' as const,
      placeholder: 'Acme Inc.',
      showHideLogic: {
        enabled: true,
        comparison: 'IS' as const,
        value: 'option_123',
        element: {
          elementId: 'field_source',
        },
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.fields.create('page_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/events/page_123/fields',
      body: params,
    });
  });

  it('gets an event field by id', async () => {
    const mockResponse: EventFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Phone Number',
        element: 'phone',
        type: 'phone',
        required: false,
        order: 3,
        showSelectedDialCode: true,
        limitAllowedCountries: {
          enabled: true,
          countries: ['US', 'CA'],
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.fields.get('page_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/events/page_123/fields/field_123',
    });
  });

  it('updates an event field and preserves nullable payloads', async () => {
    const mockResponse: EventFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Updated Label',
        element: 'text',
        required: true,
        order: 1,
        placeholder: undefined,
        defaultValue: undefined,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    };

    const params = {
      label: 'Updated Label',
      placeholder: null,
      defaultValue: null,
      minValue: null,
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.fields.update('page_123', 'field_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/events/page_123/fields/field_123',
      body: params,
    });
  });

  it('deletes an event field', async () => {
    const mockResponse: { data: EventFieldDeleteResponse } = {
      data: {
        success: true,
        message: 'Field deleted successfully',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await eventsResource.fields.delete('page_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/events/page_123/fields/field_123',
    });
  });

  it('throws for missing page ids or field ids', async () => {
    await expect(eventsResource.fields.list('')).rejects.toThrow('Page ID is required');
    await expect(eventsResource.fields.create('', { label: 'Field' })).rejects.toThrow(
      'Page ID is required'
    );
    await expect(eventsResource.fields.get('page_123', '')).rejects.toThrow('Field ID is required');
    await expect(
      eventsResource.fields.update('page_123', '', { label: 'Field' })
    ).rejects.toThrow('Field ID is required');
    await expect(eventsResource.fields.delete('page_123', '')).rejects.toThrow(
      'Field ID is required'
    );
  });
});
