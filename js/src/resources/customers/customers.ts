import type { CheckoutPageClient } from '../../client';
import type { Customer, CustomerList, CustomerListArgs } from '../../types';

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

  async list(args: CustomerListArgs): Promise<CustomerList> {
    return this.client.request<CustomerList>({
      method: 'GET',
      query: args,
      path: '/v1/customers/',
    });
  }
}
