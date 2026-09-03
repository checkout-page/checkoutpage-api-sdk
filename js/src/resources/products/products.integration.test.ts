import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, ValidationError } from '../../index';
import type { Price, PriceInput } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('ProductResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let testProductId: string;
  let createdPageIds: string[] = [];

  const createProductWithPrice = async (price: Record<string, unknown>) => {
    const { data: page } = await client.checkoutPages.create({
      name: `Product Price Test Page ${uniqueSuffix()}`,
      productData: {
        price: price as never,
      },
    });
    createdPageIds.push(page.id);

    const productId = page.product?.id;
    if (!productId) {
      throw new Error('Provisioned page is missing its product');
    }
    return productId;
  };

  afterAll(async () => {
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        await client.checkoutPages.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdPageIds = [];
  });

  beforeAll(async () => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    const { data: page } = await client.checkoutPages.create({
      name: `Product Test Page ${Date.now()}`,
      productData: {
        price: {
          amount: 4900,
          currency: 'usd',
        },
      },
    });

    if (page.product?.id) {
      testProductId = page.product.id;
    }
  });

  describe('get', () => {
    it('should fetch a product by id', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: product } = await client.products.get(testProductId);

      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('price');
      expect(product.id).toBe(testProductId);
      expect(product.price.amount).toBeDefined();
      expect(product.price.currency).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update basic product fields', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        title: 'Updated Product Title',
        description: 'Updated product description',
        price: { amount: 5900 },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.title).toBe('Updated Product Title');
      expect(updated.description).toBeDefined();
      expect(updated.price.amount).toBe(5900);
    });

    it('should update product currency', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: { currency: 'eur' },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.currency).toBe('eur');
    });

    it('should update product stock settings', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        stock: 100,
        hasUnlimitedStock: false,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.stock).toBe(100);
      expect(updated.hasUnlimitedStock).toBe(false);
    });

    it('should update product to unlimited stock', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        hasUnlimitedStock: true,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.hasUnlimitedStock).toBe(true);
    });

    it('should update product SKU', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        sku: 'TEST-SKU-123',
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.sku).toBe('TEST-SKU-123');
    });

    it('should update subscription recurring settings', async () => {
      const productId = await createProductWithPrice({
        amount: 4900,
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 1 },
      });

      const { data: updated } = await client.products.update(productId, {
        price: {
          recurring: {
            interval: 'month',
            intervalCount: 3,
          },
        },
      });

      expect(updated.id).toBe(productId);
      expect(updated.price.recurring?.interval).toBe('month');
      expect(updated.price.recurring?.intervalCount).toBe(3);
    });

    it('should update subscription trial period', async () => {
      const productId = await createProductWithPrice({
        amount: 4900,
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 1 },
      });

      const { data: updated } = await client.products.update(productId, {
        price: {
          recurring: {
            interval: 'month',
            intervalCount: 1,
            trialPeriodDays: 14,
          },
        },
      });

      expect(updated.id).toBe(productId);
      expect(updated.price.recurring?.trialPeriodDays).toBe(14);
    });

    it('should update setup fee', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: { setupFee: 2500 },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.setupFee).toBe(2500);
    });

    it('should update setupFeeMultipliesWithQuantity', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: {
          setupFee: 1500,
          setupFeeMultipliesWithQuantity: true,
        },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.setupFee).toBe(1500);
      expect(updated.price.setupFeeMultipliesWithQuantity).toBe(true);
    });

    it('should update payment plan iterations', async () => {
      const productId = await createProductWithPrice({
        amount: 12000,
        currency: 'usd',
        paymentPlan: { interval: 'month', intervalCount: 1, planIterations: 3 },
      });

      const { data: updated } = await client.products.update(productId, {
        price: {
          paymentPlan: {
            interval: 'month',
            intervalCount: 1,
            planIterations: 6,
          },
        },
      });

      expect(updated.id).toBe(productId);
      expect(updated.price.paymentPlan?.planIterations).toBe(6);
    });

    it('should update pay what you want suggested price', async () => {
      const productId = await createProductWithPrice({
        amount: 1000,
        currency: 'usd',
        payWhatYouWant: true,
      });

      const { data: updated } = await client.products.update(productId, {
        price: { payWhatYouWant: true, pwywSuggestedPrice: 2500 },
      });

      expect(updated.id).toBe(productId);
      expect(updated.price.payWhatYouWant).toBe(true);
      // The legacy `price` alias omits pwywSuggestedPrice — prices[] is canonical.
      expect(updated.prices?.[0]?.payWhatYouWant).toBe(true);
      expect(updated.prices?.[0]?.pwywSuggestedPrice).toBe(2500);
    });

    it('rejects changing a price billing identity after creation', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      await expect(
        client.products.update(testProductId, {
          price: {
            recurring: { interval: 'month', intervalCount: 1 },
          },
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        client.products.update(testProductId, {
          price: { payWhatYouWant: true },
        })
      ).rejects.toThrow(/fixed at creation/);
    });

    it('should update multiple fields simultaneously', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        title: 'Complete Update Test',
        description: 'Testing <b>multiple</b> <i>field</i> updates',
        price: {
          amount: 7900,
          currency: 'usd',
          setupFee: 1000,
          payWhatYouWant: false,
        },
        stock: 50,
        hasUnlimitedStock: false,
        sku: 'MULTI-UPDATE-001',
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.title).toBe('Complete Update Test');
      expect(updated.description).toBeDefined();
      expect(updated.price.amount).toBe(7900);
      expect(updated.price.currency).toBe('usd');
      expect(updated.price.setupFee).toBe(1000);
      expect(updated.price.payWhatYouWant).toBe(false);
      expect(updated.stock).toBe(50);
      expect(updated.hasUnlimitedStock).toBe(false);
      expect(updated.sku).toBe('MULTI-UPDATE-001');
    });
  });

  describe('product-level subscription and file-access settings', () => {
    it('persists enableFileAccessForInactiveSubscriptions across a re-read', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: enabled } = await client.products.update(testProductId, {
        enableFileAccessForInactiveSubscriptions: true,
      });
      expect(enabled.enableFileAccessForInactiveSubscriptions).toBe(true);

      const { data: reread } = await client.products.get(testProductId);
      expect(reread.enableFileAccessForInactiveSubscriptions).toBe(true);

      const { data: disabled } = await client.products.update(testProductId, {
        enableFileAccessForInactiveSubscriptions: false,
      });
      expect(disabled.enableFileAccessForInactiveSubscriptions).toBe(false);
    });

    it('persists the nested limitSubscriptions shape across a re-read', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        limitSubscriptions: {
          enabled: true,
          limitSubscriptionsStripe: { enabled: false },
        },
      });

      expect(updated.limitSubscriptions?.enabled).toBe(true);
      expect(updated.limitSubscriptions?.limitSubscriptionsStripe?.enabled).toBe(false);

      const { data: reread } = await client.products.get(testProductId);
      expect(reread.limitSubscriptions?.enabled).toBe(true);
      expect(reread.limitSubscriptions?.limitSubscriptionsStripe?.enabled).toBe(false);
    });

    it('enables the Stripe-managed subscription limit', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        limitSubscriptions: {
          enabled: true,
          limitSubscriptionsStripe: { enabled: true },
        },
      });

      expect(updated.limitSubscriptions?.limitSubscriptionsStripe?.enabled).toBe(true);

      const { data: reset } = await client.products.update(testProductId, {
        limitSubscriptions: {
          enabled: false,
          limitSubscriptionsStripe: { enabled: false },
        },
      });

      expect(reset.limitSubscriptions?.enabled).toBe(false);
      expect(reset.limitSubscriptions?.limitSubscriptionsStripe?.enabled).toBe(false);
    });

    it('leaves the settings untouched when the update omits them', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      await client.products.update(testProductId, {
        enableFileAccessForInactiveSubscriptions: true,
        limitSubscriptions: { enabled: true, limitSubscriptionsStripe: { enabled: false } },
      });

      const { data: afterUnrelatedUpdate } = await client.products.update(testProductId, {
        title: `Untouched Settings ${uniqueSuffix()}`,
      });

      expect(afterUnrelatedUpdate.enableFileAccessForInactiveSubscriptions).toBe(true);
      expect(afterUnrelatedUpdate.limitSubscriptions?.enabled).toBe(true);
    });
  });

  describe('price references', () => {
    it('keeps the stored reference for a price resent by id and derives one for a new price', async () => {
      const productId = await createProductWithPrice({ amount: 1000, currency: 'usd', reference: 'basic-tier' });
      const { data: product } = await client.products.get(productId);
      const storedPriceId = product.prices![0].id;
      expect(product.prices![0].reference).toBe('basic-tier');

      const { data: updated } = await client.products.update(productId, {
        prices: [
          { id: storedPriceId, billingType: 'one_time', amount: 1000, currency: 'usd' },
          { billingType: 'one_time', amount: 2000, currency: 'usd' },
        ],
      });

      expect(updated.prices!.map((p) => p.reference)).toEqual(['basic-tier', 'price_one_time_fixed_2000']);
    });
  });

  describe('fixedTaxRateIds', () => {
    it('sets fixedTaxRateIds on update', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });

      const { data: updated } = await client.products.update(testProductId, {
        fixedTaxRateIds: [taxRate.data.id],
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.fixedTaxRateIds).toContain(taxRate.data.id);
    });

    it('clears fixedTaxRateIds with []', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });

      await client.products.update(testProductId, {
        fixedTaxRateIds: [taxRate.data.id],
      });

      const { data: cleared } = await client.products.update(testProductId, {
        fixedTaxRateIds: [],
      });

      expect(cleared.id).toBe(testProductId);
      expect(cleared.fixedTaxRateIds).toEqual([]);
    });

    it('omitting fixedTaxRateIds preserves existing', async () => {
      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });

      await client.products.update(testProductId, {
        fixedTaxRateIds: [taxRate.data.id],
      });

      await client.products.update(testProductId, {
        title: `Preserve Rate Test ${uniqueSuffix()}`,
      });

      const { data: fetched } = await client.products.get(testProductId);

      expect(fetched.fixedTaxRateIds).toContain(taxRate.data.id);
    });

    it('returns fixedTaxRateIds in the get response', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });

      await client.products.update(testProductId, {
        fixedTaxRateIds: [taxRate.data.id],
      });

      const { data: fetched } = await client.products.get(testProductId);

      expect(fetched.id).toBe(testProductId);
      expect(fetched.fixedTaxRateIds).toContain(taxRate.data.id);
    });
  });

  describe('multi-price read path', () => {
    it('reads prices[] and defaultPriceId fields on a product', async () => {
      const { data: product } = await client.products.get(testProductId);

      // prices[] may be null/empty on a legacy product – just assert the field exists
      expect('prices' in product).toBe(true);
      expect('defaultPriceId' in product).toBe(true);
    });

    it('reads prices[].billingType correctly', async () => {
      const { data: product } = await client.products.get(testProductId);

      if (product.prices && product.prices.length > 0) {
        const price: Price = product.prices[0];
        expect(['one_time', 'recurring']).toContain(price.billingType);
        expect(typeof price.amount).toBe('number');
        expect(typeof price.currency).toBe('string');
        expect(typeof price.enabled).toBe('boolean');
        expect(typeof price.isDefault).toBe('boolean');
      }
    });

    it('reads variant priceIds scoping', async () => {
      const { data: product } = await client.products.get(testProductId);

      if (product.variants && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        // priceIds is optional – assert the field is either present or absent gracefully
        if (firstVariant.priceIds) {
          expect(Array.isArray(firstVariant.priceIds)).toBe(true);
        }
      }
    });
  });

  describe('multi-price create + read round-trip', () => {
    let multiPriceProductId: string;

    beforeAll(async () => {
      // Create a checkout page whose product carries 3 prices.
      // NOTE: Requires ProductService.create to persist prices[].
      const { data: page } = await client.checkoutPages.create({
        name: `Multi-Price Product Test ${uniqueSuffix()}`,
        productData: {
          prices: [
            {
              billingType: 'one_time',
              amount: 4900,
              currency: 'usd',
              label: 'One-time',
            },
            {
              billingType: 'recurring',
              amount: 1000,
              currency: 'usd',
              label: 'Monthly',
              recurring: { interval: 'month', intervalCount: 1 },
            },
            {
              billingType: 'recurring',
              amount: 9900,
              currency: 'usd',
              label: 'Annual',
              recurring: { interval: 'year', intervalCount: 1 },
            },
          ] as PriceInput[],
        },
      });

      if (page.product?.id) {
        multiPriceProductId = page.product.id;
      }
    });

    it('creates a 3-price product and reads prices[] back', async () => {
      if (!multiPriceProductId) return;

      const { data: product } = await client.products.get(multiPriceProductId);

      expect(product.prices).toBeDefined();
      expect(Array.isArray(product.prices)).toBe(true);
      expect(product.prices!.length).toBe(3);

      const oneTime = product.prices!.find((p) => p.billingType === 'one_time');
      const monthly = product.prices!.find(
        (p) => p.billingType === 'recurring' && p.recurring?.interval === 'month'
      );
      const annual = product.prices!.find(
        (p) => p.billingType === 'recurring' && p.recurring?.interval === 'year'
      );

      expect(oneTime!.amount).toBe(4900);
      expect(monthly!.amount).toBe(1000);
      expect(annual!.amount).toBe(9900);
    });

    it('defaultPriceId is set on the product', async () => {
      if (!multiPriceProductId) return;

      const { data: product } = await client.products.get(multiPriceProductId);

      expect(product.defaultPriceId).toBeDefined();
      const priceIds = (product.prices ?? []).map((p: Price) => p.id);
      expect(priceIds).toContain(product.defaultPriceId);
    });

    it('prices[] fields round-trip with correct billingType', async () => {
      if (!multiPriceProductId) return;

      const { data: product } = await client.products.get(multiPriceProductId);

      for (const price of product.prices ?? []) {
        expect(['one_time', 'recurring']).toContain(price.billingType);
        expect(typeof price.amount).toBe('number');
        expect(typeof price.currency).toBe('string');
        expect(typeof price.enabled).toBe('boolean');
        expect(typeof price.isDefault).toBe('boolean');
      }
    });
  });

  describe('multi-price validator rejections (via checkout-pages/create)', () => {
    it('rejects prices[] with mismatched currencies — 400', async () => {
      let threw = false;
      try {
        await client.checkoutPages.create({
          name: `Currency Mismatch Test ${uniqueSuffix()}`,
          productData: {
            prices: [
              { billingType: 'one_time', amount: 4900, currency: 'usd' },
              { billingType: 'one_time', amount: 4900, currency: 'eur' },
            ] as PriceInput[],
          },
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/400|currency/i);
      }
      expect(threw).toBe(true);
    });

    it('rejects prices: [] (empty array) — 400', async () => {
      let threw = false;
      try {
        await client.checkoutPages.create({
          name: `Empty Prices Test ${uniqueSuffix()}`,
          productData: {
            prices: [] as PriceInput[],
          },
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/400|price/i);
      }
      expect(threw).toBe(true);
    });

    it('rejects when all prices are disabled — 400', async () => {
      let threw = false;
      try {
        await client.checkoutPages.create({
          name: `All Disabled Test ${uniqueSuffix()}`,
          productData: {
            prices: [
              { billingType: 'one_time', amount: 4900, currency: 'usd', enabled: false },
            ] as PriceInput[],
          },
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/400|enabled/i);
      }
      expect(threw).toBe(true);
    });
  });
});
