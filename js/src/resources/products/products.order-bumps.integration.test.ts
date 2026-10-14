import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  NotFoundError,
  ValidationError,
} from '../../index';
import type { CreateProductParams } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';
import { withStatus } from '../../test-helpers/http-status';

// Cleanup walks every page and product the suite made, one request at a time.
const CLEANUP_TIMEOUT_MS = 180_000;

describe('ProductResource order bump products (integration)', () => {
  let client: CheckoutPageClient;
  const createdProductIds: string[] = [];
  const createdPageIds: string[] = [];

  const bumpTitle = (label: string) => `SDK IT Bump ${label} ${uniqueSuffix()}`;

  const createBump = async (params: Partial<CreateProductParams> = {}) => {
    const { data } = await client.products.create({
      role: 'orderbump',
      title: bumpTitle('product'),
      price: { amount: 1500, currency: 'usd' },
      ...params,
    });
    if (!data) throw new Error('Order bump product was not returned');
    createdProductIds.push(data.id);
    return data;
  };

  const createPage = async () => {
    const { data } = await client.checkoutPages.create({
      name: bumpTitle('page'),
      productData: { price: { amount: 4900, currency: 'usd' } },
    });
    createdPageIds.push(data.id);
    const productId = data.product?.id;
    if (!productId) throw new Error('Provisioned page is missing its product');
    return { pageId: data.id, productId };
  };

  beforeAll(() => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  });

  afterAll(async () => {
    for (const pageId of createdPageIds) {
      try {
        await client.checkoutPages.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    for (const productId of createdProductIds) {
      try {
        await client.products.delete(productId, { fromAllPages: true });
      } catch {
        // Already deleted by the test, or never created.
      }
    }
  }, CLEANUP_TIMEOUT_MS);

  describe('create', () => {
    it('creates a one-time order bump product with role orderbump', async () => {
      const title = bumpTitle('one-time');
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title,
          price: { amount: 1500, currency: 'usd' },
        })
      );

      expect(outcome.status).toBe(201);
      const product = outcome.value!.data!;
      createdProductIds.push(product.id);
      expect(product).toMatchObject({
        title,
        role: 'orderbump',
        type: 'charge',
        price: { amount: 1500, currency: 'usd', payWhatYouWant: false },
      });
      expect(product.prices).toHaveLength(1);
      expect(product.prices?.[0]).toMatchObject({
        billingType: 'one_time',
        amount: 1500,
        currency: 'usd',
        isDefault: true,
        enabled: true,
        reference: 'price_one_time_fixed_1500',
      });
      expect(product.defaultPriceId).toBe(product.prices?.[0]?.id);
    });

    it('creates an order bump product with a setup fee', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title: bumpTitle('setup-fee'),
          price: { amount: 1500, currency: 'usd', setupFee: 500 },
        })
      );

      expect(outcome.status).toBe(201);
      const product = outcome.value!.data!;
      createdProductIds.push(product.id);
      expect(product.role).toBe('orderbump');
      expect(product.price).toMatchObject({ amount: 1500, setupFee: 500 });
      expect(product.prices?.[0]).toMatchObject({ billingType: 'one_time', setupFee: 500 });
    });

    it('creates a pay what you want one-time order bump product', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title: bumpTitle('pwyw'),
          price: { amount: 500, currency: 'usd', payWhatYouWant: true },
        })
      );

      expect(outcome.status).toBe(201);
      const product = outcome.value!.data!;
      createdProductIds.push(product.id);
      expect(product.role).toBe('orderbump');
      expect(product.prices?.[0]).toMatchObject({
        billingType: 'one_time',
        amount: 500,
        payWhatYouWant: true,
        reference: 'price_one_time_pwyw_500',
      });
    });

    it('defaults to a one-time price of 0 usd when no price is sent', async () => {
      const product = await createBump({ price: undefined });

      expect(product.price).toMatchObject({ amount: 0, currency: 'usd' });
      expect(product.prices?.[0]).toMatchObject({ billingType: 'one_time', amount: 0 });
    });

    it('stores the order bump card copy', async () => {
      const product = await createBump({
        shortDescription: 'Wrapped in recycled paper.',
        callToActionText: 'Yes! Add gift wrapping',
        headingText: 'Special one time offer',
        features: [{ text: 'Handwritten note', icon: 'check' }],
      });

      expect(product).toMatchObject({
        shortDescription: 'Wrapped in recycled paper.',
        callToActionText: 'Yes! Add gift wrapping',
        headingText: 'Special one time offer',
        features: [{ text: 'Handwritten note', icon: 'check' }],
      });
    });

    it('refuses a recurring price with 400 (order bumps are one-time only)', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title: bumpTitle('recurring'),
          price: {
            amount: 1500,
            currency: 'usd',
            billingType: 'recurring',
            recurring: { interval: 'month', intervalCount: 1 },
          },
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toBe(
        'An order bump product can only use a one-time price.'
      );
    });

    it('refuses a payment plan price with 400', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title: bumpTitle('payment-plan'),
          price: {
            amount: 1500,
            currency: 'usd',
            billingType: 'recurring',
            paymentPlan: { interval: 'month', intervalCount: 1, planIterations: 3 },
          },
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toBe(
        'An order bump product cannot use a payment plan.'
      );
    });

    it('requires role orderbump: page products are created with their page', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          // @ts-expect-error only 'orderbump' is accepted
          role: 'product',
          title: bumpTitle('page-role'),
        })
      );

      expect(outcome.status).toBe(400);
      expect((outcome.error as Error).message).toBe(
        "Bad request - Invalid body: Field 'role' must be one of: orderbump"
      );
    });

    it('rejects fields outside the order bump shape (multiple prices)', async () => {
      const outcome = await withStatus(() =>
        client.products.create({
          role: 'orderbump',
          title: bumpTitle('prices'),
          // @ts-expect-error `prices` is not accepted on create
          prices: [{ amount: 100, currency: 'usd', billingType: 'one_time' }],
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toContain('Unknown fields: prices');
    });
  });

  describe('list role filter', () => {
    it('role=orderbump includes order bump products and role=product excludes them', async () => {
      const bump = await createBump({ title: bumpTitle('listed') });
      const { productId: pageProductId } = await createPage();

      const bumps = await client.products.list({
        role: 'orderbump',
        search: bump.title,
        limit: 100,
      });
      expect(bumps.data.map((product) => product?.id)).toContain(bump.id);
      expect(bumps.data.every((product) => product?.role === 'orderbump')).toBe(true);
      expect(bumps.data.map((product) => product?.id)).not.toContain(pageProductId);

      const pageProducts = await client.products.list({
        role: 'product',
        search: bump.title,
        limit: 100,
      });
      expect(pageProducts.data.map((product) => product?.id)).not.toContain(bump.id);

      const pageProductsOnly = await client.products.list({ role: 'product', limit: 100 });
      expect(pageProductsOnly.data.every((product) => product?.role === 'product')).toBe(true);
    });

    it('rejects an unknown role with 400', async () => {
      const outcome = await withStatus(() =>
        // @ts-expect-error not a role
        client.products.list({ role: 'bogus' })
      );

      expect(outcome.status).toBe(400);
      expect((outcome.error as Error).message).toBe(
        "Bad request - Invalid query: Field 'role' must be one of: product, orderbump"
      );
    });
  });

  describe('update', () => {
    it('refuses order bump card fields on a page product with 400', async () => {
      const { productId } = await createPage();

      const outcome = await withStatus(() =>
        client.products.update(productId, {
          shortDescription: 'Not on a page product',
          headingText: 'Nope',
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toBe(
        'shortDescription, headingText can only be set on order bump products.'
      );
    });

    it('lets empty card fields through on a page product', async () => {
      const { productId } = await createPage();

      const outcome = await withStatus(() =>
        client.products.update(productId, { shortDescription: null, features: [] })
      );

      expect(outcome.status).toBe(200);
      expect(outcome.value!.data?.role).toBe('product');
    });

    it('updates and clears card fields on an order bump product', async () => {
      const bump = await createBump();

      const { data: updated } = await client.products.update(bump.id, {
        callToActionText: 'Yes please',
        features: [{ text: 'Fast', icon: 'bolt' }],
        calloutText: 'Only <strong>20</strong> left.',
        calloutIcon: 'fire',
      });
      expect(updated).toMatchObject({
        callToActionText: 'Yes please',
        features: [{ text: 'Fast', icon: 'bolt' }],
        calloutText: 'Only <strong>20</strong> left.',
        calloutIcon: 'fire',
      });

      const { data: cleared } = await client.products.update(bump.id, {
        callToActionText: null,
        features: null,
      });
      expect(cleared?.callToActionText ?? null).toBeNull();
      expect(cleared?.features ?? []).toEqual([]);
    });

    it('refuses switching an order bump product to a recurring price with 400', async () => {
      const bump = await createBump();

      const outcome = await withStatus(() =>
        client.products.update(bump.id, {
          price: {
            amount: 1500,
            currency: 'usd',
            billingType: 'recurring',
            recurring: { interval: 'month', intervalCount: 1 },
          },
        })
      );

      expect(outcome.status).toBe(400);
      expect((outcome.error as Error).message).toBe(
        'An order bump product can only use a one-time price.'
      );
    });
  });

  describe('delete', () => {
    it('deletes an unplaced order bump product', async () => {
      const bump = await createBump();

      const outcome = await withStatus(() => client.products.delete(bump.id));

      expect(outcome.status).toBe(200);
      expect(outcome.value).toEqual({
        data: { success: true, message: 'Product deleted successfully' },
      });
      await expect(client.products.get(bump.id)).rejects.toThrow(NotFoundError);
    });

    it('refuses a page product with 400', async () => {
      const { productId } = await createPage();

      const outcome = await withStatus(() => client.products.delete(productId));

      expect(outcome.status).toBe(400);
      expect((outcome.error as Error).message).toBe(
        'Only order bump products can be deleted. Page products are deleted with their page.'
      );
    });

    it('answers 404 for an unknown product', async () => {
      const outcome = await withStatus(() =>
        client.products.delete(fakeObjectId('sdkitbumpunknown'))
      );

      expect(outcome.status).toBe(404);
      expect(outcome.error).toBeInstanceOf(NotFoundError);
      expect((outcome.error as Error).message).toBe('Product not found');
    });

    it('refuses a product still offered on a page, then fromAllPages removes it from the page first', async () => {
      const bump = await createBump();
      const { pageId } = await createPage();
      await client.checkoutPages.orderBumps.create(pageId, { productId: bump.id });

      const refused = await withStatus(() => client.products.delete(bump.id));
      expect(refused.status).toBe(400);
      expect((refused.error as Error).message).toBe(
        'Cannot delete a product that is still used on a page.'
      );

      const refusedExplicitly = await withStatus(() =>
        client.products.delete(bump.id, { fromAllPages: false })
      );
      expect(refusedExplicitly.status).toBe(400);

      const deleted = await withStatus(() =>
        client.products.delete(bump.id, { fromAllPages: true })
      );
      expect(deleted.status).toBe(200);

      const { data: remaining } = await client.checkoutPages.orderBumps.list(pageId);
      expect(remaining.map((entry) => entry.productId)).not.toContain(bump.id);
    });

    it('pins current behaviour: a bump left on an archived page still blocks delete, though usedOnPageCount no longer counts that page', async () => {
      const bump = await createBump();
      const { pageId } = await createPage();
      const { pageId: otherPageId } = await createPage();
      await client.checkoutPages.orderBumps.create(pageId, { productId: bump.id });
      const { data: onOther } = await client.checkoutPages.orderBumps.create(otherPageId, {
        productId: bump.id,
      });
      expect(onOther.usedOnPageCount).toBe(2);

      const { data: archived } = await client.checkoutPages.delete(pageId);
      expect(archived.status).toBe('archived');

      const { data: listed } = await client.checkoutPages.orderBumps.list(otherPageId);
      expect(listed.find((entry) => entry.productId === bump.id)?.usedOnPageCount).toBe(1);

      await client.checkoutPages.orderBumps.delete(otherPageId, bump.id);

      const refused = await withStatus(() => client.products.delete(bump.id));
      expect(refused.status).toBe(400);
      expect((refused.error as Error).message).toBe(
        'Cannot delete a product that is still used on a page.'
      );

      const deleted = await withStatus(() =>
        client.products.delete(bump.id, { fromAllPages: true })
      );
      expect(deleted.status).toBe(200);
    });
  });
});
