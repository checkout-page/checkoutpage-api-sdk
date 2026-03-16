import { CheckoutPageApiClient, CheckoutPageApiClientOptions } from './client';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PaymentResource } from './resources/payments/payments';
import { SubscriptionResource } from './resources/subscriptions/subscriptions';
import { BookingResource } from './resources/bookings/bookings';
import { TicketResource } from './resources/tickets/tickets';
import { ProductResource } from './resources/products/products';
import { FileResource } from './resources/files/files';
import { CheckoutPagesResource } from './resources/checkout-pages/checkout-pages';
import { EventsResource } from './resources/events/events';
import { FormsResource } from './resources/forms/forms';

export class CheckoutPageClient {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly payments: PaymentResource;
  public readonly subscriptions: SubscriptionResource;
  public readonly bookings: BookingResource;
  public readonly tickets: TicketResource;
  public readonly products: ProductResource;
  public readonly files: FileResource;
  public readonly checkoutPages: CheckoutPagesResource;
  public readonly events: EventsResource;
  public readonly forms: FormsResource;
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.payments = new PaymentResource(this.client);
    this.subscriptions = new SubscriptionResource(this.client);
    this.bookings = new BookingResource(this.client);
    this.tickets = new TicketResource(this.client);
    this.products = new ProductResource(this.client);
    this.files = new FileResource(this.client);
    this.checkoutPages = new CheckoutPagesResource(this.client);
    this.events = new EventsResource(this.client);
    this.forms = new FormsResource(this.client);
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
  Product,
  UpdateProductParams,
  Event,
  EventList,
  EventListParams,
  CreateEventParams,
  CreateEventResponse,
  EventResponse,
  UpdateEventParams,
  UpdateEventResponse,
  DeleteEventResponse,
  EventTicketGroup,
  EventTicketGroupList,
  EventTicketGroupResponse,
  CreateEventTicketGroupParams,
  CreateEventTicketGroupResponse,
  UpdateEventTicketGroupParams,
  UpdateEventTicketGroupResponse,
  DeleteEventTicketGroupResponse,
  EventTicketType,
  EventTicketTypeList,
  EventTicketTypeResponse,
  CreateEventTicketTypeParams,
  CreateEventTicketTypeResponse,
  UpdateEventTicketTypeParams,
  UpdateEventTicketTypeResponse,
  DeleteEventTicketTypeResponse,
  Form,
  FormList,
  FormListParams,
  CreateFormParams,
  CreateFormResponse,
  FormResponse,
  UpdateFormParams,
  UpdateFormResponse,
  DeleteFormResponse,
  FormField,
  FormFieldList,
  CreateFormFieldParams,
  UpdateFormFieldParams,
  FormFieldDeleteResponse,
  CheckoutPage,
  CheckoutPageList,
  CheckoutPageListParams,
  CreateCheckoutPageParams,
  CreateCheckoutPageResponse,
  CheckoutPageResponse,
  UpdateCheckoutPageParams,
  UpdateCheckoutPageResponse,
  DeleteCheckoutPageResponse,
  CheckoutPageField,
  CheckoutPageFieldList,
  CreateCheckoutPageFieldParams,
  UpdateCheckoutPageFieldParams,
  CheckoutPageFieldDeleteResponse,
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
