import type { CheckoutPageApiClient } from '../../client';
import type {
  CheckoutPageList,
  CheckoutPageListParams,
  CreateCheckoutPageParams,
  CreateCheckoutPageResponse,
  CheckoutPageResponse,
  UpdateCheckoutPageParams,
  UpdateCheckoutPageResponse,
  DeleteCheckoutPageResponse,
  CheckoutPageFieldDeleteResponse,
  CheckoutPageFieldList,
  CreateCheckoutPageFieldParams,
  UpdateCheckoutPageFieldParams,
  CheckoutPageFieldResponse,
} from '../../types';

export class CheckoutPageFieldsResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(pageId: string): Promise<CheckoutPageFieldList> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<CheckoutPageFieldList>({
      method: 'GET',
      path: `/v1/checkout-pages/${pageId}/fields`,
    });
  }

  async create(
    pageId: string,
    params: CreateCheckoutPageFieldParams
  ): Promise<CheckoutPageFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<CheckoutPageFieldResponse>({
      method: 'POST',
      path: `/v1/checkout-pages/${pageId}/fields`,
      body: params,
    });
  }

  async get(pageId: string, fieldId: string): Promise<CheckoutPageFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<CheckoutPageFieldResponse>({
      method: 'GET',
      path: `/v1/checkout-pages/${pageId}/fields/${fieldId}`,
    });
  }

  async update(
    pageId: string,
    fieldId: string,
    params: UpdateCheckoutPageFieldParams
  ): Promise<CheckoutPageFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<CheckoutPageFieldResponse>({
      method: 'PATCH',
      path: `/v1/checkout-pages/${pageId}/fields/${fieldId}`,
      body: params,
    });
  }

  async delete(pageId: string, fieldId: string): Promise<CheckoutPageFieldDeleteResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<CheckoutPageFieldDeleteResponse>({
      method: 'DELETE',
      path: `/v1/checkout-pages/${pageId}/fields/${fieldId}`,
    });
  }
}

export class CheckoutPagesResource {
  public readonly fields: CheckoutPageFieldsResource;
  private readonly client: CheckoutPageApiClient;

  constructor(client: CheckoutPageApiClient) {
    this.client = client;
    this.fields = new CheckoutPageFieldsResource(client);
  }

  async list(args: CheckoutPageListParams = {}): Promise<CheckoutPageList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      status: args.status,
      search: args.search,
      testmode: args.testmode?.toString(),
    };

    return this.client.request<CheckoutPageList>({
      method: 'GET',
      path: '/v1/checkout-pages/',
      query,
    });
  }

  async create(params: CreateCheckoutPageParams): Promise<CreateCheckoutPageResponse> {
    return this.client.request<CreateCheckoutPageResponse>({
      method: 'POST',
      path: '/v1/checkout-pages/',
      body: params,
    });
  }

  async get(pageId: string): Promise<CheckoutPageResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<CheckoutPageResponse>({
      method: 'GET',
      path: `/v1/checkout-pages/${pageId}`,
    });
  }

  async update(
    pageId: string,
    params: UpdateCheckoutPageParams
  ): Promise<UpdateCheckoutPageResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<UpdateCheckoutPageResponse>({
      method: 'PATCH',
      path: `/v1/checkout-pages/${pageId}`,
      body: params,
    });
  }

  async delete(pageId: string): Promise<DeleteCheckoutPageResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<DeleteCheckoutPageResponse>({
      method: 'DELETE',
      path: `/v1/checkout-pages/${pageId}`,
    });
  }
}
