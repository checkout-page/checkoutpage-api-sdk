import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  AuthenticationError,
  CheckoutPageClient,
  createCheckoutPageClient,
  NotFoundError,
  ValidationError,
} from '../../index';
import type { CreateProductParams } from '../../index';
import type { OrderBumpsResource } from './order-bumps';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';
import { withStatus } from '../../test-helpers/http-status';

// Cleanup walks every page and product the suite made, one request at a time.
const CLEANUP_TIMEOUT_MS = 180_000;

// Runs against any seller: order bumps are no longer gated behind a labs flag,
// so nothing here may answer 403.
describe('Order bumps on checkout pages and events (integration)', () => {
  let client: CheckoutPageClient;
  const createdProductIds: string[] = [];
  const createdCheckoutPageIds: string[] = [];
  const createdEventIds: string[] = [];

  const name = (label: string) => `SDK IT Bump ${label} ${uniqueSuffix()}`;

  const createBump = async (params: Partial<CreateProductParams> = {}) => {
    const { data } = await client.products.create({
      role: 'orderbump',
      title: name('product'),
      price: { amount: 1500, currency: 'usd' },
      ...params,
    });
    if (!data) throw new Error('Order bump product was not returned');
    createdProductIds.push(data.id);
    return data;
  };

  const createCheckoutPage = async () => {
    const { data } = await client.checkoutPages.create({
      name: name('page'),
      productData: { price: { amount: 4900, currency: 'usd' } },
    });
    createdCheckoutPageIds.push(data.id);
    const productId = data.product?.id;
    if (!productId) throw new Error('Provisioned page is missing its product');
    return { pageId: data.id, productId };
  };

  const createEvent = async () => {
    const eventName = name('event');
    const { data } = await client.events.create({
      name: eventName,
      title: eventName,
      eventDetails: {
        type: 'in_person',
        currency: 'usd',
        startDate: '2027-09-01T09:00:00Z',
        endDate: '2027-09-01T17:00:00Z',
        timezone: 'UTC',
        location: 'SDK IT Bump venue',
      },
    });
    createdEventIds.push(data.id);
    return { pageId: data.id };
  };

  const detachAll = async (orderBumps: OrderBumpsResource, pageId: string) => {
    const { data } = await orderBumps.list(pageId);
    for (const entry of data) {
      await orderBumps.delete(pageId, entry.productId);
    }
  };

  beforeAll(() => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  });

  afterAll(async () => {
    const tidy = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        // Best-effort cleanup for integration tests.
      }
    };
    for (const pageId of createdCheckoutPageIds) {
      await tidy(() => detachAll(client.checkoutPages.orderBumps, pageId));
      await tidy(() => client.checkoutPages.delete(pageId));
    }
    for (const pageId of createdEventIds) {
      await tidy(() => detachAll(client.events.orderBumps, pageId));
      await tidy(() => client.events.delete(pageId));
    }
    for (const productId of createdProductIds) {
      await tidy(() => client.products.delete(productId, { fromAllPages: true }));
    }
  }, CLEANUP_TIMEOUT_MS);

  describe('on a checkout page', () => {
    it('attaches, lists in display order, updates, reorders and detaches', async () => {
      const { pageId } = await createCheckoutPage();
      const first = await createBump({ title: name('first') });
      const second = await createBump({
        title: name('second'),
        price: { amount: 900, currency: 'usd', setupFee: 300 },
      });

      const empty = await withStatus(() => client.checkoutPages.orderBumps.list(pageId));
      expect(empty.status).toBe(200);
      expect(empty.value).toEqual({ data: [] });

      const attached = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, { productId: first.id })
      );
      expect(attached.status).toBe(201);
      expect(attached.value!.data).toEqual({
        productId: first.id,
        addedAt: expect.any(String),
        enabled: true,
        preselected: false,
        hidden: false,
        showHideLogic: {
          enabled: false,
          subject: 'price',
          comparison: 'is',
          priceId: null,
          ticketTypeIds: [],
          orderBumpProductIds: [],
        },
        allowQuantity: false,
        shortenDescription: false,
        product: { id: first.id, title: first.title, currency: 'usd', imageUrl: null },
        price: {
          amount: 1500,
          currency: 'usd',
          billingType: 'one_time',
          interval: null,
          intervalCount: null,
        },
        unavailableReason: null,
        usedOnPageCount: 1,
        hasPurchases: false,
      });
      expect(new Date(attached.value!.data.addedAt!).toISOString()).toBe(
        attached.value!.data.addedAt
      );

      const { data: secondPlaced } = await client.checkoutPages.orderBumps.create(pageId, {
        productId: second.id,
        preselected: true,
        allowQuantity: true,
      });
      expect(secondPlaced).toMatchObject({
        productId: second.id,
        preselected: true,
        allowQuantity: true,
        price: { amount: 900, billingType: 'one_time' },
      });

      const { data: listed } = await client.checkoutPages.orderBumps.list(pageId);
      expect(listed.map((entry) => entry.productId)).toEqual([first.id, second.id]);

      const updated = await withStatus(() =>
        client.checkoutPages.orderBumps.update(pageId, first.id, {
          enabled: false,
          preselected: true,
          hidden: true,
          shortenDescription: true,
          allowQuantity: true,
          showHideLogic: {
            enabled: true,
            subject: 'order_bump',
            orderBumpProductIds: [second.id, first.id],
          },
        })
      );
      expect(updated.status).toBe(200);
      expect(updated.value!.data).toMatchObject({
        productId: first.id,
        enabled: false,
        preselected: true,
        hidden: true,
        shortenDescription: true,
        allowQuantity: true,
        // The bump's own id is dropped: a bump watching itself could never show.
        showHideLogic: {
          enabled: true,
          subject: 'order_bump',
          comparison: 'is',
          priceId: null,
          ticketTypeIds: [],
          orderBumpProductIds: [second.id],
        },
      });

      const { data: partial } = await client.checkoutPages.orderBumps.update(pageId, first.id, {
        enabled: true,
      });
      expect(partial).toMatchObject({ enabled: true, preselected: true, hidden: true });

      const reordered = await withStatus(() =>
        client.checkoutPages.orderBumps.reorder(pageId, { productIds: [second.id, first.id] })
      );
      expect(reordered.status).toBe(200);
      expect(reordered.value!.data.map((entry) => entry.productId)).toEqual([second.id, first.id]);

      const { data: afterReorder } = await client.checkoutPages.orderBumps.list(pageId);
      expect(afterReorder.map((entry) => entry.productId)).toEqual([second.id, first.id]);

      const detached = await withStatus(() =>
        client.checkoutPages.orderBumps.delete(pageId, second.id)
      );
      expect(detached.status).toBe(200);
      expect(detached.value).toEqual({
        data: { success: true, message: 'Order bump removed successfully' },
      });

      const { data: afterDetach } = await client.checkoutPages.orderBumps.list(pageId);
      expect(afterDetach.map((entry) => entry.productId)).toEqual([first.id]);

      // Detaching keeps the product.
      const { data: kept } = await client.products.get(second.id);
      expect(kept?.role).toBe('orderbump');
    });

    it('attaches a pay what you want order bump at its minimum price', async () => {
      const { pageId } = await createCheckoutPage();
      const bump = await createBump({
        price: { amount: 500, currency: 'usd', payWhatYouWant: true },
      });

      const { data } = await client.checkoutPages.orderBumps.create(pageId, { productId: bump.id });

      expect(data.price).toEqual({
        amount: 500,
        currency: 'usd',
        billingType: 'one_time',
        interval: null,
        intervalCount: null,
      });
      expect(data.unavailableReason).toBeNull();
    });

    it('refuses a page product as an order bump with 400', async () => {
      const { pageId, productId: ownProductId } = await createCheckoutPage();
      const { productId: otherPageProductId } = await createCheckoutPage();

      const own = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, { productId: ownProductId })
      );
      expect(own.status).toBe(400);
      expect(own.error).toBeInstanceOf(ValidationError);
      expect((own.error as Error).message).toBe('This product is already sold on this page.');

      const other = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, { productId: otherPageProductId })
      );
      expect(other.status).toBe(400);
      expect((other.error as Error).message).toBe(
        'Only order bump products can be added as order bumps.'
      );
    });

    it('refuses the same order bump twice with 400', async () => {
      const { pageId } = await createCheckoutPage();
      const bump = await createBump();
      await client.checkoutPages.orderBumps.create(pageId, { productId: bump.id });

      const again = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, { productId: bump.id })
      );

      expect(again.status).toBe(400);
      expect((again.error as Error).message).toBe(
        'This product is already an order bump on this page.'
      );
    });

    it('refuses an order bump in another currency with 400', async () => {
      const { pageId } = await createCheckoutPage();
      const bump = await createBump({ price: { amount: 1500, currency: 'eur' } });

      const outcome = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, { productId: bump.id })
      );

      expect(outcome.status).toBe(400);
      expect((outcome.error as Error).message).toBe(
        'An order bump must use the same currency as the page product.'
      );
    });

    it('pins current behaviour: an unknown product id is a 400 "Product not found.", not a 404', async () => {
      const { pageId } = await createCheckoutPage();

      const outcome = await withStatus(() =>
        client.checkoutPages.orderBumps.create(pageId, {
          productId: fakeObjectId('sdkitbumpmissing'),
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toBe('Product not found.');
    });

    it('answers 404 for an unknown page id and 400 for a malformed one', async () => {
      const bump = await createBump();

      const unknown = await withStatus(() =>
        client.checkoutPages.orderBumps.create(fakeObjectId('sdkitbumpnopage'), {
          productId: bump.id,
        })
      );
      expect(unknown.status).toBe(404);
      expect(unknown.error).toBeInstanceOf(NotFoundError);
      expect((unknown.error as Error).message).toBe('Page not found');

      const malformed = await withStatus(() => client.checkoutPages.orderBumps.list('not-an-id'));
      expect(malformed.status).toBe(400);
      expect((malformed.error as Error).message).toBe(
        "Bad request - Invalid request parameters: Field 'pageId' is invalid id format"
      );
    });

    it('answers 404 when the product is not an order bump on the page', async () => {
      const { pageId } = await createCheckoutPage();
      const bump = await createBump();

      const update = await withStatus(() =>
        client.checkoutPages.orderBumps.update(pageId, bump.id, { preselected: true })
      );
      expect(update.status).toBe(404);
      expect((update.error as Error).message).toBe(
        'This product is not an order bump on this page.'
      );

      const remove = await withStatus(() =>
        client.checkoutPages.orderBumps.delete(pageId, bump.id)
      );
      expect(remove.status).toBe(404);
      expect((remove.error as Error).message).toBe(
        'This product is not an order bump on this page.'
      );
    });

    it('rejects placement fields it does not know with 400 (copy and price live on the product)', async () => {
      const { pageId } = await createCheckoutPage();
      const bump = await createBump();
      await client.checkoutPages.orderBumps.create(pageId, { productId: bump.id });

      const outcome = await withStatus(() =>
        client.checkoutPages.orderBumps.update(pageId, bump.id, {
          // @ts-expect-error title is a product field, not a placement field
          title: 'Renamed',
        })
      );

      expect(outcome.status).toBe(400);
      expect(outcome.error).toBeInstanceOf(ValidationError);
      expect((outcome.error as Error).message).toBe(
        'Bad request - Invalid body: Unknown fields: title; At least one field must be provided.'
      );
    });

    it('refuses a reorder that is not a permutation of the bumps on the page with 400', async () => {
      const { pageId } = await createCheckoutPage();
      const first = await createBump();
      const second = await createBump();
      await client.checkoutPages.orderBumps.create(pageId, { productId: first.id });
      await client.checkoutPages.orderBumps.create(pageId, { productId: second.id });

      for (const productIds of [
        [first.id],
        [first.id, first.id],
        [first.id, second.id, second.id],
      ]) {
        const outcome = await withStatus(() =>
          client.checkoutPages.orderBumps.reorder(pageId, { productIds })
        );
        expect(outcome.status).toBe(400);
        expect((outcome.error as Error).message).toBe(
          'productIds must list every order bump on this page exactly once.'
        );
      }

      const { data } = await client.checkoutPages.orderBumps.list(pageId);
      expect(data.map((entry) => entry.productId)).toEqual([first.id, second.id]);
    });
  });

  describe('on an event', () => {
    it('attaches, lists, updates, reorders and detaches, with ticket as the default rule subject', async () => {
      const { pageId } = await createEvent();
      const first = await createBump();
      const second = await createBump({
        price: { amount: 700, currency: 'usd', payWhatYouWant: true },
      });

      const attached = await withStatus(() =>
        client.events.orderBumps.create(pageId, { productId: first.id })
      );
      expect(attached.status).toBe(201);
      expect(attached.value!.data).toMatchObject({
        productId: first.id,
        enabled: true,
        showHideLogic: { enabled: false, subject: 'ticket', comparison: 'is' },
        price: { amount: 1500, currency: 'usd', billingType: 'one_time' },
        unavailableReason: null,
      });

      await client.events.orderBumps.create(pageId, { productId: second.id, hidden: true });

      const { data: listed } = await client.events.orderBumps.list(pageId);
      expect(listed.map((entry) => entry.productId)).toEqual([first.id, second.id]);
      expect(listed[1]).toMatchObject({ hidden: true });

      const { data: updated } = await client.events.orderBumps.update(pageId, second.id, {
        preselected: true,
        showHideLogic: { enabled: true, comparison: 'is_not', ticketTypeIds: [] },
      });
      expect(updated).toMatchObject({
        preselected: true,
        showHideLogic: {
          enabled: true,
          subject: 'ticket',
          comparison: 'is_not',
          ticketTypeIds: [],
        },
      });

      const { data: reordered } = await client.events.orderBumps.reorder(pageId, {
        productIds: [second.id, first.id],
      });
      expect(reordered.map((entry) => entry.productId)).toEqual([second.id, first.id]);

      const detached = await withStatus(() => client.events.orderBumps.delete(pageId, first.id));
      expect(detached.status).toBe(200);

      const { data: afterDetach } = await client.events.orderBumps.list(pageId);
      expect(afterDetach.map((entry) => entry.productId)).toEqual([second.id]);
    });

    it('counts a bump offered on a checkout page and an event in usedOnPageCount', async () => {
      const { pageId: checkoutPageId } = await createCheckoutPage();
      const { pageId: eventId } = await createEvent();
      const bump = await createBump();

      await client.checkoutPages.orderBumps.create(checkoutPageId, { productId: bump.id });
      const { data } = await client.events.orderBumps.create(eventId, { productId: bump.id });

      expect(data.usedOnPageCount).toBe(2);
    });
  });

  describe('page type is part of the path', () => {
    it('answers 404 for an event through /checkout-pages and a checkout page through /events', async () => {
      const { pageId: checkoutPageId } = await createCheckoutPage();
      const { pageId: eventId } = await createEvent();
      const bump = await createBump();

      const eventAsCheckout = await withStatus(() =>
        client.checkoutPages.orderBumps.create(eventId, { productId: bump.id })
      );
      expect(eventAsCheckout.status).toBe(404);
      expect((eventAsCheckout.error as Error).message).toBe('Page not found');

      const checkoutAsEvent = await withStatus(() => client.events.orderBumps.list(checkoutPageId));
      expect(checkoutAsEvent.status).toBe(404);
      expect(checkoutAsEvent.error).toBeInstanceOf(NotFoundError);
    });
  });

  describe('availability', () => {
    it('is open to every seller: no 403 on list or create', async () => {
      const { pageId: checkoutPageId } = await createCheckoutPage();
      const { pageId: eventId } = await createEvent();
      const bump = await createBump();

      const calls: Array<() => Promise<unknown>> = [
        () => client.checkoutPages.orderBumps.list(checkoutPageId),
        () => client.events.orderBumps.list(eventId),
        () => client.checkoutPages.orderBumps.create(checkoutPageId, { productId: bump.id }),
        () => client.products.list({ role: 'orderbump', limit: 1 }),
      ];

      for (const call of calls) {
        const outcome = await withStatus(call);
        expect(outcome.error).not.toBeInstanceOf(AuthenticationError);
        expect(outcome.status).not.toBe(403);
        expect(outcome.status).toBeLessThan(300);
      }
    });
  });
});
