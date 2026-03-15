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

// Coupons
export type CouponList =
  operations['coupons/list']['responses'][200]['content']['application/json'];

export type Coupon = CouponList['data'][number];
export type CreateCouponResponse =
  operations['coupons/create']['responses']['201']['content']['application/json'];

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

// Bookings
export type BookingList =
  operations['bookings/list']['responses'][200]['content']['application/json'];

export type Booking = BookingList['data'][number];

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

// Products
export type Product = operations['products/get']['responses'][200]['content']['application/json'];

export type UpdateProductParams = {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  trialPeriodDays?: number | null;
  setupFee?: number | null;
  planIterations?: number | null;
  payWhatYouWant?: boolean | null;
  stock?: number | null;
  hasUnlimitedStock?: boolean | null;
  sku?: string | null;
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

// Files
export type UploadFileResponse =
  operations['files/upload']['responses']['201']['content']['application/json'];

export type UploadFileParams = {
  file: File | Blob;
  purpose: 'image' | 'file';
};

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema';
