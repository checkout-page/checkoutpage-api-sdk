import type { CheckoutPageApiClient } from '../../client';
import type { CreateTicketGroupParams, UpdateTicketGroupParams, TicketGroup } from '../../types';

export class PageTicketGroupResource {
  constructor(private client: CheckoutPageApiClient) {}

  async create(pageId: string, params: CreateTicketGroupParams): Promise<TicketGroup> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<TicketGroup>({
      method: 'POST',
      path: `/v1/pages/${pageId}/ticket-groups`,
      body: params as Record<string, unknown>,
    });
  }

  async update(
    pageId: string,
    groupId: string,
    params: UpdateTicketGroupParams
  ): Promise<TicketGroup> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!groupId) {
      throw new Error('Group ID is required');
    }

    return this.client.request<TicketGroup>({
      method: 'PATCH',
      path: `/v1/pages/${pageId}/ticket-groups/${groupId}`,
      body: params as Record<string, unknown>,
    });
  }

  async delete(pageId: string, groupId: string): Promise<void> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!groupId) {
      throw new Error('Group ID is required');
    }

    return this.client.request<void>({
      method: 'DELETE',
      path: `/v1/pages/${pageId}/ticket-groups/${groupId}`,
    });
  }
}
