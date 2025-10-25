import type { CheckoutPageApiClient } from '../../client';
import type { Customer, CustomerList, CustomerListParams } from '../../types';

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
}
