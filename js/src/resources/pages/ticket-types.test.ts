import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageTicketTypeResource } from './ticket-types';
import { CheckoutPageApiClient } from '../../client';
import type { Page, CreateTicketTypeParams, UpdateTicketTypeParams } from '../../types';

describe('PageTicketTypeResource', () => {
  let client: CheckoutPageApiClient;
  let ticketTypeResource: PageTicketTypeResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    ticketTypeResource = new PageTicketTypeResource(client);
  });

  describe('create', () => {
    it('should create a ticket type', async () => {
      const params: CreateTicketTypeParams = {
        name: 'VIP Ticket',
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

      const result = await ticketTypeResource.create('page_123', 'group_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/ticket-groups/group_123/ticket-types',
        body: {
          name: 'VIP Ticket',
        },
      });
    });

    it('should create ticket type with optional fields', async () => {
      const params: CreateTicketTypeParams = {
        name: 'VIP Ticket',
        description: 'Premium access',
        price: 9900,
        pricing: 'paid',
        capacity: 100,
        maxQuantity: 5,
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await ticketTypeResource.create('page_123', 'group_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/ticket-groups/group_123/ticket-types',
        body: {
          name: 'VIP Ticket',
          description: 'Premium access',
          price: 9900,
          pricing: 'paid',
          capacity: 100,
          maxQuantity: 5,
        },
      });
    });

    it('should throw error for missing page id', async () => {
      const params: CreateTicketTypeParams = { name: 'Test' };
      await expect(ticketTypeResource.create('', 'group_123', params)).rejects.toThrow(
        'Page ID is required'
      );
    });

    it('should throw error for missing group id', async () => {
      const params: CreateTicketTypeParams = { name: 'Test' };
      await expect(ticketTypeResource.create('page_123', '', params)).rejects.toThrow(
        'Group ID is required'
      );
    });
  });

  describe('update', () => {
    it('should update a ticket type', async () => {
      const params: UpdateTicketTypeParams = {
        name: 'Updated Ticket',
        price: 12900,
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

      const result = await ticketTypeResource.update('page_123', 'group_123', 'type_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/pages/page_123/ticket-groups/group_123/ticket-types/type_123',
        body: {
          name: 'Updated Ticket',
          price: 12900,
        },
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(
        ticketTypeResource.update('', 'group_123', 'type_123', {})
      ).rejects.toThrow('Page ID is required');
    });

    it('should throw error for missing group id', async () => {
      await expect(
        ticketTypeResource.update('page_123', '', 'type_123', {})
      ).rejects.toThrow('Group ID is required');
    });

    it('should throw error for missing type id', async () => {
      await expect(
        ticketTypeResource.update('page_123', 'group_123', '', {})
      ).rejects.toThrow('Type ID is required');
    });
  });

  describe('delete', () => {
    it('should delete a ticket type', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(undefined);

      await ticketTypeResource.delete('page_123', 'group_123', 'type_123');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/pages/page_123/ticket-groups/group_123/ticket-types/type_123',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(
        ticketTypeResource.delete('', 'group_123', 'type_123')
      ).rejects.toThrow('Page ID is required');
    });

    it('should throw error for missing group id', async () => {
      await expect(
        ticketTypeResource.delete('page_123', '', 'type_123')
      ).rejects.toThrow('Group ID is required');
    });

    it('should throw error for missing type id', async () => {
      await expect(
        ticketTypeResource.delete('page_123', 'group_123', '')
      ).rejects.toThrow('Type ID is required');
    });
  });
});
