# Contributing to CheckoutPage API SDK

Thank you for your interest in contributing to the CheckoutPage API SDK! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/checkoutpage/checkoutpage-api-sdk.git
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

- Write unit tests for all new functionality
- Tests should be co-located with source files (e.g., `customers.test.ts` next to `customers.ts`)
- Use descriptive test names that explain what is being tested
- Mock external dependencies (HTTP requests, etc.)

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ResourceName', () => {
  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      // Act
      // Assert
    })
  })
})
```

## Adding New Resources

When adding a new API resource:

1. **Create the resource file**
   ```typescript
   // js/src/resources/resource-name/resource-name.ts
   import type { CheckoutPageClient } from '../../client'

   export class ResourceNameResource {
     constructor(private client: CheckoutPageClient) {}

     async get(id: string): Promise<ResourceType> {
       return this.client.request<ResourceType>({
         method: 'GET',
         path: `/v1/resource-name/${id}`,
       })
     }
   }
   ```

2. **Add types to types.ts**
   ```typescript
   export interface ResourceType {
     id: string
     // ... other fields
   }
   ```

3. **Add the resource to the main SDK class**
   ```typescript
   // js/src/index.ts
   import { ResourceNameResource } from './resources/resource-name/resource-name'

   export class CheckoutPage {
     public readonly resourceName: ResourceNameResource

     constructor(options: CheckoutPageClientOptions) {
       this.client = new CheckoutPageClient(options)
       this.resourceName = new ResourceNameResource(this.client)
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
   export type NewResource = operations['resource/get']['responses'][200]['content']['application/json']
   ```

4. **Implement the resource class**
   ```typescript
   // js/src/resources/resource/resource.ts
   import type { NewResource } from '../../types'

   export class ResourceResource {
     async get(id: string): Promise<NewResource> {
       return this.client.request<NewResource>({
         method: 'GET',
         path: `/v1/resource/${id}`,
       })
     }
   }
   ```

5. **Add tests and documentation**

See [TYPE_GENERATION.md](TYPE_GENERATION.md) for detailed information about working with generated types.

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
