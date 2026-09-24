import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, ValidationError, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

// Needs order bumps enabled for the API key's store.
describe('Order bumps integration tests', () => {
  let client: CheckoutPageClient;
  let pageId: string;
  const productIds: string[] = [];

  const createBumpProduct = async (title: string) => {
    const result = await client.products.create({
      role: 'orderbump',
      title,
      price: { amount: 500, currency: 'usd' },
      hasUnlimitedStock: true,
      headingText: 'Special one time offer',
    });
    productIds.push(result.data.id);
    return result.data;
  };

  beforeAll(async () => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    const page = await client.checkoutPages.create({
      name: `SDK Order Bumps Host ${uniqueSuffix()}`,
      productData: { title: 'SDK Order Bumps Product', price: { amount: 4900, currency: 'usd' } },
    });
    pageId = page.data.id;
  });

  afterAll(async () => {
    if (pageId) await client.checkoutPages.delete(pageId).catch(() => undefined);
    for (const productId of productIds) {
      await client.products.delete(productId, { fromAllPages: true }).catch(() => undefined);
    }
  });

  it('creates an order bump product and finds it by role', async () => {
    const title = `SDK Bump ${uniqueSuffix()}`;
    const product = await createBumpProduct(title);

    expect(product.role).toBe('orderbump');
    expect(product.headingText).toBe('Special one time offer');

    const listed = await client.products.list({ role: 'orderbump', search: title });
    expect(listed.data.map((entry) => entry.id)).toEqual([product.id]);
  });

  it('places, configures, reorders and removes order bumps on a checkout page', async () => {
    const first = await createBumpProduct(`SDK Bump First ${uniqueSuffix()}`);
    const second = await createBumpProduct(`SDK Bump Second ${uniqueSuffix()}`);

    const attached = await client.checkoutPages.orderBumps.create(pageId, {
      productId: first.id,
      preselected: true,
    });
    expect(attached.data).toMatchObject({ productId: first.id, preselected: true, enabled: true });
    await client.checkoutPages.orderBumps.create(pageId, { productId: second.id });

    const updated = await client.checkoutPages.orderBumps.update(pageId, second.id, {
      hidden: true,
    });
    expect(updated.data.hidden).toBe(true);

    const reordered = await client.checkoutPages.orderBumps.reorder(pageId, {
      productIds: [second.id, first.id],
    });
    expect(reordered.data.map((bump) => bump.productId)).toEqual([second.id, first.id]);

    await client.checkoutPages.orderBumps.delete(pageId, second.id);
    const listed = await client.checkoutPages.orderBumps.list(pageId);
    expect(listed.data.map((bump) => bump.productId)).toEqual([first.id]);
  });

  it('refuses a page product as an order bump', async () => {
    const page = await client.checkoutPages.get(pageId);
    const pageProductId = page.data.product?.id as string;

    await expect(
      client.checkoutPages.orderBumps.create(pageId, { productId: pageProductId })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
