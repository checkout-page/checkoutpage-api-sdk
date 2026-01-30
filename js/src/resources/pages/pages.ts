import type { CheckoutPageApiClient } from '../../client';
import type {
  Page,
  PageList,
  PageListParams,
  CreatePageParams,
  UpdatePageParams,
} from '../../types';

export class PageResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: PageListParams = {}): Promise<PageList> {
    const query: Record<string, string | undefined> = {
      status: args.status,
      type: args.type,
      limit: args.limit?.toString(),
      search: args.search,
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<PageList>({
      method: 'GET',
      query,
      path: '/v1/pages/',
    });
  }

  async create(params: CreatePageParams): Promise<Page> {
    return this.client.request<Page>({
      method: 'POST',
      path: '/v1/pages/',
      body: params as Record<string, unknown>,
    });
  }

  async get(pageId: string): Promise<Page> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<Page>({
      method: 'GET',
      path: `/v1/pages/${pageId}`,
    });
  }

  async update(pageId: string, params: UpdatePageParams): Promise<Page> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<Page>({
      method: 'PATCH',
      path: `/v1/pages/${pageId}`,
      body: params as Record<string, unknown>,
    });
  }

  async delete(pageId: string): Promise<void> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<void>({
      method: 'DELETE',
      path: `/v1/pages/${pageId}`,
    });
  }

  async publish(pageId: string): Promise<Page> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<Page>({
      method: 'POST',
      path: `/v1/pages/${pageId}/publish`,
    });
  }
}
