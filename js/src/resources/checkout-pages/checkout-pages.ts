import type { CheckoutPageApiClient } from '../../client';
import type {
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

  async delete(
    pageId: string,
    fieldId: string
  ): Promise<{ data: CheckoutPageFieldDeleteResponse }> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    const response = await this.client.request<{ data: CheckoutPageFieldDeleteResponse }>({
      method: 'DELETE',
      path: `/v1/checkout-pages/${pageId}/fields/${fieldId}`,
    });

    return response;
  }
}

export class CheckoutPagesResource {
  public readonly fields: CheckoutPageFieldsResource;

  constructor(client: CheckoutPageApiClient) {
    this.fields = new CheckoutPageFieldsResource(client);
  }
}
