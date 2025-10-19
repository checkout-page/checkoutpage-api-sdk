import type { CheckoutPageClient } from '../../client';
import type { Customer, CustomerList, CustomerListParams } from '../../types';

export class CustomerResource {
  constructor(private client: CheckoutPageClient) {}

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
      ...args,
      limit: args.limit?.toString(),
      skip: args.skip?.toString(),
    };

    return this.client.request<CustomerList>({
      method: 'GET',
      query,
      path: '/v1/customers/',
    });
  }
}
