import type { CheckoutPageApiClient } from '../../client';
import type { CreateTicketTypeParams, UpdateTicketTypeParams, TicketType } from '../../types';

export class PageTicketTypeResource {
  constructor(private client: CheckoutPageApiClient) {}

  async create(
    pageId: string,
    groupId: string,
    params: CreateTicketTypeParams
  ): Promise<TicketType> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!groupId) {
      throw new Error('Group ID is required');
    }

    return this.client.request<TicketType>({
      method: 'POST',
      path: `/v1/pages/${pageId}/ticket-groups/${groupId}/ticket-types`,
      body: params as Record<string, unknown>,
    });
  }

  async update(
    pageId: string,
    groupId: string,
    typeId: string,
    params: UpdateTicketTypeParams
  ): Promise<TicketType> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    if (!typeId) {
      throw new Error('Type ID is required');
    }

    return this.client.request<TicketType>({
      method: 'PATCH',
      path: `/v1/pages/${pageId}/ticket-groups/${groupId}/ticket-types/${typeId}`,
      body: params as Record<string, unknown>,
    });
  }

  async delete(pageId: string, groupId: string, typeId: string): Promise<void> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    if (!typeId) {
      throw new Error('Type ID is required');
    }

    return this.client.request<void>({
      method: 'DELETE',
      path: `/v1/pages/${pageId}/ticket-groups/${groupId}/ticket-types/${typeId}`,
    });
  }
}
