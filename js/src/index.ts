import { CheckoutPageApiClient, CheckoutPageApiClientOptions } from './client';
import { AccountResource } from './resources/accounts/accounts';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PaymentResource } from './resources/payments/payments';
import { SubscriptionResource } from './resources/subscriptions/subscriptions';
import { SubscriptionPaymentResource } from './resources/subscription-payments/subscription-payments';
import { BookingResource } from './resources/bookings/bookings';
import { TicketResource } from './resources/tickets/tickets';
import { ProductResource } from './resources/products/products';
import { FileResource } from './resources/files/files';
import { CheckoutPagesResource } from './resources/checkout-pages/checkout-pages';
import { EventsResource } from './resources/events/events';
import { FormsResource } from './resources/forms/forms';
import { SubmissionResource } from './resources/submissions/submissions';
import { TaxRateResource } from './resources/tax-rates/tax-rates';
import { InvoiceResource } from './resources/invoices/invoices';
import { WebhookResource } from './resources/webhooks/webhooks';

export class CheckoutPageClient {
  public readonly accounts: AccountResource;
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly payments: PaymentResource;
  public readonly subscriptions: SubscriptionResource;
  public readonly subscriptionPayments: SubscriptionPaymentResource;
  public readonly bookings: BookingResource;
  public readonly tickets: TicketResource;
  public readonly products: ProductResource;
  public readonly files: FileResource;
  public readonly checkoutPages: CheckoutPagesResource;
  public readonly events: EventsResource;
  public readonly forms: FormsResource;
  public readonly submissions: SubmissionResource;
  public readonly taxRates: TaxRateResource;
  public readonly invoices: InvoiceResource;
  public readonly webhooks: WebhookResource;
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.accounts = new AccountResource(this.client);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.payments = new PaymentResource(this.client);
    this.subscriptions = new SubscriptionResource(this.client);
    this.subscriptionPayments = new SubscriptionPaymentResource(this.client);
    this.bookings = new BookingResource(this.client);
    this.tickets = new TicketResource(this.client);
    this.products = new ProductResource(this.client);
    this.files = new FileResource(this.client);
    this.checkoutPages = new CheckoutPagesResource(this.client);
    this.events = new EventsResource(this.client);
    this.forms = new FormsResource(this.client);
    this.submissions = new SubmissionResource(this.client);
    this.taxRates = new TaxRateResource(this.client);
    this.invoices = new InvoiceResource(this.client);
    this.webhooks = new WebhookResource(this.client);
  }
}

export const createCheckoutPageClient = (options: CheckoutPageApiClientOptions) => {
  return new CheckoutPageClient(options);
};

// Export types and errors for convenience
export type { CheckoutPageApiClientOptions } from './client';
export type {
  Account,
  AccountLogo,
  Customer,
  Submission,
  SubmissionResponse,
  SubmissionList,
  SubmissionListParams,
  Address,
  Shipping,
  Coupon,
  CouponList,
  Payment,
  PaymentList,
  PriceSnapshot,
  Subscription,
  SubscriptionList,
  SubscriptionPayment,
  SubscriptionPaymentList,
  SubscriptionPaymentListParams,
  ValidateTicketResponse,
  ValidateTicketParams,
  Product,
  ProductData,
  Price,
  PriceInput,
  ProductVariant,
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
  EventField,
  EventFieldList,
  CreateEventFieldParams,
  UpdateEventFieldParams,
  EventFieldResponse,
  EventFieldDeleteResponse,
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
  DeleteFileResponse,
  DownloadFileResponse,
  TaxRate,
  TaxRateList,
  TaxRateResponse,
  CreateTaxRateParams,
  UpdateTaxRateParams,
  Invoice,
  InvoiceList,
  InvoiceListParams,
  Webhook,
  WebhookList,
  WebhookListParams,
  WebhookResponse,
  CreateWebhookParams,
  CreateWebhookResponse,
  UpdateWebhookParams,
  UpdateWebhookResponse,
  DeleteWebhookResponse,
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
