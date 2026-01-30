import type { CheckoutPageApiClient } from '../../client';
import type {
  PageFieldList,
  CreatePageFieldParams,
  UpdatePageFieldParams,
  PageField,
} from '../../types';

export class PageFieldResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(pageId: string): Promise<PageFieldList> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<PageFieldList>({
      method: 'GET',
      path: `/v1/pages/${pageId}/fields`,
    });
  }

  async create(pageId: string, params: CreatePageFieldParams): Promise<PageField> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<PageField>({
      method: 'POST',
      path: `/v1/pages/${pageId}/fields`,
      body: params as Record<string, unknown>,
    });
  }

  async update(pageId: string, fieldId: string, params: UpdatePageFieldParams): Promise<PageField> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<PageField>({
      method: 'PATCH',
      path: `/v1/pages/${pageId}/fields/${fieldId}`,
      body: params as Record<string, unknown>,
    });
  }

  async delete(pageId: string, fieldId: string): Promise<void> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }
    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<void>({
      method: 'DELETE',
      path: `/v1/pages/${pageId}/fields/${fieldId}`,
    });
  }
}
