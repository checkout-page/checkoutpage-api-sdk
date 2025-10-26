# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains official SDKs for the Checkout Page API, enabling developers to integrate Checkout Page's payment and checkout functionality into their applications. Currently, the JavaScript/TypeScript SDK is actively developed, with Python and Go SDKs planned for the future.

## Repository Structure

This is a monorepo managed with pnpm workspaces:

- **`js/`** - JavaScript/TypeScript SDK with full type definitions and testing infrastructure
- **`spec/`** - OpenAPI specification that defines the API structure
- **`scripts/`** - Utility scripts (type generation, etc.)
- **`examples/`** - Usage examples for SDK integration
- **`.github/`** - CI/CD workflows

### JavaScript SDK Structure

- **`js/src/`** - Source code
  - `client.ts` - HTTP client with error handling
  - `errors.ts` - Error classes for different HTTP status codes
  - `types.ts` - Convenience exports for commonly-used types
  - `index.ts` - Main SDK export with factory function
  - `resources/` - API resource classes (customers, coupons, payments, subscriptions)
  - `generated/` - Auto-generated types from OpenAPI spec
  - `test-helpers/` - Utilities for testing

## Core Architecture

### HTTP Client Pattern

The SDK uses a centralized HTTP client (`CheckoutPageApiClient`) that:
- Handles authentication via Bearer token
- Builds URLs with query parameters
- Manages request/response serialization
- Throws typed error classes based on HTTP status codes

Each resource class (e.g., `CustomerResource`) receives the HTTP client and calls `client.request<T>()` to make API calls.

### Type Generation from OpenAPI Spec

TypeScript types are auto-generated from the OpenAPI specification:
- Run `pnpm generate:types` to regenerate types from `spec/openapi.json`
- Generated types are written to `js/src/generated/schema.ts`
- The script uses `openapi-typescript` CLI to generate types
- Convenience types are re-exported in `js/src/types.ts`

### Resource Implementation Pattern

Each resource follows this pattern:
1. Import the HTTP client type
2. Create a class with methods for API operations
3. Call `this.client.request<ResponseType>()` with method, path, and optional body
4. Include tests alongside the resource file (e.g., `customers.test.ts`)
5. Register the resource in `js/src/index.ts`

Example: `js/src/resources/customers/customers.ts`

### Error Handling

The SDK provides typed error classes:
- `AuthenticationError` - 401, 403 responses
- `NotFoundError` - 404 responses
- `ConflictError` - 409 responses
- `ValidationError` - 400, 422 responses
- `RateLimitError` - 429 responses
- `APIError` - Generic errors with status code and response body

## Development Commands

### Root Level (Monorepo)

```bash
# Install dependencies
pnpm install

# Generate TypeScript types from OpenAPI spec
pnpm generate:types

# Build all SDKs
pnpm build

# Run all tests
pnpm test

# Lint all code
pnpm lint

# Format code
pnpm format
```

### JavaScript SDK Only

```bash
cd js

# Install dependencies (if needed)
pnpm install

# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run integration tests (requires .env.test configuration)
pnpm test:integration

# Run all tests (unit + integration)
pnpm test:all

# Type check without building
pnpm type-check

# Build the SDK (creates dist/)
pnpm build

# Lint code
pnpm lint
```

### Running Single Tests

```bash
# From js directory
pnpm test src/resources/customers/customers.test.ts
```

## Testing Strategy

### Unit Tests

- Located alongside source files (e.g., `customers.test.ts` next to `customers.ts`)
- Use Vitest framework
- Mock HTTP requests using the HTTP client
- Test both success and error scenarios
- Default test command: `pnpm test` (excludes integration tests)

### Integration Tests

- Named with `.integration.test.ts` suffix
- Make real API requests to validate request/response cycles
- Require environment variables: `CHECKOUTPAGE_API_KEY`, `CHECKOUTPAGE_BASE_URL`, `TEST_CUSTOMER_ID`, `TEST_CUSTOMER_EMAIL`
- Can be configured for local development (pointing to `api.checkoutpage.dev`) or production
- Automatically skip if API key is not configured
- Run with: `pnpm test:integration`

### Test Configuration

- Copy `.env.test.example` to `.env.test` in the `js` directory
- Integration tests are optional for contributions
- Unit tests with mocked dependencies are the standard requirement

## Build and Publishing

### Build Process

```bash
# From js directory
pnpm build
```

- Uses `tsup` for bundling
- Creates both CommonJS (`dist/index.js`) and ES modules (`dist/index.mjs`)
- Generates TypeScript declaration files (`dist/index.d.ts`)
- Published to npm as `@checkoutpage/sdk`

### Package Configuration

- **Main entry point**: `js/package.json` with exports for TypeScript types, import, and require
- **Files included**: Only `dist/` directory
- **Minimum Node version**: 18.0.0

## Adding New API Resources

When adding a new API resource:

1. **Update OpenAPI spec** (`spec/openapi.json`) with new endpoint definitions

2. **Generate TypeScript types**
   ```bash
   pnpm generate:types
   ```

3. **Create resource class** in `js/src/resources/{resource-name}/{resource-name}.ts`
   - Implement methods using `this.client.request<ResponseType>()`
   - Follow existing resource patterns

4. **Add convenience types** in `js/src/types.ts` if frequently used

5. **Register in SDK** in `js/src/index.ts`
   - Import the resource class
   - Add public property to `CheckoutPageClient`
   - Instantiate in constructor

6. **Write tests** in `js/src/resources/{resource-name}/{resource-name}.test.ts`
   - Mock the HTTP client
   - Test success and error scenarios

7. **Add integration tests** (optional) in `js/src/resources/{resource-name}/{resource-name}.integration.test.ts`

8. **Update documentation** in `js/README.md` and `examples/js/`

## Code Style and Conventions

- TypeScript for all source code
- Prettier for formatting (run `pnpm format`)
- ESLint for linting (`pnpm lint`)
- JSDoc comments for public APIs
- Descriptive variable and function names
- Small, focused functions

## Key Files and Patterns

- `js/src/client.ts` - HTTP client with error handling logic
- `js/src/errors.ts` - Error class definitions
- `js/src/resources/*/` - Resource implementations
- `js/src/types.ts` - Convenience type exports
- `spec/openapi.json` - Single source of truth for API structure
- `scripts/generate-types.ts` - Type generation script

## Common Development Workflows

### Adding a new endpoint to an existing resource

1. Update `spec/openapi.json`
2. Run `pnpm generate:types`
3. Add method to resource class in `js/src/resources/{resource}/`
4. Write tests alongside the implementation
5. Run `pnpm test` to verify

### Making changes to HTTP client behavior

- Edit `js/src/client.ts`
- Tests are in `js/src/resources/customers/customers.test.ts` (mocks the client)
- Run `pnpm test` to verify all resources still work

### Debugging API integration

1. Check `.env.test` configuration for integration tests
2. Run `pnpm test:integration` to validate real API calls
3. Update `CHECKOUTPAGE_BASE_URL` if testing against different environments

## Monorepo Management

- Uses pnpm workspaces (see `pnpm-workspace.yaml`)
- Root `package.json` contains shared dev dependencies and monorepo scripts
- Each package can have independent dependencies
- Use `pnpm --filter @checkoutpage/sdk <command>` to run commands in specific workspace

