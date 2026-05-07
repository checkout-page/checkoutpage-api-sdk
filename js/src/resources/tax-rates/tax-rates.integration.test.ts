import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { uniqueSuffix } from '../../test-helpers/test-lib';
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
});
