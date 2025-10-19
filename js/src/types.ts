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

// Commonly used types exported for convenience
export type Customer = operations['customers/get']['responses'][200]['content']['application/json'];
export type CustomerList =
  operations['customers/list']['responses'][200]['content']['application/json'];

export type CustomerListArgs = operations['customers/list']['parameters']['query'];

export type CustomerListParams =
  | (Omit<NonNullable<CustomerListArgs>, 'limit' | 'skip'> & {
      limit?: number;
      skip?: number;
    })
  | undefined;

export type Address = NonNullable<Customer['data']['address']>;
export type Shipping = NonNullable<Customer['data']['shipping']>;

export type Coupon =
  operations['coupons/list']['responses'][200]['content']['application/json']['data'][number];

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema';
