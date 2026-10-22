# Checkout Page developer tools

Official developer tools for the Checkout Page API: client libraries and command-line tools
for building on Checkout Page from your own code.

Each language or tool lives in its own top-level directory. They are all built from the same
OpenAPI spec, so they cover the same API.

## Tools

| Tool                      | Status      | Install                                                   | Docs                           |
| ------------------------- | ----------- | --------------------------------------------------------- | ------------------------------ |
| JavaScript/TypeScript SDK | Active      | `npm install @checkoutpage/sdk`                           | [js/README.md](js/README.md)   |
| n8n nodes                 | Coming soon | n8n Settings > Community nodes > `n8n-nodes-checkoutpage` | [n8n/README.md](n8n/README.md) |
| CLI                       | Coming soon | -                                                         | `cli/`                         |
| PHP                       | Planned     | -                                                         | -                              |
| Ruby                      | Planned     | -                                                         | -                              |
| Python                    | Planned     | -                                                         | -                              |
| Go                        | Planned     | -                                                         | -                              |

## JavaScript/TypeScript SDK

The JavaScript SDK has full TypeScript support and runs on Node.js 18 or later.

1. Get your API key from the [Checkout Page dashboard](https://checkoutpage.com/).

2. Install the SDK:

   ```bash
   npm install @checkoutpage/sdk
   ```

3. Create a client and make a request:

   ```typescript
   import { createCheckoutPageClient } from '@checkoutpage/sdk';

   const checkoutpage = createCheckoutPageClient({ apiKey: 'YOUR_API_KEY' });
   const customer = await checkoutpage.customers.get('customer_id');
   ```

More in the [JS SDK README](js/README.md) and the [JavaScript examples](examples/js/).

## n8n nodes

Automate Checkout Page in [n8n](https://n8n.io) without writing code. Start a workflow when
someone books or pays, add attendees, create coupons and look up customers.

In n8n, open **Settings > Community nodes**, select **Install** and enter
`n8n-nodes-checkoutpage`. See the [n8n README](n8n/README.md) and the
[n8n examples](examples/n8n/).

## The API spec

[`spec/openapi.json`](spec/openapi.json) is the OpenAPI spec for the Checkout Page seller API.
It is the single source for every tool in this repo: each language generates its types or
client code from it. See [spec/README.md](spec/README.md) for where it comes from and how it is
refreshed.

For the full API reference, visit [docs.checkoutpage.com](https://docs.checkoutpage.com).

## Repository layout

```
checkoutpage-api-sdk/
├─ js/                  # JavaScript/TypeScript SDK (@checkoutpage/sdk)
├─ n8n/                 # n8n community nodes (n8n-nodes-checkoutpage)
├─ cli/                 # Checkout Page CLI (coming soon)
├─ spec/
│  └─ openapi.json      # Shared OpenAPI spec
├─ examples/
│  ├─ js/               # Examples, one directory per language or tool
│  └─ n8n/
├─ scripts/             # Shared tooling, such as type generation
└─ .github/workflows/   # Test and publish workflows, one pair per language
```

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the development
flow and how to add a new language.

## Support

- **Documentation**: https://docs.checkoutpage.com
- **GitHub issues**: https://github.com/checkout-page/checkoutpage-api-sdk/issues
- **Email**: support@checkoutpage.com

## License

MIT License.
