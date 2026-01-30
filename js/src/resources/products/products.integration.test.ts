import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

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

    // Create a test page with a product to use for testing
    const { data: page } = await client.pages.create({
      name: `Product Test Page ${Date.now()}`,
      type: 'checkout',
      productDetails: {
        price: 4900,
        currency: 'usd',
      },
    });

    // The page creation returns a product ID
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
      expect(product).toHaveProperty('currency');
      expect(product.id).toBe(testProductId);
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
        price: 5900,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.title).toBe('Updated Product Title');
      expect(updated.description).toBe('Updated product description');
      expect(updated.price).toBe(5900);
    });

    it('should update product currency', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        currency: 'eur',
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.currency).toBe('eur');
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

    it('should update subscription interval settings', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        interval: 'month',
        intervalCount: 3,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.interval).toBe('month');
      expect(updated.intervalCount).toBe(3);
    });

    it('should update subscription trial period', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        trialPeriodDays: 14,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.trialPeriodDays).toBe(14);
    });

    it('should update subscription setup fee', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        setupFee: 2500,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.setupFee).toBe(2500);
    });

    it('should update payment plan iterations', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        planIterations: 6,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.planIterations).toBe(6);
    });

    it('should enable pay what you want pricing', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        payWhatYouWant: true,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.payWhatYouWant).toBe(true);
    });

    it('should update multiple fields simultaneously', async () => {
      if (!testProductId) {
        console.log('Skipping: No test product ID available');
        return;
      }

      const { data: updated } = await client.products.update(testProductId, {
        title: 'Complete Update Test',
        description: 'Testing multiple field updates',
        price: 7900,
        currency: 'usd',
        stock: 50,
        hasUnlimitedStock: false,
        sku: 'MULTI-UPDATE-001',
        setupFee: 1000,
        payWhatYouWant: false,
      });

      expect(updated.id).toBe(testProductId);
      expect(updated.title).toBe('Complete Update Test');
      expect(updated.description).toBe('Testing multiple field updates');
      expect(updated.price).toBe(7900);
      expect(updated.currency).toBe('usd');
      expect(updated.stock).toBe(50);
      expect(updated.hasUnlimitedStock).toBe(false);
      expect(updated.sku).toBe('MULTI-UPDATE-001');
      expect(updated.setupFee).toBe(1000);
      expect(updated.payWhatYouWant).toBe(false);
    });
  });
});
