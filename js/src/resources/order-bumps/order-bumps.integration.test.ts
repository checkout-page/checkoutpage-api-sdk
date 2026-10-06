import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

// Needs order bumps enabled for the API key's store.
describe('Order bumps integration tests', () => {
  let client: CheckoutPageClient;
  let pageId: string;
  let eventId: string | undefined;
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
      name: `sdk-it-order-bumps-host ${uniqueSuffix()}`,
      productData: {
        title: 'sdk-it-order-bumps-product',
        price: { amount: 4900, currency: 'usd' },
      },
    });
    pageId = page.data.id;
  });

  afterAll(async () => {
    if (pageId) await client.checkoutPages.delete(pageId).catch(() => undefined);
    if (eventId) await client.events.delete(eventId).catch(() => undefined);
    for (const productId of productIds) {
      await client.products.delete(productId, { fromAllPages: true }).catch(() => undefined);
    }
  });

  it('creates an order bump product and finds it by role', async () => {
    const title = `sdk-it-bump ${uniqueSuffix()}`;
    const product = await createBumpProduct(title);

    expect(product.role).toBe('orderbump');
    expect(product.headingText).toBe('Special one time offer');

    const listed = await client.products.list({ role: 'orderbump', search: title });
    expect(listed.data.map((entry) => entry.id)).toEqual([product.id]);
  });

  it('places, configures, reorders and removes order bumps on a checkout page', async () => {
    const first = await createBumpProduct(`sdk-it-bump-first ${uniqueSuffix()}`);
    const second = await createBumpProduct(`sdk-it-bump-second ${uniqueSuffix()}`);

    const attached = await client.checkoutPages.orderBumps.create(pageId, {
      productId: first.id,
      preselected: true,
    });
    expect(attached.data).toMatchObject({ productId: first.id, preselected: true, enabled: true });
    await client.checkoutPages.orderBumps.create(pageId, { productId: second.id });

    const updated = await client.checkoutPages.orderBumps.update(pageId, second.id, {
      hidden: true,
      allowQuantity: true,
      shortenDescription: true,
      showHideLogic: { enabled: true, subject: 'order_bump', orderBumpProductIds: [first.id] },
    });
    expect(updated.data).toMatchObject({
      productId: second.id,
      hidden: true,
      allowQuantity: true,
      shortenDescription: true,
      showHideLogic: { enabled: true, subject: 'order_bump', orderBumpProductIds: [first.id] },
    });

    const reordered = await client.checkoutPages.orderBumps.reorder(pageId, {
      productIds: [second.id, first.id],
    });
    expect(reordered.data.map((bump) => bump.productId)).toEqual([second.id, first.id]);

    await client.checkoutPages.orderBumps.delete(pageId, second.id);
    const listed = await client.checkoutPages.orderBumps.list(pageId);
    expect(listed.data.map((bump) => bump.productId)).toEqual([first.id]);
    expect(listed.data[0]).toMatchObject({ preselected: true, hidden: false });
  });

  it('refuses a page product as an order bump', async () => {
    const page = await client.checkoutPages.get(pageId);
    const pageProductId = page.data.product?.id as string;

    await expect(
      client.checkoutPages.orderBumps.create(pageId, { productId: pageProductId })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('deletes a product still offered on a page only with fromAllPages', async () => {
    const product = await createBumpProduct(`sdk-it-bump-offered ${uniqueSuffix()}`);
    await client.checkoutPages.orderBumps.create(pageId, { productId: product.id });

    await expect(client.products.delete(product.id)).rejects.toBeInstanceOf(ValidationError);

    const deleted = await client.products.delete(product.id, { fromAllPages: true });
    expect(deleted.data.success).toBe(true);

    const listed = await client.checkoutPages.orderBumps.list(pageId);
    expect(listed.data.map((bump) => bump.productId)).not.toContain(product.id);
    await expect(client.products.get(product.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('offers an order bump on an event', async () => {
    const event = await client.events.create({
      name: `sdk-it-order-bumps-event ${uniqueSuffix()}`,
      title: 'sdk-it-order-bumps-event',
      eventDetails: {
        type: 'in_person',
        currency: 'usd',
        startDate: '2026-12-01T09:00:00Z',
        endDate: '2026-12-01T17:00:00Z',
        timezone: 'UTC',
        location: 'SDK Event Venue',
      },
    });
    eventId = event.data.id;
    const product = await createBumpProduct(`sdk-it-bump-event ${uniqueSuffix()}`);

    const attached = await client.events.orderBumps.create(eventId, { productId: product.id });
    expect(attached.data).toMatchObject({ productId: product.id, enabled: true });

    const updated = await client.events.orderBumps.update(eventId, product.id, {
      preselected: true,
    });
    expect(updated.data.preselected).toBe(true);

    const listed = await client.events.orderBumps.list(eventId);
    expect(listed.data.map((bump) => bump.productId)).toEqual([product.id]);

    await client.events.orderBumps.delete(eventId, product.id);
    const afterDelete = await client.events.orderBumps.list(eventId);
    expect(afterDelete.data).toEqual([]);
  });
});
