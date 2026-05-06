import type { CheckoutPageApiClient } from '../../client';
import type {
  TaxRateList,
  TaxRateResponse,
  CreateTaxRateParams,
  UpdateTaxRateParams,
} from '../../types';

export class TaxRateResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(): Promise<TaxRateList> {
    return this.client.request<TaxRateList>({
      method: 'GET',
      path: '/v1/tax-rates/',
    });
  }

  async create(params: CreateTaxRateParams): Promise<TaxRateResponse> {
    const body: Record<string, unknown> = {
      displayName: params.displayName,
      inclusive: params.inclusive,
      percentage: params.percentage,
    };

    if (params.default !== undefined) {
      body.default = params.default;
    }

    return this.client.request<TaxRateResponse>({
      method: 'POST',
      path: '/v1/tax-rates/',
      body,
    });
  }

  async update(taxRateId: string, params: UpdateTaxRateParams): Promise<TaxRateResponse> {
    if (!taxRateId) {
      throw new Error('Tax rate ID is required');
    }

    const body: Record<string, unknown> = {};

    if (params.displayName !== undefined) {
      body.displayName = params.displayName;
    }
    if (params.default !== undefined) {
      body.default = params.default;
    }

    return this.client.request<TaxRateResponse>({
      method: 'PATCH',
      path: `/v1/tax-rates/${taxRateId}`,
      body,
    });
  }
}
