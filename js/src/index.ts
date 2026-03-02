import { CheckoutPageApiClient, CheckoutPageApiClientOptions } from './client';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PaymentResource } from './resources/payments/payments';
import { SubscriptionResource } from './resources/subscriptions/subscriptions';
import { BookingResource } from './resources/bookings/bookings';
import { TicketResource } from './resources/tickets/tickets';
import { PageResource } from './resources/pages/pages';
import { PageFieldResource } from './resources/pages/fields';
import { PageTicketGroupResource } from './resources/pages/ticket-groups';
import { PageTicketTypeResource } from './resources/pages/ticket-types';
import { ProductResource } from './resources/products/products';
import { FileResource } from './resources/files/files';

export class CheckoutPageClient {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly payments: PaymentResource;
  public readonly subscriptions: SubscriptionResource;
  public readonly bookings: BookingResource;
  public readonly tickets: TicketResource;
  public readonly pages: PageResource;
  public readonly pageFields: PageFieldResource;
  public readonly pageTicketGroups: PageTicketGroupResource;
  public readonly pageTicketTypes: PageTicketTypeResource;
  public readonly products: ProductResource;
  public readonly files: FileResource;
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.payments = new PaymentResource(this.client);
    this.subscriptions = new SubscriptionResource(this.client);
    this.bookings = new BookingResource(this.client);
    this.tickets = new TicketResource(this.client);
    this.pages = new PageResource(this.client);
    this.pageFields = new PageFieldResource(this.client);
    this.pageTicketGroups = new PageTicketGroupResource(this.client);
    this.pageTicketTypes = new PageTicketTypeResource(this.client);
    this.products = new ProductResource(this.client);
    this.files = new FileResource(this.client);
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
  ValidateTicketResponse,
  ValidateTicketParams,
  Page,
  PageList,
  PageListParams,
  CreatePageParams,
  UpdatePageParams,
  PageField,
  PageFieldList,
  CreatePageFieldParams,
  UpdatePageFieldParams,
  CreateTicketGroupParams,
  UpdateTicketGroupParams,
  CreateTicketTypeParams,
  UpdateTicketTypeParams,
  Product,
  UpdateProductParams,
  UploadFileResponse,
  UploadFileParams,
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
