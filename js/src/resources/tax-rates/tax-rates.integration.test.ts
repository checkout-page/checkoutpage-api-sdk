import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, NotFoundError } from '../../index';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('TaxRateResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  it('should create a tax rate', async () => {
    if (!client) return;

    const result = await client.taxRates.create({
      displayName: `VAT ${uniqueSuffix()}`,
      inclusive: true,
      percentage: 20,
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBeDefined();
    expect(result.data.inclusive).toBe(true);
    expect(result.data.percentage).toBe(20);
  });

  it('should list tax rates', async () => {
    if (!client) return;

    const result = await client.taxRates.list();

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should update a tax rate display name', async () => {
    if (!client) return;

    const created = await client.taxRates.create({
      displayName: `GST ${uniqueSuffix()}`,
      inclusive: false,
      percentage: 10,
    });

    const newName = `GST Updated ${uniqueSuffix()}`;
    const updated = await client.taxRates.update(created.data.id, {
      displayName: newName,
    });

    expect(updated.data.id).toBe(created.data.id);
    expect(updated.data.displayName).toBe(newName);
  });

  it('should set a tax rate as default', async () => {
    if (!client) return;

    const created = await client.taxRates.create({
      displayName: `Sales Tax ${uniqueSuffix()}`,
      inclusive: false,
      percentage: 8,
    });

    const updated = await client.taxRates.update(created.data.id, {
      default: true,
    });

    expect(updated.data.default).toBe(true);
  });

  describe('delete', () => {
    const createdIds: string[] = [];

    afterAll(async () => {
      // Deleting an already-deleted rate is a no-op on the API, so this is safe after a passing test.
      for (const id of createdIds.splice(0)) {
        try {
          await client.taxRates.delete(id);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }
    });

    it('should delete a tax rate and drop it from list', async () => {
      const created = await client.taxRates.create({
        displayName: `sdk-it-delete ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 7.5,
      });
      createdIds.push(created.data.id);

      const before = await client.taxRates.list();
      expect(before.data.map((taxRate) => taxRate.id)).toContain(created.data.id);

      const deleted = await client.taxRates.delete(created.data.id);

      expect(deleted.data.id).toBe(created.data.id);
      expect(deleted.data.displayName).toBe(created.data.displayName);
      expect(deleted.data.stripeId).toBe(created.data.stripeId);
      expect(deleted.data.default).toBe(false);

      const after = await client.taxRates.list();
      expect(after.data.map((taxRate) => taxRate.id)).not.toContain(created.data.id);
    });

    it('should throw NotFoundError for an unknown tax rate id', async () => {
      await expect(client.taxRates.delete(fakeObjectId('missing-tax-rate'))).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
