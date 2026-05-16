import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { EventsResource } from './events';
import type { CreateEventParams, UpdateEventParams } from '../../types';

describe('EventsResource', () => {
  let client: CheckoutPageApiClient;
  let eventsResource: EventsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    eventsResource = new EventsResource(client);
  });

  describe('list', () => {
    it('lists events and stringifies limit', async () => {
      const mockResponse: any = {
        data: [
          {
            id: 'event_123',
            name: 'Launch Event',
            type: 'event',
            status: 'published',
            slug: '/launch-event',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
        total: 1,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await eventsResource.list({
        limit: 10,
        status: 'draft',
        search: 'launch',
        starting_after: 'event_120',
        ending_before: 'event_140',
      });

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/events/',
        query: {
          limit: '10',
          starting_after: 'event_120',
          ending_before: 'event_140',
          status: 'draft',
          search: 'launch',
        },
      });
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const PAGE_1 = {
        data: [
          { id: 'e5', name: 'e5', type: 'event', status: 'published', slug: '/e5', createdAt: '', updatedAt: '' },
          { id: 'e4', name: 'e4', type: 'event', status: 'published', slug: '/e4', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const PAGE_2 = {
        data: [
          { id: 'e3', name: 'e3', type: 'event', status: 'published', slug: '/e3', createdAt: '', updatedAt: '' },
          { id: 'e2', name: 'e2', type: 'event', status: 'published', slug: '/e2', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1 as any)
        .mockResolvedValueOnce(PAGE_2 as any)
        .mockResolvedValueOnce({ ...PAGE_1, has_more: false } as any);

      await eventsResource.list({ limit: 2 });
      await eventsResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await eventsResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 'e4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 'e3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates an event', async () => {
      const params: CreateEventParams = {
        name: 'Created event',
        title: 'Created event title',
      };

      const mockResponse: any = {
        data: {
          id: 'event_123',
          name: 'Created event',
          type: 'event',
          status: 'published',
          slug: '/created-event',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await eventsResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/events/',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when creating an event', async () => {
      const params: CreateEventParams = {
        name: 'Created event',
        title: 'Created event title',
        slug: '/created-event',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'checkout',
            order: 0,
            enabled: true,
            config: {
              pageId: '507f1f77bcf86cd799439012',
            },
          },
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439013',
            },
          },
        ],
      };

      const mockResponse: any = { data: { id: 'event_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await eventsResource.create(params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/events/',
        body: params,
      });
    });
  });

  describe('get', () => {
    it('gets an event by id', async () => {
      const mockResponse: any = {
        data: {
          id: 'event_123',
          name: 'Existing event',
          type: 'event',
          status: 'published',
          slug: '/existing-event',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await eventsResource.get('event_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/events/event_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(eventsResource.get('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('updates an event and preserves null payloads', async () => {
      const params: UpdateEventParams = {
        status: 'draft',
        redirectUrl: null,
        notifyEmail: 'owner@example.com',
      };

      const mockResponse: any = {
        data: {
          id: 'event_123',
          name: 'Updated event',
          type: 'event',
          status: 'draft',
          slug: '/updated-event',
          notifyEmail: 'owner@example.com',
          redirectUrl: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await eventsResource.update('event_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/events/event_123',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when updating an event', async () => {
      const params: UpdateEventParams = {
        slug: '/updated-event',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439012',
            },
          },
        ],
      };

      const mockResponse: any = { data: { id: 'event_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await eventsResource.update('event_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/events/event_123',
        body: params,
      });
    });

    it('throws for missing page id', async () => {
      await expect(eventsResource.update('', {})).rejects.toThrow('Page ID is required');
    });
  });

  describe('delete', () => {
    it('archives an event', async () => {
      const mockResponse: any = {
        data: {
          id: 'event_123',
          name: 'Archived event',
          type: 'event',
          status: 'archived',
          slug: '/archived-event',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await eventsResource.delete('event_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/events/event_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(eventsResource.delete('')).rejects.toThrow('Page ID is required');
    });
  });
});
