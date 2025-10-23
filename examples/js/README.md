# JavaScript SDK Examples

This directory contains example code demonstrating how to use the Checkout Page JavaScript SDK.

## Prerequisites

1. Install the SDK:

```bash
npm install @checkoutpage/sdk
# or
pnpm add @checkoutpage/sdk
```

2. Set your API key:

```bash
export CHECKOUTPAGE_API_KEY="your_api_key_here"
```

## Running Examples

Using tsx (recommended for TypeScript):

```bash
npx tsx get-customer.ts
```

Using ts-node:

```bash
npx ts-node get-customer.ts
```

## Available Examples

- `get-customer.ts` - Retrieve a customer by ID
- `get-customers.ts` - List all customers
- `get-coupons.ts` - List all coupons
- `create-coupon.ts` - Create a coupon
- `get-payments.ts` - List all payments

## Getting Your API Key

1. Log in to your Checkout Page dashboard at https://checkoutpage.com
2. Navigate to Settings > API Keys
3. Create a new API key or copy an existing one
