import { CheckoutPageClient, CheckoutPageClientOptions } from './client'
import { CustomerResource } from './resources/customers/customers'

export class CheckoutPage {
  public readonly customers: CustomerResource
  private readonly client: CheckoutPageClient

  constructor(options: CheckoutPageClientOptions) {
    this.client = new CheckoutPageClient(options)
    this.customers = new CustomerResource(this.client)
  }
}

// Export types and errors for convenience
export type { CheckoutPageClientOptions } from './client'
export type { Customer, Address, Shipping } from './types'
export {
  CheckoutPageError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  APIError,
} from './errors'
