# Contributing to Checkout Page developer tools

Thank you for your interest in contributing. This document covers the general flow for every
tool in this repo, then the setup for each language.

## How the repo is organized

Each language or tool has its own top-level directory (`js/` today, more to come). All of them
are built from the shared OpenAPI spec in `spec/openapi.json`. Examples live in
`examples/<lang>/`, and shared tooling in `scripts/`. See the [README](README.md) for the full
layout.

## General flow

1. **Clone the repository**

   ```bash
   git clone https://github.com/checkout-page/checkoutpage-api-sdk.git
   cd checkoutpage-api-sdk
   ```

2. **Create a new branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**

   - Work inside the directory for the language you are changing
   - Write code following the existing patterns
   - Add tests for new functionality
   - Update documentation and examples as needed

4. **Run that language's tests and linting** (see the language sections below)

5. **Commit your changes**

   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

6. **Push and create a pull request**

   ```bash
   git push origin feature/your-feature-name
   ```

### Changing the API spec

`spec/openapi.json` comes from the Checkout Page API. Spec changes must match what the API
serves, so they are usually made by the Checkout Page team. See [spec/README.md](spec/README.md)
for how a refresh is done. A spec change is regenerated and tested in every language it affects.

## JavaScript/TypeScript SDK

The JS SDK lives in `js/` and is published to npm as `@checkoutpage/sdk`.

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Getting started

1. **Install dependencies** (from the repo root)

   ```bash
   pnpm install
   ```

2. **Generate TypeScript types from the OpenAPI spec**

   ```bash
   pnpm generate:types
   ```

3. **Build the SDK**

   ```bash
   pnpm build
   ```

4. **Run tests**

   ```bash
   pnpm test
   ```

### Project structure

```
js/
├─ src/
│  ├─ client.ts      # HTTP client
│  ├─ errors.ts      # Error classes
│  ├─ types.ts       # TypeScript types
│  ├─ resources/     # API resource classes
│  └─ index.ts       # Main export
└─ package.json
```

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

Before opening a pull request, run:

```bash
pnpm test
pnpm lint
pnpm type-check
```

### Code style

- Use TypeScript for all new code
- Follow existing code formatting (enforced by Prettier)
- Write meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing guidelines

We have two types of tests in the JS SDK.

#### Unit tests

- Write unit tests for all new functionality
- Tests should be co-located with source files (e.g., `customers.test.ts` next to `customers.ts`)
- Use descriptive test names that explain what is being tested
- Mock external dependencies (HTTP requests, etc.)
- Run with: `pnpm test` or `pnpm test:unit`

Unit test structure:

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

#### Integration tests

Integration tests make real API requests to validate the full request/response cycle. These
tests are optional and require proper credentials.

Setup for Checkout Page developers (local API):

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

Setup for external contributors (production API):

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

Integration test guidelines:

- Integration tests are named with `.integration.test.ts` suffix
- Tests automatically skip if no API key is configured
- Use existing customer data (specified in `.env.test`)
- Validate response structure matches TypeScript types
- Test both success and error scenarios

#### Test commands

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

**Note**: Integration tests are not required for pull requests. Unit tests with mocked
dependencies are sufficient for most contributions.

### Adding new resources

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

### OpenAPI spec and type generation

TypeScript types are generated from `spec/openapi.json`.

When adding new endpoints:

1. **Refresh the OpenAPI spec** from the API, as [spec/README.md](spec/README.md) describes. Don't
   hand-write an endpoint the API doesn't serve.

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

## Adding a language

New languages and tools each get their own top-level directory, README, examples and CI
workflows. The checklist is in [CLAUDE.md](CLAUDE.md#adding-a-new-language-or-tool). Open an
issue first so we can agree on the package name and layout.

## Pull request process

1. Ensure all tests pass
2. Update documentation if needed
3. Add a clear description of changes in the PR
4. Reference any related issues
5. Wait for review from maintainers

## Questions or issues?

- Check existing GitHub issues
- Create a new issue for bugs or feature requests
- Join our community discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
