# Checkout Page API SDK

Official SDKs for the Checkout Page API, enabling developers to integrate Checkout Page's payment and checkout functionality into their applications.

## Available SDKs

### JavaScript/TypeScript ✅

The official JavaScript SDK with full TypeScript support.

- **Package**: `@checkoutpage/sdk`
- **Installation**: `npm install @checkoutpage/sdk`
- **Documentation**: [js/README.md](js/README.md)
- **Status**: Active development

```typescript
import { CheckoutPage } from '@checkoutpage/sdk';

const checkoutpage = new CheckoutPage({ apiKey: 'YOUR_API_KEY' });
const customer = await checkoutpage.customers.get('customer_id');
```

### Python (Coming Soon)

Python SDK planned for future release.

### Go (Coming Soon)

Go SDK planned for future release.

## Quick Start

1. **Get your API key** from the [Checkout Page Dashboard](https://checkoutpage.com/)

2. **Install the SDK** for your language:

   ```bash
   npm install @checkoutpage/sdk
   ```

3. **Start using the SDK**:

   ```typescript
   import { CheckoutPage } from '@checkoutpage/sdk';

   const checkoutpage = new CheckoutPage({
     apiKey: process.env.CHECKOUTPAGE_API_KEY,
   });
   ```

## Repository Structure

```
checkoutpage-api-sdk/
├─ js/                      # JavaScript/TypeScript SDK
│  ├─ src/                  # Source code
│  ├─ package.json
│  └─ README.md
├─ spec/                    # OpenAPI specification
│  └─ openapi.json
├─ examples/                # Usage examples
│  └─ js/
├─ .github/
│  └─ workflows/            # CI/CD workflows
└─ README.md
```

## API Reference

For detailed API documentation, visit [docs.checkoutpage.com](https://docs.checkoutpage.com).

The SDKs are generated from our OpenAPI specification located in `spec/openapi.json`.

## Examples

Check out the [examples](examples/) directory for language-specific examples:

- [JavaScript Examples](examples/js/)

## Development

This is a monorepo managed with pnpm workspaces.

### Setup

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install

# Generate TypeScript types from OpenAPI spec
pnpm generate:types

# Build all SDKs
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Working on the JS SDK

```bash
cd js

# Install dependencies
pnpm install

# Run tests in watch mode
pnpm test:watch

# Build the SDK
pnpm build

# Type check
pnpm type-check
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- **Documentation**: https://docs.checkoutpage.com
- **GitHub Issues**: https://github.com/checkout-page/checkoutpage-api-sdk/issues
- **Email**: support@checkoutpage.com

## License

MIT License - see [LICENSE](LICENSE) for details.
