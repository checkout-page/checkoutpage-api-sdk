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

### Customers

- `get-customer.ts` - Retrieve a customer by ID
- `get-customers.ts` - List all customers

### Coupons

- `get-coupons.ts` - List all coupons
- `create-coupon.ts` - Create a coupon

### Payments & Subscriptions

- `get-payments.ts` - List all payments
- `get-subscriptions.ts` - List all subscriptions

### Pages

- `get-pages.ts` - List all pages
- `create-page.ts` - Create a checkout page
- `create-event-page.ts` - Create an event page with ticket groups
- `add-page-field.ts` - Add a custom field to a page

### Products

- `update-product.ts` - Update product details

### Files

- `files-upload.ts` - Upload images and files for products

### Bookings

- `get-bookings.ts` - List all bookings

### Webhooks

- `webhooks.ts` - Create, list, and delete webhook endpoints

## Getting Your API Key

1. Log in to your Checkout Page dashboard at https://checkoutpage.com
2. Navigate to Settings > API Keys
3. Create a new API key or copy an existing one
