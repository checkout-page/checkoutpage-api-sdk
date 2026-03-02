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

// Pages
export type PageList = operations['pages/list']['responses'][200]['content']['application/json'];

export type Page = operations['pages/get']['responses'][200]['content']['application/json'];

export type PageListArgs = operations['pages/list']['parameters']['query'];

export type PageListParams = Omit<NonNullable<PageListArgs>, 'limit'> & {
  limit?: number;
};

export type CreatePageParams = NonNullable<
  operations['pages/create']['requestBody']
>['content']['application/json'];

export type UpdatePageParams = NonNullable<
  operations['pages/update']['requestBody']
>['content']['application/json'];

// Page Fields
export type PageFieldList =
  operations['pages/fields/list']['responses'][200]['content']['application/json'];

export type PageField =
  operations['pages/fields/create']['responses']['201']['content']['application/json']; //; PageFieldList['data'][number];

export type CreatePageFieldParams = NonNullable<
  operations['pages/fields/create']['requestBody']
>['content']['application/json'];

export type UpdatePageFieldParams = NonNullable<
  operations['pages/fields/update']['requestBody']
>['content']['application/json'];

// Page Ticket Groups
export type CreateTicketGroupParams = NonNullable<
  operations['pages/ticket-groups/create']['requestBody']
>['content']['application/json'];

export type UpdateTicketGroupParams = NonNullable<
  operations['pages/ticket-groups/update']['requestBody']
>['content']['application/json'];

export type TicketGroup = NonNullable<
  operations['pages/ticket-groups/create']['responses'][201]['content']['application/json']
>;

// Page Ticket Types
export type CreateTicketTypeParams = NonNullable<
  operations['pages/ticket-types/create']['requestBody']
>['content']['application/json'];

export type UpdateTicketTypeParams = NonNullable<
  operations['pages/ticket-types/update']['requestBody']
>['content']['application/json'];

export type TicketType = NonNullable<
  operations['pages/ticket-types/create']['responses'][201]['content']['application/json']
>;

// Products
export type Product = operations['products/get']['responses'][200]['content']['application/json'];

export type UpdateProductParams = NonNullable<
  operations['products/update']['requestBody']
>['content']['application/json'];

// Files
export type UploadFileResponse =
  operations['files/upload']['responses']['201']['content']['application/json'];

export type UploadFileParams = {
  file: File | Blob;
  purpose: 'image' | 'file';
};

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema';
