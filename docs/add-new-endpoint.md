# Add a new API endpint

When asked a question like "please create a new endpoint for `pages/create`" follow this document.

## Find the endpoint in openapi spec.

In api-sdk/spec/openapi.json find the requested endpoint and understand the structure.

## Add a new resource, if required

If a new resource is required, create a resource file in api-sdk/js/src/resources based on the new resource name.

Example resource file:

```ts
export class PageResource {
  constructor(private client: CheckoutPageApiClient) {}
}
```

Import this resource file into api-sdk/js/src/index.ts and extend CheckoutPageClient with the added resource.

## Adding a new endpoint

### Create types

In api-sdk/js/src/types.ts create the necessary types for the endpoint.

Example:

```ts
// Pages
export type CreatePageParams = NonNullable<
  operations['pages/create']['requestBody']
>['content']['application/json'];

export type Page = components['schemas']['Page'];
```

### Add method to resource

In the resource file which can be found in api-sdk/js/src/resources add the new method to the resource.

Example:

```ts
  async create(params: CreateCouponParams): Promise<CreateCouponResponse> {
    const body: Record<string, unknown> = {
      label: params.label,
      code: params.code,
      duration: params.duration,
    };

    if (params.duration === 'repeating') {
      body.durationInMonths = (params as any).durationInMonths;
    }

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

    if (params.type === 'amount') {
      body.amountOff = params.amountOff;
      body.currency = params.currency;
    } else {
      body.percentOff = params.percentOff;
    }

    return this.client.request<CreateCouponResponse>({
      method: 'POST',
      path: '/v1/coupons/',
      body,
    });
  }
```

### Add tests for the new method

Add both unit tests like api-sdk/js/src/resources/customers/customers.test.ts and integration tests like api-sdk/js/src/resources/customers/customers.integration.test.ts

#### Prompt for additional integration config data

Some new methods and resources might require additional integration config data like pageIds. Prompt the developer to add these.

## Update documentation

- Add a new example for the method in api-sdk/examples/js
- Update available examples in api-sdk/examples/js/README.md
- Update api-sdk/js/README.md with an example of how to use the new method
