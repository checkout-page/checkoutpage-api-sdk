import type { CheckoutPageApiClient } from '../../client';
import type {
  FormList,
  FormListParams,
  CreateFormParams,
  CreateFormResponse,
  FormResponse,
  UpdateFormParams,
  UpdateFormResponse,
  DeleteFormResponse,
  FormFieldList,
  CreateFormFieldParams,
  UpdateFormFieldParams,
  FormFieldResponse,
  FormFieldDeleteResponse,
} from '../../types';

export class FormFieldsResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(pageId: string): Promise<FormFieldList> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<FormFieldList>({
      method: 'GET',
      path: `/v1/forms/${pageId}/fields`,
    });
  }

  async create(pageId: string, params: CreateFormFieldParams): Promise<FormFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<FormFieldResponse>({
      method: 'POST',
      path: `/v1/forms/${pageId}/fields`,
      body: params,
    });
  }

  async get(pageId: string, fieldId: string): Promise<FormFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<FormFieldResponse>({
      method: 'GET',
      path: `/v1/forms/${pageId}/fields/${fieldId}`,
    });
  }

  async update(
    pageId: string,
    fieldId: string,
    params: UpdateFormFieldParams
  ): Promise<FormFieldResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<FormFieldResponse>({
      method: 'PATCH',
      path: `/v1/forms/${pageId}/fields/${fieldId}`,
      body: params,
    });
  }

  async delete(pageId: string, fieldId: string): Promise<{ data: FormFieldDeleteResponse }> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    if (!fieldId) {
      throw new Error('Field ID is required');
    }

    return this.client.request<{ data: FormFieldDeleteResponse }>({
      method: 'DELETE',
      path: `/v1/forms/${pageId}/fields/${fieldId}`,
    });
  }
}

export class FormsResource {
  public readonly fields: FormFieldsResource;
  constructor(private client: CheckoutPageApiClient) {
    this.fields = new FormFieldsResource(client);
  }

  async list(args: FormListParams = {}): Promise<FormList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      status: args.status,
      search: args.search,
    };

    return this.client.request<FormList>({
      method: 'GET',
      path: '/v1/forms/',
      query,
    });
  }

  async create(params: CreateFormParams): Promise<CreateFormResponse> {
    return this.client.request<CreateFormResponse>({
      method: 'POST',
      path: '/v1/forms/',
      body: params,
    });
  }

  async get(pageId: string): Promise<FormResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<FormResponse>({
      method: 'GET',
      path: `/v1/forms/${pageId}`,
    });
  }

  async update(pageId: string, params: UpdateFormParams): Promise<UpdateFormResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<UpdateFormResponse>({
      method: 'PATCH',
      path: `/v1/forms/${pageId}`,
      body: params,
    });
  }

  async delete(pageId: string): Promise<DeleteFormResponse> {
    if (!pageId) {
      throw new Error('Page ID is required');
    }

    return this.client.request<DeleteFormResponse>({
      method: 'DELETE',
      path: `/v1/forms/${pageId}`,
    });
  }
}
