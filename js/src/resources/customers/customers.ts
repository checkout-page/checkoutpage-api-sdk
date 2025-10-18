import type { CheckoutPageClient } from '../../client'
import type { Customer } from '../../types'

export class CustomerResource {
  constructor(private client: CheckoutPageClient) {}

  async get(customerId: string): Promise<Customer> {
    if (!customerId) {
      throw new Error('Customer ID is required')
    }

    return this.client.request<Customer>({
      method: 'GET',
      path: `/v1/customers/${customerId}`,
    })
  }
}
