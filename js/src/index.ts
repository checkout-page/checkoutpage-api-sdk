import { CheckoutPageApiClient, CheckoutPageApiClientOptions } from './client';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PaymentResource } from './resources/payments/payments';
import { SubscriptionResource } from './resources/subscriptions/subscriptions';
import { BookingResource } from './resources/bookings/bookings';

export class CheckoutPageClient {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly payments: PaymentResource;
  public readonly subscriptions: SubscriptionResource;
  public readonly bookings: BookingResource;
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.payments = new PaymentResource(this.client);
    this.subscriptions = new SubscriptionResource(this.client);
    this.bookings = new BookingResource(this.client);
  }
}

export const createCheckoutPageClient = (options: CheckoutPageApiClientOptions) => {
  return new CheckoutPageClient(options);
};

// Export types and errors for convenience
export type { CheckoutPageApiClientOptions } from './client';
export type {
  Customer,
  Address,
  Shipping,
  Coupon,
  CouponList,
  Payment,
  PaymentList,
  Subscription,
  SubscriptionList,
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
