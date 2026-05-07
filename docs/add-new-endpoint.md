# Add a New API Endpoint

This document provides step-by-step instructions for implementing a new API endpoint in the Checkout Page SDK. Follow these instructions exactly when asked to create a new endpoint (e.g., "please create a new endpoint for `pages/create`").

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Generate Types from OpenAPI Spec](#step-1-generate-types-from-openapi-spec)
3. [Step 2: Navigate the OpenAPI Spec](#step-2-navigate-the-openapi-spec)
4. [Step 3: Create or Identify Resource](#step-3-create-or-identify-resource)
5. [Step 4: Define Types](#step-4-define-types)
6. [Step 5: Register Resource in Client](#step-5-register-resource-in-client)
7. [Step 6: Implement Method](#step-6-implement-method)
8. [Step 7: Add Unit Tests](#step-7-add-unit-tests)
9. [Step 8: Add Integration Tests](#step-8-add-integration-tests)
10. [Step 9: Update Documentation](#step-9-update-documentation)
11. [Complete Example](#complete-example)

---

## Prerequisites

Before implementing a new endpoint, ensure:

1. The endpoint exists in `api-sdk/spec/openapi.json`
2. You have access to the generated schema types in `api-sdk/js/src/generated/schema.ts`
3. You understand the HTTP method (GET, POST, PUT, DELETE) for the endpoint
4. You know whether the endpoint requires path parameters, query parameters, or request body

---

## Step 1: Generate Types from OpenAPI Spec

**IMPORTANT:** Always run type generation BEFORE defining custom types.

```bash
cd api-sdk/js
pnpm generate:types
```

This command:

- Reads `api-sdk/spec/openapi.json`
- Generates TypeScript types in `api-sdk/js/src/generated/schema.ts`
- Creates types for all operations, schemas, and parameters

**Do NOT proceed without running this command first.**

---

## Step 2: Navigate the OpenAPI Spec

The OpenAPI spec (`api-sdk/spec/openapi.json`) follows this structure:

```json
{
  "paths": {
    "/v1/customers/{customerId}": {
      "get": {
        "operationId": "customers/get",
        "parameters": [...],
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {...}
              }
            }
          }
        }
      }
    },
    "/v1/coupons/": {
      "post": {
        "operationId": "coupons/create",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {...}
            }
          }
        },
        "responses": {
          "201": {...}
        }
      }
    }
  }
}
```

### Key Elements to Identify:

1. **Path**: The URL path (e.g., `/v1/customers/{customerId}`)
2. **HTTP Method**: `get`, `post`, `put`, `delete`
3. **Operation ID**: Used in generated types (e.g., `customers/get`)
4. **Path Parameters**: In curly braces `{customerId}` in the path
5. **Query Parameters**: In `parameters` array with `in: "query"`
6. **Request Body**: In `requestBody.content["application/json"].schema`
7. **Response**: In `responses[statusCode].content["application/json"].schema`

### Example: Finding Customer Get Endpoint

For operation `customers/get`:

- **Path**: `/v1/customers/{customerId}`
- **Method**: `GET`
- **Path Parameter**: `customerId` (required)
- **Response Type**: `operations['customers/get']['responses'][200]['content']['application/json']`

### Example: Finding Coupon Create Endpoint

For operation `coupons/create`:

- **Path**: `/v1/coupons/`
- **Method**: `POST`
- **Request Body Type**: `operations['coupons/create']['requestBody']['content']['application/json']`
- **Response Type**: `operations['coupons/create']['responses']['201']['content']['application/json']`

---

## Step 3: Create or Identify Resource

### Determine if New Resource is Needed

A **resource** represents a logical grouping of related endpoints (e.g., all customer-related operations).

**Create a new resource if:**

- No existing resource handles this domain (e.g., if adding first page endpoint, create `PageResource`)
- The endpoint represents a new business entity

**Use existing resource if:**

- Endpoint relates to existing resource (e.g., add `customers/update` to existing `CustomerResource`)

### Creating a New Resource

If creating a new resource (e.g., `pages`), create file `api-sdk/js/src/resources/pages/pages.ts`:

```ts
import type { CheckoutPageApiClient } from '../../client';

export class PageResource {
  constructor(private client: CheckoutPageApiClient) {}

  // Methods will be added here in Step 6
}
```

**File naming convention:**

- File: `api-sdk/js/src/resources/{resource-name}/{resource-name}.ts`
- Class: `{ResourceName}Resource` (PascalCase with "Resource" suffix)
- Example: `pages/pages.ts` contains `PageResource`

---

## Step 4: Define Types

Types are defined in `api-sdk/js/src/types.ts` to provide clean, usable interfaces derived from the generated OpenAPI types.

### Response Shape Rule

Every SDK resource method must return the wrapped API response shape from the OpenAPI spec.

- If the API returns `{ data: ... }`, the SDK method must return `{ data: ... }`.
- If the API returns a list envelope like `{ has_more, total, data: [...] }`, the SDK method must return that full envelope.
- Do not unwrap `data` inside resource methods.
- Name exported types to reflect the wrapped payload shape so method signatures stay aligned with the API contract.

### Type Definition Patterns

#### Pattern 1: Simple Response Type

For single-item responses:

```ts
export type Customer = operations['customers/get']['responses'][200]['content']['application/json'];
```

If the API response shape is `{ data: Entity }`, keep that wrapper in the exported type:

```ts
export type EventResponse = operations['events/get']['responses'][200]['content']['application/json'];
export type Event = EventResponse['data'];
```

#### Pattern 2: List Response Type

For list endpoints with pagination:

```ts
export type CustomerList =
  operations['customers/list']['responses'][200]['content']['application/json'];
```

Extract individual item from list:

```ts
export type Customer = CustomerList['data'][number];
```

The resource method should still return `CustomerList`, not `Customer[]`.

#### Pattern 3: Request Body Type

For POST/PUT requests:

```ts
export type CreateCouponParams = NonNullable<
  operations['coupons/create']['requestBody']
>['content']['application/json'];
```

**Why `NonNullable`?** The generated type may be `undefined` if requestBody is optional. `NonNullable` removes `undefined` from the union.

#### Pattern 4: Query Parameters with Type Transformation

OpenAPI generates query parameters as strings. We often want to accept numbers and transform them:

```ts
// Generated type from OpenAPI
export type CustomerListArgs = operations['customers/list']['parameters']['query'];

// Custom type with number for limit (we'll convert to string in implementation)
export type CustomerListParams = Omit<NonNullable<CustomerListArgs>, 'limit'> & {
  limit?: number;
};
```

**Why `Omit`?** Removes `limit: string` from generated type, then adds back as `limit?: number`.

#### Pattern 5: Discriminated Unions

When parameters vary based on a type field, use discriminated unions:

```ts
// Base types with duration variations
type NonRepeatingParams = CouponCreateArgs & {
  duration: 'once' | 'forever';
  durationInMonths?: never; // Explicitly exclude this field
};

type RepeatingParams = CouponCreateArgs & {
  duration: 'repeating';
  durationInMonths: number; // Required when repeating
};

// Type variations based on amount vs percent
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

// Union of all valid combinations
export type CreateCouponParams =
  | AmountNonRepeating
  | AmountRepeating
  | PercentNonRepeating
  | PercentRepeating;
```

**When to use discriminated unions:**

- Parameters have mutually exclusive fields based on a type field
- Different combinations of required/optional fields
- Type safety for conditional logic in implementation

#### Pattern 6: Nested Type Extraction

For extracting nested types:

```ts
export type Address = NonNullable<Customer['data']['address']>;
export type Shipping = NonNullable<Customer['data']['shipping']>;
```

### Complete Type Definition Example

```ts
// In api-sdk/js/src/types.ts

import type { components, operations } from './generated/schema';

// Response types
export type Customer = operations['customers/get']['responses'][200]['content']['application/json'];
export type CustomerList =
  operations['customers/list']['responses'][200]['content']['application/json'];

// Query parameter types with transformations
export type CustomerListArgs = operations['customers/list']['parameters']['query'];
export type CustomerListParams = Omit<NonNullable<CustomerListArgs>, 'limit'> & {
  limit?: number; // Accept number, will convert to string
};

// Nested types
export type Address = NonNullable<Customer['data']['address']>;
export type Shipping = NonNullable<Customer['data']['shipping']>;
```

---

## Step 5: Register Resource in Client

**CRITICAL:** New resources MUST be registered in `api-sdk/js/src/index.ts`.

### Steps:

1. Import the resource class
2. Add public property to `CheckoutPageClient`
3. Instantiate in constructor
4. Export types from the resource

### Example:

```ts
// api-sdk/js/src/index.ts

import { CheckoutPageApiClient, CheckoutPageApiClientOptions } from './client';
import { CustomerResource } from './resources/customers/customers';
import { CouponResource } from './resources/coupons/coupons';
import { PageResource } from './resources/pages/pages'; // 1. Import

export class CheckoutPageClient {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly pages: PageResource; // 2. Add property
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.pages = new PageResource(this.client); // 3. Instantiate
  }
}

export const createCheckoutPageClient = (options: CheckoutPageApiClientOptions) => {
  return new CheckoutPageClient(options);
};

// Export types
export type { CheckoutPageApiClientOptions } from './client';
export type {
  Customer,
  CustomerList,
  CustomerListParams,
  Coupon,
  Page, // 4. Export new types
  CreatePageParams,
} from './types';
```

**Without this step, users cannot access the resource methods.**

---

## Step 6: Implement Method

### Method Implementation Pattern by HTTP Method

#### GET Request with Path Parameter

```ts
async get(customerId: string): Promise<Customer> {
  // 1. Validate required parameters
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  // 2. Make request with path parameter substitution
  return this.client.request<Customer>({
    method: 'GET',
    path: `/v1/customers/${customerId}`,
  });
}
```

**Key points:**

- Path parameters are interpolated into the path string
- Validate required parameters before making request
- Specify return type in generic `request<Type>()`

#### GET Request with Query Parameters

```ts
async list(args: CustomerListParams = {}): Promise<CustomerList> {
  // 1. Build query object with parameter transformations
  const query: Record<string, string | undefined> = {
    search: args.search,
    limit: args.limit?.toString(),  // Convert number to string
    starting_after: args.starting_after,  // Note: snake_case for API
    ending_before: args.ending_before,
  };

  // 2. Make request with query parameters
  return this.client.request<CustomerList>({
    method: 'GET',
    query,
    path: '/v1/customers/',
  });
}
```

**Key points:**

- Query parameters use `Record<string, string | undefined>`
- Convert numbers to strings with `?.toString()`
- Use snake_case for API parameters (e.g., `starting_after`, not `startingAfter`)
- Optional parameters can be `undefined` (filtered out by client)
- Default parameters to empty object `= {}` for optional args

#### POST Request with Simple Body

```ts
async create(params: CreatePageParams): Promise<Page> {
  // 1. Build request body with required fields
  const body: Record<string, unknown> = {
    name: params.name,
    title: params.title,
    type: params.type,
  };

  // 2. Conditionally add optional fields
  if (params.description !== undefined) {
    body.description = params.description;
  }
  if (params.slug !== undefined) {
    body.slug = params.slug;
  }

  // 3. Make POST request
  return this.client.request<Page>({
    method: 'POST',
    path: '/v1/pages/',
    body,
  });
}
```

**Key points:**

- Start with required fields in body
- Conditionally add optional fields with `!== undefined` check
- Use `Record<string, unknown>` for body type
- Body is sent as JSON automatically

#### POST Request with Discriminated Union

For complex types with conditional fields:

```ts
async create(params: CreateCouponParams): Promise<CreateCouponResponse> {
  // 1. Build body with common required fields
  const body: Record<string, unknown> = {
    label: params.label,
    code: params.code,
    duration: params.duration,
  };

  // 2. Handle discriminated union based on duration
  if (params.duration === 'repeating') {
    body.durationInMonths = (params as any).durationInMonths;
  }

  // 3. Add optional fields
  if (params.appliesToSetupFee !== undefined) {
    body.appliesToSetupFee = params.appliesToSetupFee;
  }
  if (params.pageIds !== undefined) {
    body.pageIds = params.pageIds;
  }
  if (params.maxRedemptions !== undefined) {
    body.maxRedemptions = params.maxRedemptions;
  }
  if (params.redeemBy !== undefined) {
    body.redeemBy = params.redeemBy;
  }

  // 4. Handle type-based conditional fields
  if (params.type === 'amount') {
    body.amountOff = params.amountOff;
    body.currency = params.currency;
  } else {
    body.percentOff = params.percentOff;
  }

  // 5. Make request
  return this.client.request<CreateCouponResponse>({
    method: 'POST',
    path: '/v1/coupons/',
    body,
  });
}
```

**Key points:**

- Check discriminator fields (`duration`, `type`) to determine which fields to include
- Use type assertions `(params as any)` when accessing conditional fields
- Order: required → conditional required → optional

#### PUT Request (Update)

```ts
async update(pageId: string, params: UpdatePageParams): Promise<Page> {
  // 1. Validate required path parameters
  if (!pageId) {
    throw new Error('Page ID is required');
  }

  // 2. Build body (usually all fields optional in updates)
  const body: Record<string, unknown> = {};

  if (params.name !== undefined) {
    body.name = params.name;
  }
  if (params.title !== undefined) {
    body.title = params.title;
  }
  if (params.description !== undefined) {
    body.description = params.description;
  }

  // 3. Make PUT request
  return this.client.request<Page>({
    method: 'PUT',
    path: `/v1/pages/${pageId}`,
    body,
  });
}
```

#### DELETE Request

```ts
async delete(pageId: string): Promise<void> {
  if (!pageId) {
    throw new Error('Page ID is required');
  }

  return this.client.request<void>({
    method: 'DELETE',
    path: `/v1/pages/${pageId}`,
  });
}
```

### Parameter Transformation Rules

| Input Type  | API Expects  | Transformation                      |
| ----------- | ------------ | ----------------------------------- |
| `number`    | `string`     | `value?.toString()`                 |
| `camelCase` | `snake_case` | Use `snake_case` in query/body keys |
| `Date`      | `ISO string` | `value?.toISOString()`              |
| `boolean`   | `boolean`    | No transformation                   |
| `undefined` | omit         | Check `!== undefined` before adding |

---

## Step 7: Add Unit Tests

Unit tests mock the client and verify method behavior without making real API calls.

### Test File Location

Create test file alongside resource: `api-sdk/js/src/resources/{resource-name}/{resource-name}.test.ts`

### Unit Test Template

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerResource } from './customers';
import { CheckoutPageApiClient } from '../../client';
import type { Customer, CustomerList } from '../../types';

describe('CustomerResource', () => {
  let client: CheckoutPageApiClient;
  let customerResource: CustomerResource;

  beforeEach(() => {
    // Setup before each test
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    customerResource = new CustomerResource(client);
  });

  describe('get', () => {
    it('should fetch a customer by id', async () => {
      // 1. Create mock response matching API shape
      const mockCustomer: Customer = {
        data: {
          id: '6812fe6e9f39b6760576f01c',
          email: 'test@example.com',
          name: 'Test Customer',
          sellerId: 'seller123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      // 2. Mock client.request method
      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer);

      // 3. Call method
      const result = await customerResource.get('6812fe6e9f39b6760576f01c');

      // 4. Assert response
      expect(result).toEqual(mockCustomer);
      expect(result.data.id).toBe('6812fe6e9f39b6760576f01c');

      // 5. Assert request was called correctly
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/customers/6812fe6e9f39b6760576f01c',
      });
    });

    it('should throw error for missing customer id', async () => {
      // Test validation
      await expect(customerResource.get('')).rejects.toThrow('Customer ID is required');
    });

    it('should return customer with optional fields', async () => {
      // Test with all optional fields populated
      const mockCustomer: Customer = {
        data: {
          id: '6812fe6e9f39b6760576f01c',
          email: 'test@example.com',
          name: 'Test Customer',
          companyName: 'Test Company',
          phone: '+1234567890',
          address: {
            line1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
          },
          sellerId: 'seller123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer);

      const result = await customerResource.get('6812fe6e9f39b6760576f01c');

      expect(result.data.companyName).toBe('Test Company');
      expect(result.data.address?.city).toBe('San Francisco');
    });
  });

  describe('list', () => {
    it('should fetch a list of customers with default parameters', async () => {
      const mockCustomerList: CustomerList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            email: 'customer1@example.com',
            name: 'Customer 1',
            sellerId: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({});

      expect(result).toEqual(mockCustomerList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
        path: '/v1/customers/',
      });
    });

    it('should fetch customers with query parameters', async () => {
      const mockCustomerList: CustomerList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      await customerResource.list({
        search: 'test@example.com',
        limit: 10,
        starting_after: '507f1f77bcf86cd799439011',
      });

      // Verify query parameter transformation
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          limit: '10', // Verify number converted to string
          starting_after: '507f1f77bcf86cd799439011',
          ending_before: undefined,
        },
        path: '/v1/customers/',
      });
    });

    it('should return empty list when no customers exist', async () => {
      const mockCustomerList: CustomerList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({});

      expect(result.data).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a customer with required fields', async () => {
      const createParams = {
        email: 'new@example.com',
        name: 'New Customer',
      };

      const mockResponse = {
        data: {
          id: 'new_id',
          ...createParams,
          sellerId: 'seller123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await customerResource.create(createParams);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/customers/',
        body: {
          email: 'new@example.com',
          name: 'New Customer',
        },
      });
    });

    it('should create customer with optional fields', async () => {
      const createParams = {
        email: 'new@example.com',
        name: 'New Customer',
        phone: '+1234567890',
        companyName: 'Test Co',
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: {} });

      await customerResource.create(createParams);

      // Verify optional fields included in body
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/customers/',
        body: {
          email: 'new@example.com',
          name: 'New Customer',
          phone: '+1234567890',
          companyName: 'Test Co',
        },
      });
    });
  });
});
```

### What to Test

**Required Tests:**

1. ✅ Successful response with required fields only
2. ✅ Successful response with all optional fields
3. ✅ Parameter validation (missing required params)
4. ✅ Query parameter transformation (number to string, camelCase to snake_case)
5. ✅ Conditional body fields (verify included/excluded correctly)
6. ✅ Empty/null responses
7. ✅ Path parameter substitution
8. ✅ Discriminated union handling (if applicable)

**Mock Pattern:**

```ts
vi.spyOn(client, 'request').mockResolvedValue(mockData);
```

**Assertion Pattern:**

```ts
expect(client.request).toHaveBeenCalledWith({
  method: 'GET',
  path: '/expected/path',
  query: {
    /* expected query */
  },
  body: {
    /* expected body */
  },
});
```

---

## Step 8: Add Integration Tests

Shared integration-test helpers live in `api-sdk/js/src/test-helpers/test-lib.ts`.
Use `fakeObjectId` for deterministic invalid Mongo-style IDs and `uniqueSuffix` for unique labels or references instead of redefining those helpers in each test file.

Integration tests make real API calls to verify end-to-end functionality.

### Test File Location

Create integration test file: `api-sdk/js/src/resources/{resource-name}/{resource-name}.integration.test.ts`

### Integration Test Requirements

**Environment Variables:**

- `CHECKOUTPAGE_API_KEY`: Real API key for testing
- Tests are skipped if API key not present

### Integration Test Template

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient } from '../../index';
import type { Customer } from '../../types';

describe('CustomerResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let testCustomerId: string;

  beforeAll(() => {
    const apiKey = process.env.CHECKOUTPAGE_API_KEY;

    if (!apiKey) {
      console.warn('Skipping integration tests: CHECKOUTPAGE_API_KEY not set');
      return;
    }

    client = new CheckoutPageClient({ apiKey });
  });

  it('should create and retrieve a customer', async () => {
    // Create customer
    const createParams = {
      email: `test-${Date.now()}@example.com`,
      name: 'Integration Test Customer',
    };

    const created = await client.customers.create(createParams);
    testCustomerId = created.data.id;

    expect(created.data.email).toBe(createParams.email);
    expect(created.data.name).toBe(createParams.name);

    // Retrieve customer
    const retrieved = await client.customers.get(testCustomerId);

    expect(retrieved.data.id).toBe(testCustomerId);
    expect(retrieved.data.email).toBe(createParams.email);
  });

  it('should list customers with pagination', async () => {
    const result = await client.customers.list({ limit: 5 });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('has_more');
  });

  it('should handle search queries', async () => {
    const result = await client.customers.list({
      search: 'test@example.com',
      limit: 10,
    });

    expect(result.data).toBeDefined();
    // Verify all results match search
    result.data.forEach((customer) => {
      expect(customer.email).toContain('test');
    });
  });
});
```

### When to Prompt for Integration Config Data

Some endpoints require specific configuration data (e.g., `pageIds` for coupons). If the endpoint requires seller-specific IDs:

**Prompt the developer:**

```
This endpoint requires testing with specific resource IDs (e.g., pageIds, productIds).
Please add a configuration section to the integration test that retrieves or creates
these resources before testing, or document the required test setup in a comment.
```

---

## Step 9: Update Documentation

### 9.1 Add Usage Example

Create example file: `api-sdk/examples/js/{resource-name}-{operation}.ts`

**Example:** `api-sdk/examples/js/customer-get.ts`

```ts
import { CheckoutPageClient } from '@checkoutpage/sdk';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // Get a customer by ID
  const customer = await client.customers.get('6812fe6e9f39b6760576f01c');

  console.log('Customer:', customer.data);
  console.log('Email:', customer.data.email);
  console.log('Name:', customer.data.name);
}

main().catch(console.error);
```

**Example:** `api-sdk/examples/js/customer-list.ts`

```ts
import { CheckoutPageClient } from '@checkoutpage/sdk';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // List customers with pagination
  const result = await client.customers.list({
    limit: 10,
    search: 'example@email.com',
  });

  console.log(`Found ${result.total} customers`);
  console.log('Customers:', result.data);

  if (result.has_more) {
    console.log('More results available');
  }
}

main().catch(console.error);
```

### 9.2 Update Examples README

Update `api-sdk/examples/js/README.md` with new example:

```md
## Available Examples

- `customer-get.ts` - Fetch a single customer by ID
- `customer-list.ts` - List customers with pagination and search
- `customer-create.ts` - Create a new customer
- `page-create.ts` - Create a new checkout page <!-- Add this line -->
```

### 9.3 Update SDK README

Update `api-sdk/js/README.md` with usage example in the appropriate section:

```md
### Customers

#### Get a Customer

\`\`\`typescript
const customer = await client.customers.get('customer_id');
console.log(customer.data);
\`\`\`

#### List Customers

\`\`\`typescript
const customers = await client.customers.list({
limit: 10,
search: 'user@example.com',
starting_after: 'last_customer_id',
});
\`\`\`

### Pages <!-- Add new section -->

#### Create a Page

\`\`\`typescript
const page = await client.pages.create({
name: 'My Checkout Page',
title: 'Buy Now',
type: 'checkout',
description: 'Premium product checkout',
});
\`\`\`
```

---

## Complete Example

Let's implement a complete endpoint from start to finish: `pages/create`.

### Step-by-Step Implementation

#### 1. Generate Types

```bash
cd api-sdk/js
pnpm generate:types
```

#### 2. Find in OpenAPI Spec

Look for operation `pages/create` in `api-sdk/spec/openapi.json`:

- **Path**: `/v1/pages/`
- **Method**: `POST`
- **Request Body**: Required fields: `name`, `title`, `type`

#### 3. Create Resource

Since this is the first pages endpoint, create new resource:

**File:** `api-sdk/js/src/resources/pages/pages.ts`

```ts
import type { CheckoutPageApiClient } from '../../client';
import type { Page, CreatePageParams } from '../../types';

export class PageResource {
  constructor(private client: CheckoutPageApiClient) {}

  async create(params: CreatePageParams): Promise<Page> {
    const body: Record<string, unknown> = {
      name: params.name,
      title: params.title,
      type: params.type,
    };

    if (params.description !== undefined) {
      body.description = params.description;
    }
    if (params.slug !== undefined) {
      body.slug = params.slug;
    }
    if (params.layoutType !== undefined) {
      body.layoutType = params.layoutType;
    }

    return this.client.request<Page>({
      method: 'POST',
      path: '/v1/pages/',
      body,
    });
  }
}
```

#### 4. Define Types

**File:** `api-sdk/js/src/types.ts`

```ts
// Add at the end of the file

// Pages
export type Page = operations['pages/create']['responses']['201']['content']['application/json'];

export type CreatePageParams = NonNullable<
  operations['pages/create']['requestBody']
>['content']['application/json'];
```

#### 5. Register in Client

**File:** `api-sdk/js/src/index.ts`

```ts
// Add import
import { PageResource } from './resources/pages/pages';

export class CheckoutPageClient {
  public readonly customers: CustomerResource;
  public readonly coupons: CouponResource;
  public readonly pages: PageResource; // Add property
  private readonly client: CheckoutPageApiClient;

  constructor(options: CheckoutPageApiClientOptions) {
    this.client = new CheckoutPageApiClient(options);
    this.customers = new CustomerResource(this.client);
    this.coupons = new CouponResource(this.client);
    this.pages = new PageResource(this.client); // Instantiate
  }
}

// Add exports
export type {
  Customer,
  Page, // Add export
  CreatePageParams, // Add export
} from './types';
```

#### 6. Add Unit Tests

**File:** `api-sdk/js/src/resources/pages/pages.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageResource } from './pages';
import { CheckoutPageApiClient } from '../../client';
import type { Page, CreatePageParams } from '../../types';

describe('PageResource', () => {
  let client: CheckoutPageApiClient;
  let pageResource: PageResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    pageResource = new PageResource(client);
  });

  describe('create', () => {
    it('should create a page with required fields', async () => {
      const params: CreatePageParams = {
        name: 'Test Page',
        title: 'Buy Now',
        type: 'checkout',
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          name: 'Test Page',
          title: 'Buy Now',
          type: 'checkout',
          status: 'draft',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/',
        body: {
          name: 'Test Page',
          title: 'Buy Now',
          type: 'checkout',
        },
      });
    });

    it('should create a page with optional fields', async () => {
      const params: CreatePageParams = {
        name: 'Test Page',
        title: 'Buy Now',
        type: 'checkout',
        description: 'A test checkout page',
        slug: 'test-page',
        layoutType: 'modern',
      };

      const mockResponse: Page = {
        data: {
          id: 'page_123',
          ...params,
          status: 'draft',
          sellerId: 'seller_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageResource.create(params);

      expect(result.data.description).toBe('A test checkout page');
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/',
        body: {
          name: 'Test Page',
          title: 'Buy Now',
          type: 'checkout',
          description: 'A test checkout page',
          slug: 'test-page',
          layoutType: 'modern',
        },
      });
    });
  });
});
```

#### 7. Add Integration Tests

**File:** `api-sdk/js/src/resources/pages/pages.integration.test.ts`

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient } from '../../index';

describe('PageResource Integration Tests', () => {
  let client: CheckoutPageClient;

  beforeAll(() => {
    const apiKey = process.env.CHECKOUTPAGE_API_KEY;

    if (!apiKey) {
      console.warn('Skipping: CHECKOUTPAGE_API_KEY not set');
      return;
    }

    client = new CheckoutPageClient({ apiKey });
  });

  it('should create a checkout page', async () => {
    if (!client) return;

    const result = await client.pages.create({
      name: `Test Page ${Date.now()}`,
      title: 'Integration Test Page',
      type: 'checkout',
      description: 'Created by integration test',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('Test Page');
    expect(result.data.type).toBe('checkout');
    expect(result.data.id).toBeDefined();
  });
});
```

#### 8. Add Documentation

**File:** `api-sdk/examples/js/page-create.ts`

```ts
import { CheckoutPageClient } from '@checkoutpage/sdk';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // Create a new checkout page
  const page = await client.pages.create({
    name: 'Summer Sale Checkout',
    title: 'Buy Now - 50% Off',
    type: 'checkout',
    description: 'Limited time summer sale',
    slug: 'summer-sale',
    layoutType: 'modern',
  });

  console.log('Created page:', page.data);
  console.log('Page ID:', page.data.id);
  console.log('Page URL:', `https://${page.data.slug}.checkoutpage.com`);
}

main().catch(console.error);
```

**Update:** `api-sdk/examples/js/README.md`

Add to list:

```md
- `page-create.ts` - Create a new checkout page
```

**Update:** `api-sdk/js/README.md`

Add section:

```md
### Pages

#### Create a Page

\`\`\`typescript
const page = await client.pages.create({
name: 'My Checkout Page',
title: 'Buy Now',
type: 'checkout',
description: 'Premium product checkout',
slug: 'my-checkout',
});

console.log('Page created:', page.data.id);
\`\`\`
```

---

## Summary Checklist

When implementing a new endpoint, complete these tasks in order:

- [ ] **Step 1:** Run `pnpm generate:types` to generate latest types
- [ ] **Step 2:** Find endpoint in OpenAPI spec, note path/method/parameters
- [ ] **Step 3:** Create new resource class (if needed) or use existing
- [ ] **Step 4:** Define types in `types.ts` following patterns
- [ ] **Step 5:** Register resource in `index.ts` (import, property, instantiate, export)
- [ ] **Step 6:** Implement method in resource class with proper parameter handling
- [ ] **Step 7:** Add comprehensive unit tests with mocking
- [ ] **Step 8:** Add integration tests with real API calls
- [ ] **Step 9:** Add usage examples and update README files

Following these steps ensures consistent, well-tested, and documented SDK implementations.
