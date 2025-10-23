# Checkout Page JavaScript SDK

Official JavaScript/TypeScript SDK for the Checkout Page API.

## Installation

```bash
npm install @checkoutpage/sdk
```

Or using pnpm:

```bash
pnpm add @checkoutpage/sdk
```

Or using yarn:

```bash
yarn add @checkoutpage/sdk
```

## Quick Start

```typescript
import { CheckoutPage } from '@checkoutpage/sdk';

const checkoutpage = new CheckoutPage({
  apiKey: 'YOUR_API_KEY',
});

// Get a customer
const customer = await checkoutpage.customers.get('customer_id');
console.log(customer);
```

## Authentication

The SDK requires an API key for authentication. You can obtain your API key from the [Checkout Page Dashboard](https://checkoutpage.com).

```typescript
const checkoutpage = new CheckoutPage({
  apiKey: process.env.CHECKOUTPAGE_API_KEY,
});
```

### Custom Base URL

For testing or custom environments, you can override the base URL:

```typescript
const checkoutpage = new CheckoutPage({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://custom-api.example.com',
});
```

## Usage

### Customers

#### Get a customer

```typescript
const customer = await checkoutpage.customers.get('6812fe6e9f39b6760576f01c');
```

#### List customers

```typescript
const results = await checkoutpage.customers.list();
```

### Coupons

#### List coupons

```typescript
const results = await checkoutpage.coupons.list();
```

With pagination and filtering:

```typescript
const results = await checkoutpage.coupons.list({
  search: '10off',
  limit: 50,
  skip: 0,
});
```

#### Create coupon

```typescript
const results = await checkoutpage.coupons.create({
  type: 'amount',
  label: 'Spring Sale',
  code: 'SPRING25',
  amountOff: 2500,
  currency: 'usd',
  duration: 'once',
});
```

### Payments

#### List payments

```typescript
const results = await checkoutpage.payments.list();
```

## Error Handling

The SDK provides typed error classes for different error scenarios:

```typescript
import {
  CheckoutPageError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ValidationError,
  APIError,
} from '@checkoutpage/sdk';

try {
  const customer = await checkoutpage.customers.get('customer_id');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof NotFoundError) {
    console.error('Customer not found');
  } else if (error instanceof ConflictError) {
    console.error('Resource already exists');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else if (error instanceof ValidationError) {
    console.error('Validation error');
  } else if (error instanceof APIError) {
    console.error('API error:', error.statusCode, error.message);
  }
}
```

### Error Types

- `CheckoutPageError` - Base error class
- `AuthenticationError` - Invalid API key or authentication failure (401, 403)
- `NotFoundError` - Resource not found (404)
- `ConflictError` - Resource already exists (409)
- `RateLimitError` - Rate limit exceeded (429)
- `ValidationError` - Request validation failed (400, 422)
- `APIError` - Generic API error with status code and response

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions auto-generated from the OpenAPI specification:

```typescript
import type { Customer, Address, Shipping } from '@checkoutpage/sdk';

const customer: Customer = await checkoutpage.customers.get('customer_id');
```

### Advanced Type Usage

Access all generated types for advanced use cases:

```typescript
import type { operations, components, paths } from '@checkoutpage/sdk';

// Get request type for an operation
type CreateCouponRequest =
  operations['coupons/create']['requestBody']['content']['application/json'];

// Get response type
type ListCustomersResponse =
  operations['customers/list']['responses'][200]['content']['application/json'];

// Access schema components
type CustomerId = components['schemas']['CustomerId'];
```

See [TYPE_GENERATION.md](../TYPE_GENERATION.md) for more details on working with generated types.

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (if using TypeScript)

## Examples

See the [examples](../examples/js) directory for more usage examples.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT

## Support

- Documentation: https://docs.checkoutpage.com
- GitHub Issues: https://github.com/checkout-page/checkoutpage-api-sdk/issues
- Email: support@checkoutpage.com
