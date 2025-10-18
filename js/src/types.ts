/**
 * Type definitions for the CheckoutPage API
 *
 * This file exports commonly used types from the generated schema.
 * The full generated schema is available in ./generated/schema.ts
 */

import type { components, operations } from './generated/schema'

// Export all schemas (models)
export type Schemas = components['schemas']

// Export all operations
export type Operations = operations

// Commonly used types exported for convenience
export type Customer = operations['customers/get']['responses'][200]['content']['application/json']
export type Address = NonNullable<Customer['address']>
export type Shipping = NonNullable<Customer['shipping']>

export type Coupon =
  operations['coupons/list']['responses'][200]['content']['application/json']['data'][number]

// Re-export the generated types for advanced usage
export type { components, operations, paths } from './generated/schema'
