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

export type CustomerListParams = Omit<NonNullable<CustomerListArgs>, 'limit' | 'skip'> & {
  limit?: number;
  skip?: number;
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

export type CouponListParams = Omit<NonNullable<CouponListArgs>, 'limit' | 'skip'> & {
  limit?: number;
  skip?: number;
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

export type PaymentListParams = Omit<NonNullable<PaymentListArgs>, 'limit' | 'skip'> & {
  limit?: number;
  skip?: number;
};

// Subscriptions
export type SubscriptionList =
  operations['subscriptions/list']['responses'][200]['content']['application/json'];

export type Subscription = SubscriptionList['data'][number];

export type SubscriptionListArgs = operations['subscriptions/list']['parameters']['query'];

export type SubscriptionListParams = Omit<NonNullable<SubscriptionListArgs>, 'limit' | 'skip'> & {
  limit?: number;
  skip?: number;
};

// Bookings

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema';
