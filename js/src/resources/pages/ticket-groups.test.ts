import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageTicketGroupResource } from './ticket-groups';
import { CheckoutPageApiClient } from '../../client';
import type { Page, CreateTicketGroupParams, UpdateTicketGroupParams } from '../../types';

describe('PageTicketGroupResource', () => {
  let client: CheckoutPageApiClient;
  let ticketGroupResource: PageTicketGroupResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    ticketGroupResource = new PageTicketGroupResource(client);
  });

  describe('create', () => {
    it('should create a ticket group', async () => {
      const params: CreateTicketGroupParams = {
        name: 'General Admission',
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Event Page',
          type: 'event',
          status: 'draft',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await ticketGroupResource.create('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/ticket-groups',
        body: {
          name: 'General Admission',
        },
      });
    });

    it('should throw error for missing page id', async () => {
      const params: CreateTicketGroupParams = { name: 'Test' };
      await expect(ticketGroupResource.create('', params)).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('should update a ticket group', async () => {
      const params: UpdateTicketGroupParams = {
        name: 'Updated Group',
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Event Page',
          type: 'event',
          status: 'draft',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await ticketGroupResource.update('page_123', 'group_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/pages/page_123/ticket-groups/group_123',
        body: {
          name: 'Updated Group',
        },
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(ticketGroupResource.update('', 'group_123', {})).rejects.toThrow(
        'Page ID is required'
      );
    });

    it('should throw error for missing group id', async () => {
      await expect(ticketGroupResource.update('page_123', '', {})).rejects.toThrow(
        'Group ID is required'
      );
    });
  });

  describe('delete', () => {
    it('should delete a ticket group', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(undefined);

      await ticketGroupResource.delete('page_123', 'group_123');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/pages/page_123/ticket-groups/group_123',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(ticketGroupResource.delete('', 'group_123')).rejects.toThrow(
        'Page ID is required'
      );
    });

    it('should throw error for missing group id', async () => {
      await expect(ticketGroupResource.delete('page_123', '')).rejects.toThrow(
        'Group ID is required'
      );
    });
  });
});
