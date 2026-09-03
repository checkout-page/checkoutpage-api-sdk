import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  APIError,
  CheckoutPageClient,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateCheckoutPageParams, PriceInput } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

/**
 * Exhaustive coverage of the multi-price (`productData.prices[]` /
 * `defaultPriceId`) surface, exercised end-to-end through the seller API.
 *
 * The pre-existing checkout-pages integration suite only ever sends the legacy
 * scalar `price: {}` — the `prices[]` write path was effectively untested. This
 * file covers happy paths, the read/response shape (isDefault resolution,
 * legacy-scalar projection, ordering, hidden/disabled), the products.update
 * replacement path, and adversarially probes every price guardrail.
 *
 * Tests wrapped in `it.fails` document confirmed API bugs (see
 * `MULTI_PRICE_BUGS.md`): they assert the DESIRED behavior, currently fail, and
 * will flip red the moment the bug is fixed — a signal to remove the wrapper.
 */
describe('CheckoutPagesResource multi-price integration tests', () => {
  let client: CheckoutPageClient;
  let createdPageIds: string[] = [];

  const remember = (id: string) => createdPageIds.push(id);

  beforeAll(() => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  });

  afterEach(async () => {
    for (const id of [...createdPageIds].reverse()) {
      try {
        await client.checkoutPages.delete(id);
      } catch {
        // best-effort cleanup
      }
    }
    createdPageIds = [];
  });

  const createWithPrices = async (
    prices: PriceInput[],
    productOverrides: Record<string, unknown> = {},
    pageOverrides: Partial<CreateCheckoutPageParams> = {},
  ) => {
    const suffix = uniqueSuffix();
    const params = {
      name: `MP ${suffix}`,
      ...pageOverrides,
      productData: {
        title: `MP Product ${suffix}`,
        prices,
        ...productOverrides,
      },
    } as unknown as CreateCheckoutPageParams;
    const response = await client.checkoutPages.create(params);
    remember(response.data.id);
    return response.data;
  };

  const priceById = (
    product: { prices?: Array<{ id: string; isDefault: boolean }> | null },
    id: string,
  ) => product.prices?.find((p) => p.id === id);

  describe('references', () => {
    it('derives references from the price data, numbering duplicates around explicit ones', async () => {
      const product = (await createWithPrices([
        { billingType: 'one_time', amount: 2500, currency: 'usd' },
        { billingType: 'one_time', amount: 2500, currency: 'usd' },
        { billingType: 'one_time', amount: 9900, currency: 'usd', reference: 'launch-offer' },
        {
          billingType: 'recurring',
          amount: 1000,
          currency: 'usd',
          recurring: { interval: 'month', intervalCount: 1 },
        },
        { billingType: 'one_time', amount: 0, currency: 'usd', payWhatYouWant: true, pwywSuggestedPrice: 500 },
      ])).product!;

      expect(product.prices!.map((p) => p.reference)).toEqual([
        'price_one_time_fixed_2500',
        'price_one_time_fixed_2500_2',
        'launch-offer',
        'price_recurring_fixed_1000',
        'price_one_time_pwyw_0',
      ]);
    });

    it('derives the reference for the legacy price alias too', async () => {
      const suffix = uniqueSuffix();
      const { data } = await client.checkoutPages.create({
        name: `MP alias ${suffix}`,
        productData: {
          title: `MP alias product ${suffix}`,
          price: { amount: 4900, currency: 'usd' },
        },
      });
      remember(data.id);

      expect(data.product!.prices![0].reference).toBe('price_one_time_fixed_4900');
    });
  });

  describe('single price[] happy paths', () => {
    it('creates a one-time price and marks it default, mirroring the legacy scalar', async () => {
      const product = (await createWithPrices([
        { billingType: 'one_time', amount: 2500, currency: 'usd', label: 'One-time' },
      ])).product!;

      expect(product.prices).toHaveLength(1);
      const price = product.prices![0];
      expect(price.billingType).toBe('one_time');
      expect(price.amount).toBe(2500);
      expect(price.currency).toBe('usd');
      expect(price.isDefault).toBe(true);
      expect(price.enabled).toBe(true);
      expect(price.hidden).toBe(false);
      expect(price.reference).toBe('price_one_time_fixed_2500');
      expect(product.defaultPriceId).toBe(price.id);
      // legacy scalar projection mirrors the default entry
      expect(product.price.amount).toBe(2500);
    });

    it('creates a recurring price with interval, trial, and setup fee', async () => {
      const product = (await createWithPrices([
        {
          billingType: 'recurring',
          amount: 1500,
          currency: 'usd',
          setupFee: 500,
          recurring: { interval: 'month', intervalCount: 3, trialPeriodDays: 7 },
        },
      ])).product!;

      const price = product.prices![0];
      expect(price.billingType).toBe('recurring');
      expect(price.setupFee).toBe(500);
      expect(price.recurring?.interval).toBe('month');
      expect(price.recurring?.intervalCount).toBe(3);
      expect(price.recurring?.trialPeriodDays).toBe(7);
      expect(price.paymentPlan).toBeFalsy();
    });

    it('creates a payment-plan price with planIterations', async () => {
      const product = (await createWithPrices([
        {
          billingType: 'recurring',
          amount: 3000,
          currency: 'usd',
          paymentPlan: { interval: 'month', intervalCount: 1, planIterations: 4 },
        },
      ])).product!;

      const price = product.prices![0];
      expect(price.paymentPlan?.planIterations).toBe(4);
      expect(price.paymentPlan?.interval).toBe('month');
      expect(price.recurring).toBeFalsy();
    });

    it('creates a pay-what-you-want price with a suggested price', async () => {
      const product = (await createWithPrices([
        {
          billingType: 'one_time',
          amount: 500,
          currency: 'usd',
          payWhatYouWant: true,
          pwywSuggestedPrice: 1200,
        },
      ])).product!;

      const price = product.prices![0];
      expect(price.payWhatYouWant).toBe(true);
      expect(price.pwywSuggestedPrice).toBe(1200);
      expect(price.amount).toBe(500);
    });

    it('preserves discountedFromPrice, badge, and label', async () => {
      const product = (await createWithPrices([
        {
          billingType: 'one_time',
          amount: 2000,
          currency: 'usd',
          discountedFromPrice: 3500,
          badge: 'Best value',
          label: 'Launch price',
        },
      ])).product!;

      const price = product.prices![0];
      expect(price.discountedFromPrice).toBe(3500);
      expect(price.badge).toBe('Best value');
      expect(price.label).toBe('Launch price');
    });
  });

  describe('multiple prices', () => {
    it('preserves order and marks the first price default', async () => {
      const product = (await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'A' },
        { billingType: 'recurring', amount: 800, currency: 'usd', label: 'B', recurring: { interval: 'month', intervalCount: 1 } },
        { billingType: 'one_time', amount: 5000, currency: 'usd', label: 'C' },
      ])).product!;

      expect(product.prices).toHaveLength(3);
      expect(product.prices!.map((p) => p.label)).toEqual(['A', 'B', 'C']);
      expect(product.prices!.map((p) => p.order)).toEqual([0, 1, 2]);
      expect(product.prices!.filter((p) => p.isDefault)).toHaveLength(1);
      expect(product.prices![0].isDefault).toBe(true);
      expect(product.defaultPriceId).toBe(product.prices![0].id);
    });

    it('honours an explicit defaultPriceId supplied with client-provided price ids', async () => {
      const idA = '6a58000000000000000000b1';
      const idB = '6a58000000000000000000b2';
      const product = (await createWithPrices(
        [
          { id: idA, billingType: 'one_time', amount: 1000, currency: 'usd', label: 'A' },
          { id: idB, billingType: 'one_time', amount: 2000, currency: 'usd', label: 'B' },
        ],
        { defaultPriceId: idB },
      )).product!;

      expect(product.defaultPriceId).toBe(idB);
      expect(priceById(product, idB)?.isDefault).toBe(true);
      expect(priceById(product, idA)?.isDefault).toBe(false);
      // legacy scalar mirrors the chosen default, not price[0]
      expect(product.price.amount).toBe(2000);
    });

    it('returns disabled prices in the seller API response but never as default', async () => {
      const product = (await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'Enabled' },
        { billingType: 'one_time', amount: 2000, currency: 'usd', label: 'Disabled', enabled: false },
      ])).product!;

      const disabled = product.prices!.find((p) => p.label === 'Disabled');
      expect(disabled).toBeTruthy();
      expect(disabled!.enabled).toBe(false);
      expect(disabled!.isDefault).toBe(false);
    });

    it('persists a hidden price with hidden: true', async () => {
      const product = (await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'Visible' },
        { billingType: 'one_time', amount: 2000, currency: 'usd', label: 'Hidden', hidden: true },
      ])).product!;

      const hidden = product.prices!.find((p) => p.label === 'Hidden');
      expect(hidden!.hidden).toBe(true);
    });
  });

  describe('round-trip', () => {
    it('returns identical prices[] from create and a subsequent get', async () => {
      const created = (await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'A' },
        { billingType: 'recurring', amount: 800, currency: 'usd', label: 'B', recurring: { interval: 'year', intervalCount: 1 } },
      ]));
      const fetched = await client.checkoutPages.get(created.id);

      const norm = (p: { prices?: Array<{ id: string; amount: number; billingType: string; isDefault: boolean }> | null }) =>
        p.prices?.map((x) => ({ id: x.id, amount: x.amount, billingType: x.billingType, isDefault: x.isDefault }));
      expect(norm(fetched.data.product!)).toEqual(norm(created.product!));
      expect(fetched.data.product!.defaultPriceId).toBe(created.product!.defaultPriceId);
    });
  });

  describe('products.update prices replacement', () => {
    it('replaces prices[] and re-resolves the default', async () => {
      const created = await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'Original' },
      ]);
      const productId = created.product!.id;

      const updated = await client.products.update(productId, {
        prices: [
          { billingType: 'one_time', amount: 4000, currency: 'usd', label: 'New A' },
          { billingType: 'recurring', amount: 900, currency: 'usd', label: 'New B', recurring: { interval: 'month', intervalCount: 1 } },
        ],
      } as never);

      const data = (updated as { data: NonNullable<typeof created.product> }).data;
      expect(data.prices).toHaveLength(2);
      expect(data.prices!.map((p) => p.label)).toEqual(['New A', 'New B']);
      expect(data.prices!.filter((p) => p.isDefault)).toHaveLength(1);
    });
  });

  describe('guardrails (correctly rejected)', () => {
    const expectReject = async (prices: PriceInput[], productOverrides: Record<string, unknown> = {}) =>
      expect(createWithPrices(prices, productOverrides)).rejects.toThrow(ValidationError);

    it('rejects an empty prices[] array', async () => {
      await expectReject([]);
    });

    it('rejects when every price is disabled', async () => {
      await expectReject([
        { billingType: 'one_time', amount: 100, currency: 'usd', enabled: false },
        { billingType: 'one_time', amount: 200, currency: 'usd', enabled: false },
      ]);
    });

    it('rejects prices with mismatched currencies', async () => {
      await expectReject([
        { billingType: 'one_time', amount: 100, currency: 'usd' },
        { billingType: 'one_time', amount: 200, currency: 'eur' },
      ]);
    });

    it('rejects a negative amount', async () => {
      await expectReject([{ billingType: 'one_time', amount: -500, currency: 'usd' }]);
    });

    it('rejects a one_time price carrying a recurring config', async () => {
      await expectReject([
        { billingType: 'one_time', amount: 500, currency: 'usd', recurring: { interval: 'month', intervalCount: 1 } },
      ]);
    });

    it('rejects a price carrying both recurring and paymentPlan configs', async () => {
      await expectReject([
        {
          billingType: 'recurring',
          amount: 500,
          currency: 'usd',
          recurring: { interval: 'month', intervalCount: 1 },
          paymentPlan: { interval: 'month', intervalCount: 1, planIterations: 3 },
        },
      ]);
    });

    it('rejects a defaultPriceId that points at a disabled price', async () => {
      const idA = '6a58000000000000000000c1';
      const idB = '6a58000000000000000000c2';
      await expectReject(
        [
          { id: idA, billingType: 'one_time', amount: 500, currency: 'usd', enabled: false },
          { id: idB, billingType: 'one_time', amount: 600, currency: 'usd', enabled: true },
        ],
        { defaultPriceId: idA },
      );
    });
  });

  // Regression coverage for the two defaultPriceId bugs found during this pass
  // and fixed via `validateDefaultPriceExists` (see MULTI_PRICE_BUGS.md).
  describe('defaultPriceId validation', () => {
    const createUpdatableProduct = async () => {
      const created = await createWithPrices([
        { billingType: 'one_time', amount: 1000, currency: 'usd', label: 'A' },
        { billingType: 'one_time', amount: 2000, currency: 'usd', label: 'B' },
      ]);
      return created.product!;
    };

    // BUG #1 — a defaultPriceId matching no price used to be accepted, leaving a
    // dangling default and no price flagged isDefault.
    it('rejects a defaultPriceId that matches no price on create', async () => {
      await expect(
        createWithPrices(
          [{ id: '6a58000000000000000000d2', billingType: 'one_time', amount: 500, currency: 'usd' }],
          { defaultPriceId: '6a58000000000000000000d1' },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a defaultPriceId that matches no price on update', async () => {
      const product = await createUpdatableProduct();
      await expect(
        client.products.update(product.id, { defaultPriceId: '6a58000000000000000000a1' } as never),
      ).rejects.toThrow(ValidationError);
    });

    // BUG #2 — a malformed (non-ObjectId) defaultPriceId used to throw unguarded
    // inside `new mongoose.Types.ObjectId(...)`, surfacing as a 500 (APIError).
    it('rejects a malformed defaultPriceId with a 400, not a 500, on create', async () => {
      const attempt = createWithPrices(
        [{ billingType: 'one_time', amount: 500, currency: 'usd' }],
        { defaultPriceId: 'not-an-object-id' },
      );
      await expect(attempt).rejects.toThrow(ValidationError);
      await expect(attempt).rejects.not.toThrow(APIError);
    });

    it('rejects a malformed defaultPriceId with a 400, not a 500, on update', async () => {
      const product = await createUpdatableProduct();
      const attempt = client.products.update(product.id, { defaultPriceId: 'not-an-id' } as never);
      await expect(attempt).rejects.toThrow(ValidationError);
      await expect(attempt).rejects.not.toThrow(APIError);
    });

    it('accepts switching the default to another existing price on update', async () => {
      const product = await createUpdatableProduct();
      const target = product.prices!.find((p) => !p.isDefault)!;
      const updated = (await client.products.update(product.id, {
        defaultPriceId: target.id,
      } as never)) as { data: NonNullable<typeof product> };
      expect(updated.data.defaultPriceId).toBe(target.id);
      expect(updated.data.prices!.find((p) => p.id === target.id)!.isDefault).toBe(true);
      expect(updated.data.prices!.filter((p) => p.isDefault)).toHaveLength(1);
    });
  });
});
