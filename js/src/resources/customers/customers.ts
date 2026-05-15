import type { CheckoutPageApiClient } from '../../client';
import type {
  Customer,
  CustomerList,
  CustomerListParams,
  UpdateCustomerParams,
  UpdateCustomerResponse,
} from '../../types';

export class CustomerResource {
  constructor(private client: CheckoutPageApiClient) {}

  async get(customerId: string): Promise<Customer> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    return this.client.request<Customer>({
      method: 'GET',
      path: `/v1/customers/${customerId}`,
    });
  }

  async list(args: CustomerListParams = {}): Promise<CustomerList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<CustomerList>({
      method: 'GET',
      query,
      path: '/v1/customers/',
    });
  }

  async update(
    customerId: string,
    params: UpdateCustomerParams,
  ): Promise<UpdateCustomerResponse> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const body: Record<string, unknown> = {};

    if (params.name !== undefined) {
      body.name = params.name;
    }
    if (params.companyName !== undefined) {
      body.companyName = params.companyName;
    }
    if (params.email !== undefined) {
      body.email = params.email;
    }
    if (params.phone !== undefined) {
      body.phone = params.phone;
    }
    if (params.billingEmail !== undefined) {
      body.billingEmail = params.billingEmail;
    }
    if (params.address !== undefined) {
      body.address = params.address;
    }
    if (params.shipping !== undefined) {
      body.shipping = params.shipping;
    }

    return this.client.request<UpdateCustomerResponse>({
      method: 'PATCH',
      path: `/v1/customers/${customerId}`,
      body,
    });
  }
}
