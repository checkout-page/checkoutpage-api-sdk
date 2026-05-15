import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('ProductResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let testProductId: string;

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
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: {
          recurring: {
            interval: 'month',
            intervalCount: 3,
          },
        },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.recurring?.interval).toBe('month');
      expect(updated.price.recurring?.intervalCount).toBe(3);
    });

    it('should update subscription trial period', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: {
          recurring: {
            interval: 'month',
            intervalCount: 1,
            trialPeriodDays: 14,
          },
        },
      });

      expect(updated.id).toBe(testProductId);
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

    it('should update to a payment plan', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: {
          paymentPlan: {
            interval: 'month',
            intervalCount: 1,
            planIterations: 6,
          },
        },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.paymentPlan?.planIterations).toBe(6);
    });

    it('should enable pay what you want pricing', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        price: { payWhatYouWant: true },
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.price.payWhatYouWant).toBe(true);
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
});
