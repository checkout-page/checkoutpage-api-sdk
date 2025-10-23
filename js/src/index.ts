import { CheckoutPageClient, CheckoutPageClientOptions } from './client';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PaymentResource } from './resources/payments/payments';

export class CheckoutPage {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly payments: PaymentResource;
  private readonly client: CheckoutPageClient;

  constructor(options: CheckoutPageClientOptions) {
    this.client = new CheckoutPageClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.payments = new PaymentResource(this.client);
  }
}

// Export types and errors for convenience
export type { CheckoutPageClientOptions } from './client';
export type {
  Customer,
  Address,
  Shipping,
  Coupon,
  CouponList,
  Payment,
  PaymentList,
} from './types';
export {
  CheckoutPageError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ValidationError,
  APIError,
} from './errors';
