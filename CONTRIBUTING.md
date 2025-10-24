# Contributing to Checkout Page API SDK

Thank you for your interest in contributing to the Checkout Page API SDK! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/checkout-page/checkoutpage-api-sdk.git
   cd checkoutpage-api-sdk
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Generate TypeScript types from OpenAPI spec**

   ```bash
   pnpm generate:types
   ```

4. **Build the SDK**

   ```bash
   pnpm build
   ```

5. **Run tests**
   ```bash
   pnpm test
   ```

## Project Structure

This is a monorepo containing SDKs for multiple languages:

```
checkoutpage-api-sdk/
├─ js/                  # JavaScript/TypeScript SDK
│  ├─ src/
│  │  ├─ client.ts      # HTTP client
│  │  ├─ errors.ts      # Error classes
│  │  ├─ types.ts       # TypeScript types
│  │  ├─ resources/     # API resource classes
│  │  └─ index.ts       # Main export
│  └─ package.json
├─ spec/                # OpenAPI specification
└─ examples/            # Usage examples
```

## Development Workflow

### Working on the JavaScript SDK

```bash
cd js

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm type-check

# Lint code
pnpm lint

# Build
pnpm build
```

### Making Changes

1. **Create a new branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write code following the existing patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Run tests and linting**

   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting (enforced by Prettier)
- Write meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing Guidelines

We have two types of tests in this project:

### Unit Tests

- Write unit tests for all new functionality
- Tests should be co-located with source files (e.g., `customers.test.ts` next to `customers.ts`)
- Use descriptive test names that explain what is being tested
- Mock external dependencies (HTTP requests, etc.)
- Run with: `pnpm test` or `pnpm test:unit`

#### Unit Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ResourceName', () => {
  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Integration Tests

Integration tests make real API requests to validate the full request/response cycle. These tests are optional and require proper credentials.

#### Setup for Checkout Page Developers (Local API)

1. **Copy the environment template**

   ```bash
   cd js
   cp .env.test.example .env.test
   ```

2. **Configure for local development**

   Edit `.env.test`:

   ```bash
   CHECKOUTPAGE_API_KEY=your_local_api_key
   CHECKOUTPAGE_BASE_URL=https://api.checkoutpage.dev
   TEST_CUSTOMER_ID=6812fe6e9f39b6760576f01c
   TEST_CUSTOMER_EMAIL=test@example.com
   ```

3. **Run integration tests**

   ```bash
   pnpm test:integration
   ```

#### Setup for External Contributors (Production API)

1. **Copy the environment template**

   ```bash
   cd js
   cp .env.test.example .env.test
   ```

2. **Configure for production**

   Edit `.env.test`:

   ```bash
   CHECKOUTPAGE_API_KEY=your_production_api_key
   CHECKOUTPAGE_BASE_URL=https://api.checkoutpage.com
   TEST_CUSTOMER_ID=<your_customer_id>
   TEST_CUSTOMER_EMAIL=<your_customer_email>
   ```

3. **Run integration tests**

   ```bash
   pnpm test:integration
   ```

#### Integration Test Guidelines

- Integration tests are named with `.integration.test.ts` suffix
- Tests automatically skip if no API key is configured
- Use existing customer data (specified in `.env.test`)
- Validate response structure matches TypeScript types
- Test both success and error scenarios

#### Test Commands

```bash
# Run only unit tests (default)
pnpm test

# Run only integration tests
pnpm test:integration

# Run all tests (unit + integration)
pnpm test:all

# Watch mode (unit tests only)
pnpm test:watch
```

**Note**: Integration tests are not required for pull requests. Unit tests with mocked dependencies are sufficient for most contributions.

## Adding New Resources

When adding a new API resource:

1. **Create the resource file**

   ```typescript
   // js/src/resources/resource-name/resource-name.ts
   import type { CheckoutPageApiClient } from '../../client';

   export class ResourceNameResource {
     constructor(private client: CheckoutPageApiClient) {}

     async get(id: string): Promise<ResourceType> {
       return this.client.request<ResourceType>({
         method: 'GET',
         path: `/v1/resource-name/${id}`,
       });
     }
   }
   ```

2. **Add types to types.ts**

   ```typescript
   export interface ResourceType {
     id: string;
     // ... other fields
   }
   ```

3. **Add the resource to the main SDK class**

   ```typescript
   // js/src/index.ts
   import { ResourceNameResource } from './resources/resource-name/resource-name';

   export class CheckoutPageClient {
     public readonly resourceName: ResourceNameResource;

     constructor(options: CheckoutPageApiClientOptions) {
       this.client = new CheckoutPageApiClient(options);
       this.resourceName = new ResourceNameResource(this.client);
     }
   }
   ```

4. **Write tests**

   ```typescript
   // js/src/resources/resource-name/resource-name.test.ts
   ```

5. **Update documentation**
   - Add usage examples to the JS SDK README
   - Create example files in `examples/js/`

## OpenAPI Specification & Type Generation

The API structure is defined in `spec/openapi.json`. TypeScript types are automatically generated from this spec.

### When adding new endpoints:

1. **Update the OpenAPI spec**

   ```bash
   # Edit spec/openapi.json
   ```

2. **Generate TypeScript types**

   ```bash
   pnpm generate:types
   ```

3. **Export convenience types** (optional)

   ```typescript
   // js/src/types.ts
   export type NewResource =
     operations['resource/get']['responses'][200]['content']['application/json'];
   ```

4. **Implement the resource class**

   ```typescript
   // js/src/resources/resource/resource.ts
   import type { NewResource } from '../../types';

   export class ResourceResource {
     async get(id: string): Promise<NewResource> {
       return this.client.request<NewResource>({
         method: 'GET',
         path: `/v1/resource/${id}`,
       });
     }
   }
   ```

5. **Add tests and documentation**

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add a clear description of changes in the PR
4. Reference any related issues
5. Wait for review from maintainers

## Questions or Issues?

- Check existing GitHub issues
- Create a new issue for bugs or feature requests
- Join our community discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
