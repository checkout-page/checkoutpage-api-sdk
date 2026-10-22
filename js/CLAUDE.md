# CLAUDE.md - JavaScript SDK

Conventions for `js/`, the JavaScript/TypeScript SDK published to npm as `@checkoutpage/sdk`.
Repo-wide rules (the shared spec, adding a language, cross-cutting rules) are in the root
[CLAUDE.md](../CLAUDE.md). Paths below are relative to `js/` unless they start with `../`.

## Structure

- **`src/`** - Source code
  - `client.ts` - HTTP client with error handling
  - `errors.ts` - Error classes for different HTTP status codes
  - `types.ts` - Convenience exports for commonly-used types
  - `index.ts` - Main SDK export with factory function
  - `resources/` - API resource classes (customers, coupons, payments, subscriptions, ...)
  - `generated/` - Auto-generated types from the OpenAPI spec (gitignored)
  - `test-helpers/` - Utilities for testing
- **`test/`** - Extra test suites
- **`../examples/js/`** - Usage examples

## Core architecture

### HTTP client pattern

The SDK uses a centralized HTTP client (`CheckoutPageApiClient`) that:

- Handles authentication via Bearer token
- Builds URLs with query parameters
- Manages request/response serialization
- Throws typed error classes based on HTTP status codes

Each resource class (e.g., `CustomerResource`) receives the HTTP client and calls `client.request<T>()` to make API calls.

### Type generation from the OpenAPI spec

TypeScript types are auto-generated from the shared OpenAPI specification:

- Run `pnpm generate:types` from the repo root to regenerate types from `../spec/openapi.json`
- Generated types are written to `src/generated/schema.ts`
- The script (`../scripts/generate-types.ts`) normalizes the spec, then runs the `openapi-typescript` CLI
- Convenience types are re-exported in `src/types.ts`

### Resource implementation pattern

Each resource follows this pattern:

1. Import the HTTP client type
2. Create a class with methods for API operations
3. Call `this.client.request<ResponseType>()` with method, path, and optional body
4. Include tests alongside the resource file (e.g., `customers.test.ts`)
5. Register the resource in `src/index.ts`

Example: `src/resources/customers/customers.ts`

### Error handling

The SDK provides typed error classes:

- `AuthenticationError` - 401, 403 responses
- `NotFoundError` - 404 responses
- `ConflictError` - 409 responses
- `ValidationError` - 400, 422 responses
- `RateLimitError` - 429 responses
- `APIError` - Generic errors with status code and response body

## Development commands

### From the repo root

```bash
# Install dependencies
pnpm install

# Generate TypeScript types from the OpenAPI spec
pnpm generate:types

# Build, test and lint every workspace package
pnpm build
pnpm test
pnpm lint

# Format code
pnpm format

# Run one command in this package only
pnpm --filter @checkoutpage/sdk <command>
```

### From `js/`

```bash
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

### Running single tests

```bash
# From js/
pnpm test src/resources/customers/customers.test.ts
```

## Testing strategy

### Unit tests

- Located alongside source files (e.g., `customers.test.ts` next to `customers.ts`)
- Use Vitest framework
- Mock HTTP requests using the HTTP client
- Test both success and error scenarios
- Default test command: `pnpm test` (excludes integration tests)

### Integration tests

- Named with `.integration.test.ts` suffix
- Make real API requests to validate request/response cycles
- Require environment variables: `CHECKOUTPAGE_API_KEY`, `CHECKOUTPAGE_BASE_URL`, `TEST_CUSTOMER_ID`, `TEST_CUSTOMER_EMAIL`
- Can be configured for local development (pointing to `api.checkoutpage.dev`) or production
- Automatically skip if API key is not configured
- Run with: `pnpm test:integration`

### Test configuration

- Copy `.env.test.example` to `.env.test` in `js/`
- Integration tests are optional for contributions
- Unit tests with mocked dependencies are the standard requirement

## Build and publishing

### Build process

```bash
# From js/
pnpm build
```

- Uses `tsup` for bundling
- Creates both CommonJS (`dist/index.js`) and ES modules (`dist/index.mjs`)
- Generates TypeScript declaration files (`dist/index.d.ts`)
- Published to npm as `@checkoutpage/sdk` by `../.github/workflows/publish-js.yml` (manual dispatch, tags `js-v<version>`)
- CI runs `../.github/workflows/test-js.yml` on changes to `js/**` or `spec/**`

### Package configuration

- **Main entry point**: `package.json` with exports for TypeScript types, import, and require
- **Files included**: Only `dist/` directory
- **Minimum Node version**: 18.0.0
- `repository.directory` is `js`, so this directory must not move

## Adding new API resources

When adding a new API resource:

1. **Update the OpenAPI spec** (`../spec/openapi.json`) with new endpoint definitions (see [../spec/README.md](../spec/README.md))

2. **Generate TypeScript types**

   ```bash
   pnpm generate:types
   ```

3. **Create resource class** in `src/resources/{resource-name}/{resource-name}.ts`

   - Implement methods using `this.client.request<ResponseType>()`
   - Follow existing resource patterns

4. **Add convenience types** in `src/types.ts` if frequently used

5. **Register in SDK** in `src/index.ts`

   - Import the resource class
   - Add public property to `CheckoutPageClient`
   - Instantiate in constructor

6. **Write tests** in `src/resources/{resource-name}/{resource-name}.test.ts`

   - Mock the HTTP client
   - Test success and error scenarios

7. **Add integration tests** (optional) in `src/resources/{resource-name}/{resource-name}.integration.test.ts`

8. **Update documentation** in `README.md` and `../examples/js/`

## Code style and conventions

- TypeScript for all source code
- Prettier for formatting (run `pnpm format` from the root)
- ESLint for linting (`pnpm lint`; config in `../eslint.config.mjs`)
- JSDoc comments for public APIs
- Descriptive variable and function names
- Small, focused functions

## Key files and patterns

- `src/client.ts` - HTTP client with error handling logic
- `src/errors.ts` - Error class definitions
- `src/resources/*/` - Resource implementations
- `src/types.ts` - Convenience type exports
- `../spec/openapi.json` - Single source of truth for API structure
- `../scripts/generate-types.ts` - Type generation script

## Common development workflows

### Adding a new endpoint to an existing resource

1. Update `../spec/openapi.json`
2. Run `pnpm generate:types`
3. Add method to resource class in `src/resources/{resource}/`
4. Write tests alongside the implementation
5. Run `pnpm test` to verify

### Making changes to HTTP client behavior

- Edit `src/client.ts`
- Tests are in `src/resources/customers/customers.test.ts` (mocks the client)
- Run `pnpm test` to verify all resources still work

### Debugging API integration

1. Check `.env.test` configuration for integration tests
2. Run `pnpm test:integration` to validate real API calls
3. Update `CHECKOUTPAGE_BASE_URL` if testing against different environments

## Workspace

- `js/` is the only pnpm workspace package today (see `../pnpm-workspace.yaml`)
- The root `package.json` holds shared dev dependencies (TypeScript, ESLint, Prettier, `openapi-typescript`, `tsx`) and the repo-wide scripts
- This package can have its own dependencies in `package.json`
- Use `pnpm --filter @checkoutpage/sdk <command>` to run commands in this package from the root
