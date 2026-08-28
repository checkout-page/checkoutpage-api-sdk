/**
 * Type definitions for the Checkout Page API
 *
 * This file exports commonly used types from the generated schema.
 * The full generated schema is available in ./generated/schema.ts
 */

import type { components, operations } from './generated/schema';

// Export all schemas (models)
export type Schemas = components['schemas'];

// Export all operations
export type Operations = operations;

// Account
/** The seller account an API key belongs to. */
export type Account = operations['account/get']['responses'][200]['content']['application/json'];

/** Store logo on an account, or `null` when none is set. */
export type AccountLogo = Account['logo'];

// Customers
export type Customer = operations['customers/get']['responses'][200]['content']['application/json'];
export type CustomerList =
  operations['customers/list']['responses'][200]['content']['application/json'];

export type CustomerListArgs = operations['customers/list']['parameters']['query'];

export type CustomerListParams = Omit<NonNullable<CustomerListArgs>, 'limit'> & {
  limit?: number;
};

export type Address = NonNullable<Customer['data']['address']>;
export type Shipping = NonNullable<Customer['data']['shipping']>;

export type UpdateCustomerParams = NonNullable<
  operations['customers/update']['requestBody']
>['content']['application/json'];

export type UpdateCustomerResponse =
  operations['customers/update']['responses'][200]['content']['application/json'];

// Submissions
export type SubmissionResponse =
  operations['submissions/get']['responses'][200]['content']['application/json'];

export type Submission = SubmissionResponse['data'];

export type SubmissionList =
  operations['submissions/list']['responses'][200]['content']['application/json'];

export type SubmissionListArgs = operations['submissions/list']['parameters']['query'];

export type SubmissionListParams = Omit<NonNullable<SubmissionListArgs>, 'limit'> & {
  limit?: number;
};

// Coupons
export type CouponList =
  operations['coupons/list']['responses'][200]['content']['application/json'];

export type Coupon = CouponList['data'][number];
export type CreateCouponResponse =
  operations['coupons/create']['responses']['201']['content']['application/json'];

export type UpdateCouponParams = NonNullable<
  operations['coupons/update']['requestBody']
>['content']['application/json'];

export type UpdateCouponResponse =
  operations['coupons/update']['responses'][200]['content']['application/json'];

export type CouponListArgs = operations['coupons/list']['parameters']['query'];

export type CouponListParams = Omit<NonNullable<CouponListArgs>, 'limit'> & {
  limit?: number;
};

type CouponCreateArgs = NonNullable<
  operations['coupons/create']['requestBody']
>['content']['application/json'];

type NonRepeatingParams = CouponCreateArgs & {
  duration: 'once' | 'forever';
  durationInMonths?: never;
};

type RepeatingParams = CouponCreateArgs & {
  duration: 'repeating';
  durationInMonths: number;
};

export type AmountNonRepeating = { type: 'amount' } & Omit<NonRepeatingParams, 'percentOff'>;

export type AmountRepeating = { type: 'amount' } & Omit<RepeatingParams, 'percentOff'>;

export type PercentNonRepeating = { type: 'percent' } & Omit<
  NonRepeatingParams,
  'amountOff' | 'currency'
>;

export type PercentRepeating = { type: 'percent' } & Omit<
  RepeatingParams,
  'amountOff' | 'currency'
>;

export type CreateCouponParams =
  | AmountNonRepeating
  | AmountRepeating
  | PercentNonRepeating
  | PercentRepeating;

// Payments
export type PaymentList =
  operations['payments/list']['responses'][200]['content']['application/json'];

export type Payment = PaymentList['data'][number];

/** Frozen snapshot of the purchased price captured at the point of purchase. */
export type PriceSnapshot = NonNullable<Payment['priceSnapshot']>;

export type PaymentResponse =
  operations['payments/get']['responses'][200]['content']['application/json'];

export type PaymentListArgs = operations['payments/list']['parameters']['query'];

export type PaymentListParams = Omit<NonNullable<PaymentListArgs>, 'limit'> & {
  limit?: number;
};

// Subscriptions
export type SubscriptionList =
  operations['subscriptions/list']['responses'][200]['content']['application/json'];

export type Subscription = SubscriptionList['data'][number];

export type SubscriptionListArgs = operations['subscriptions/list']['parameters']['query'];

export type SubscriptionListParams = Omit<NonNullable<SubscriptionListArgs>, 'limit'> & {
  limit?: number;
};

export type SubscriptionResponse =
  operations['subscriptions/get']['responses'][200]['content']['application/json'];

/**
 * Raw wire-shape from the OpenAPI spec — every field optional. Not exported
 * because the public `SubscriptionCancelParams` below tightens this into a
 * discriminated union that prevents zero/multiple timing fields at compile
 * time.
 */
type RawSubscriptionCancelBody = NonNullable<
  operations['subscriptions/cancel']['requestBody']
>['content']['application/json'];

type SubscriptionCancelOptions = Pick<
  RawSubscriptionCancelBody,
  'reason' | 'sendCancellationEmail'
>;

/**
 * Cancellation timing — exactly one of `cancelImmediately`,
 * `cancelAtPeriodEnd`, or `cancelAt` must be set. Cancellation is a
 * significant action, so timing is explicit at the API boundary (the
 * server enforces this via zod's `superRefine`; this discriminator
 * mirrors the rule at compile time via the `?: never` trick on the
 * unused fields — see CancelSubscriptionRequestBodyValidationSchema in
 * @repo/schemas).
 */
export type SubscriptionCancelTiming =
  | { cancelImmediately: true; cancelAtPeriodEnd?: never; cancelAt?: never }
  | { cancelImmediately?: never; cancelAtPeriodEnd: true; cancelAt?: never }
  | { cancelImmediately?: never; cancelAtPeriodEnd?: never; cancelAt: string };

export type SubscriptionCancelParams = SubscriptionCancelTiming & SubscriptionCancelOptions;

export type SubscriptionCancelResponse =
  operations['subscriptions/cancel']['responses'][200]['content']['application/json'];

// Bookings
export type BookingList =
  operations['bookings/list']['responses'][200]['content']['application/json'];

export type Booking = BookingList['data'][number];

export type BookingResponse =
  operations['bookings/get']['responses'][200]['content']['application/json'];

export type BookingListArgs = operations['bookings/list']['parameters']['query'];

export type BookingListParams = Omit<NonNullable<BookingListArgs>, 'limit'> & {
  limit?: number;
};

// Tickets
export type ValidateTicketData =
  operations['tickets/validate']['responses'][200]['content']['application/json'];

export type ValidateTicketResponse = ValidateTicketData['data'];

export type ValidateTicketParams = NonNullable<
  operations['tickets/validate']['requestBody']
>['content']['application/json'];

export type TicketList = operations['tickets/list']['responses'][200]['content']['application/json'];

export type Ticket = TicketList['data'][number];

export type TicketListArgs = operations['tickets/list']['parameters']['query'];

export type TicketListParams = Omit<NonNullable<TicketListArgs>, 'limit'> & {
  limit?: number;
};

// Subscription Payments
export type SubscriptionPaymentList =
  operations['subscription-payments/list']['responses'][200]['content']['application/json'];

export type SubscriptionPayment = SubscriptionPaymentList['data'][number];

export type SubscriptionPaymentResponse =
  operations['subscription-payments/get']['responses'][200]['content']['application/json'];

export type SubscriptionPaymentListArgs =
  operations['subscription-payments/list']['parameters']['query'];

export type SubscriptionPaymentListParams = Omit<
  NonNullable<SubscriptionPaymentListArgs>,
  'limit'
> & {
  limit?: number;
};

// Products
export type Product = operations['products/get']['responses'][200]['content']['application/json'];

export type ProductData = Product['data'];

/** A single price option on a product (multi-price feature) — read/response shape. */
export type Price = components['schemas']['Price'];

/**
 * Input shape for a price when creating a product via
 * `CreateCheckoutPageParams.productData.prices[]`.
 */
export type PriceInput = components['schemas']['PriceInput'];

/** A variant group within a product (may have `priceIds` scoping it to a subset of prices). */
export type ProductVariant = NonNullable<NonNullable<NonNullable<ProductData>['variants']>[number]>;

type UpdateProductRequestBase = NonNullable<
  operations['products/update']['requestBody']
>['content']['application/json'];

/**
 * Parameters for updating a product. Extends the base schema with multi-price
 * fields (`prices[]`, `defaultPriceId`) that are accepted by the API.
 */
export type UpdateProductParams = UpdateProductRequestBase & {
  /**
   * Multi-price configuration for this product. When provided, replaces the
   * existing prices. All prices must share the same currency. Locked fields on
   * a purchased price cannot be changed.
   */
  prices?: PriceInput[];
  /** Id of the price to use as the default. */
  defaultPriceId?: string | null;
};

// Events
export type EventList = operations['events/list']['responses'][200]['content']['application/json'];

export type Event = EventList['data'][number];

export type EventListArgs = operations['events/list']['parameters']['query'];

export type EventListParams = Omit<NonNullable<EventListArgs>, 'limit'> & {
  limit?: number;
};

export type CreateEventParams = NonNullable<
  operations['events/create']['requestBody']
>['content']['application/json'];

export type CreateEventResponse =
  operations['events/create']['responses'][201]['content']['application/json'];

export type EventResponse =
  operations['events/get']['responses'][200]['content']['application/json'];

export type UpdateEventParams = NonNullable<
  operations['events/update']['requestBody']
>['content']['application/json'];

export type UpdateEventResponse =
  operations['events/update']['responses'][200]['content']['application/json'];

export type DeleteEventResponse =
  operations['events/delete']['responses'][200]['content']['application/json'];

export type EventTicketGroupList =
  operations['events/ticket-groups/list']['responses'][200]['content']['application/json'];

export type EventTicketGroup = EventTicketGroupList['data'][number];

export type EventTicketGroupResponse =
  operations['events/ticket-groups/get']['responses'][200]['content']['application/json'];

export type CreateEventTicketGroupParams = NonNullable<
  operations['events/ticket-groups/create']['requestBody']
>['content']['application/json'];

export type CreateEventTicketGroupResponse =
  operations['events/ticket-groups/create']['responses'][201]['content']['application/json'];

export type UpdateEventTicketGroupParams = NonNullable<
  operations['events/ticket-groups/update']['requestBody']
>['content']['application/json'];

export type UpdateEventTicketGroupResponse =
  operations['events/ticket-groups/update']['responses'][200]['content']['application/json'];

export type DeleteEventTicketGroupResponse =
  operations['events/ticket-groups/delete']['responses'][200]['content']['application/json'];

export type EventTicketTypeList =
  operations['events/ticket-groups/ticket-types/list']['responses'][200]['content']['application/json'];

export type EventTicketType = EventTicketTypeList['data'][number];

export type EventTicketTypeResponse =
  operations['events/ticket-groups/ticket-types/get']['responses'][200]['content']['application/json'];

export type CreateEventTicketTypeParams = NonNullable<
  operations['events/ticket-groups/ticket-types/create']['requestBody']
>['content']['application/json'];

export type CreateEventTicketTypeResponse =
  operations['events/ticket-groups/ticket-types/create']['responses'][201]['content']['application/json'];

export type UpdateEventTicketTypeParams = NonNullable<
  operations['events/ticket-groups/ticket-types/update']['requestBody']
>['content']['application/json'];

export type UpdateEventTicketTypeResponse =
  operations['events/ticket-groups/ticket-types/update']['responses'][200]['content']['application/json'];

export type DeleteEventTicketTypeResponse =
  operations['events/ticket-groups/ticket-types/delete']['responses'][200]['content']['application/json'];

// Forms
export type FormList = operations['forms/list']['responses'][200]['content']['application/json'];

export type Form = FormList['data'][number];

export type FormListArgs = operations['forms/list']['parameters']['query'];

export type FormListParams = Omit<NonNullable<FormListArgs>, 'limit'> & {
  limit?: number;
};

export type CreateFormParams = NonNullable<
  operations['forms/create']['requestBody']
>['content']['application/json'];

export type CreateFormResponse =
  operations['forms/create']['responses'][201]['content']['application/json'];

export type FormResponse = operations['forms/get']['responses'][200]['content']['application/json'];

export type UpdateFormParams = NonNullable<
  operations['forms/update']['requestBody']
>['content']['application/json'];

export type UpdateFormResponse =
  operations['forms/update']['responses'][200]['content']['application/json'];

export type DeleteFormResponse =
  operations['forms/delete']['responses'][200]['content']['application/json'];

// Form fields
export type FormFieldList =
  operations['forms/fields/list']['responses'][200]['content']['application/json'];

export type FormField = FormFieldList['data'][number];

export type FormFieldResponse =
  operations['forms/fields/get']['responses'][200]['content']['application/json'];

export type CreateFormFieldParams = NonNullable<
  operations['forms/fields/create']['requestBody']
>['content']['application/json'];

export type UpdateFormFieldParams = NonNullable<
  operations['forms/fields/update']['requestBody']
>['content']['application/json'];

export type FormFieldDeleteResponse =
  operations['forms/fields/delete']['responses'][200]['content']['application/json'];

// Checkout pages
export type CheckoutPageList =
  operations['checkout-pages/list']['responses'][200]['content']['application/json'];

export type CheckoutPage = CheckoutPageList['data'][number];

export type CheckoutPageListArgs = operations['checkout-pages/list']['parameters']['query'];

export type CheckoutPageListParams = Omit<NonNullable<CheckoutPageListArgs>, 'limit'> & {
  limit?: number;
};

export type CreateCheckoutPageParams = NonNullable<
  operations['checkout-pages/create']['requestBody']
>['content']['application/json'];

export type CreateCheckoutPageResponse =
  operations['checkout-pages/create']['responses'][201]['content']['application/json'];

export type CheckoutPageResponse =
  operations['checkout-pages/get']['responses'][200]['content']['application/json'];

export type UpdateCheckoutPageParams = NonNullable<
  operations['checkout-pages/update']['requestBody']
>['content']['application/json'];

export type UpdateCheckoutPageResponse =
  operations['checkout-pages/update']['responses'][200]['content']['application/json'];

export type DeleteCheckoutPageResponse =
  operations['checkout-pages/delete']['responses'][200]['content']['application/json'];

// Checkout page fields
export type CheckoutPageFieldList =
  operations['checkout-pages/fields/list']['responses'][200]['content']['application/json'];

export type CheckoutPageField = CheckoutPageFieldList['data'][number];

export type CheckoutPageFieldResponse =
  operations['checkout-pages/fields/get']['responses'][200]['content']['application/json'];

export type CreateCheckoutPageFieldParams = NonNullable<
  operations['checkout-pages/fields/create']['requestBody']
>['content']['application/json'];

export type UpdateCheckoutPageFieldParams = NonNullable<
  operations['checkout-pages/fields/update']['requestBody']
>['content']['application/json'];

export type CheckoutPageFieldDeleteResponse =
  operations['checkout-pages/fields/delete']['responses'][200]['content']['application/json'];

// Event fields
export type EventFieldList =
  operations['events/fields/list']['responses'][200]['content']['application/json'];

export type EventField = EventFieldList['data'][number];

export type EventFieldResponse =
  operations['events/fields/get']['responses'][200]['content']['application/json'];

export type CreateEventFieldParams = NonNullable<
  operations['events/fields/create']['requestBody']
>['content']['application/json'];

export type UpdateEventFieldParams = NonNullable<
  operations['events/fields/update']['requestBody']
>['content']['application/json'];

export type EventFieldDeleteResponse =
  operations['events/fields/delete']['responses'][200]['content']['application/json'];

// Files
export type UploadFileResponse =
  operations['files/upload']['responses']['201']['content']['application/json'];

export type UploadFileParams = {
  file: File | Blob;
  purpose: 'image' | 'file';
};

export type DeleteFileResponse =
  operations['files/delete']['responses'][200]['content']['application/json'];

export type DownloadFileResponse =
  operations['files/download']['responses'][200]['content']['application/json'];

// Tax rates
export type TaxRateList =
  operations['tax-rates/list']['responses'][200]['content']['application/json'];

export type TaxRate = TaxRateList['data'][number];

export type TaxRateResponse =
  operations['tax-rates/create']['responses'][201]['content']['application/json'];

export type CreateTaxRateParams = NonNullable<
  operations['tax-rates/create']['requestBody']
>['content']['application/json'];

export type UpdateTaxRateParams = NonNullable<
  operations['tax-rates/update']['requestBody']
>['content']['application/json'];

// Invoices
export type Invoice =
  operations['invoices/list']['responses'][200]['content']['application/json']['data'][number];

export type InvoiceList =
  operations['invoices/list']['responses'][200]['content']['application/json'];

export type InvoiceResponse =
  operations['invoices/get']['responses'][200]['content']['application/json'];

export type InvoiceListArgs = operations['invoices/list']['parameters']['query'];

export type InvoiceListParams = Omit<NonNullable<InvoiceListArgs>, 'limit'> & {
  limit?: number;
};

// Webhooks
export type WebhookList =
  operations['webhooks/list']['responses'][200]['content']['application/json'];

/** A webhook endpoint. The signing `secret` is only present on `CreateWebhookResponse`. */
export type Webhook = WebhookList['data'][number];

export type WebhookListArgs = operations['webhooks/list']['parameters']['query'];

export type WebhookListParams = Omit<NonNullable<WebhookListArgs>, 'limit'> & {
  limit?: number;
};

export type CreateWebhookParams = NonNullable<
  operations['webhooks/create']['requestBody']
>['content']['application/json'];

export type CreateWebhookResponse =
  operations['webhooks/create']['responses'][201]['content']['application/json'];

export type WebhookResponse =
  operations['webhooks/get']['responses'][200]['content']['application/json'];

export type UpdateWebhookParams = NonNullable<
  operations['webhooks/update']['requestBody']
>['content']['application/json'];

export type UpdateWebhookResponse =
  operations['webhooks/update']['responses'][200]['content']['application/json'];

export type DeleteWebhookResponse =
  operations['webhooks/delete']['responses'][200]['content']['application/json'];

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema';
