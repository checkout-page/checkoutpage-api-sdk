import { beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('ThemePropertiesResource integration tests', () => {
  let client: CheckoutPageClient;

  const config = loadIntegrationConfig();

  beforeAll(() => {
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch the full set of theme properties', async () => {
      const result = await client.themeProperties.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
      expect(result.data.length).toBeGreaterThan(0);

      for (const property of result.data) {
        expect(property).toHaveProperty('path');
        expect(property).toHaveProperty('type');
        expect(property).toHaveProperty('description');
        expect(typeof property.path).toBe('string');
        expect(typeof property.type).toBe('string');
        expect(typeof property.description).toBe('string');
      }
    });

    it('should filter by pathPrefix', async () => {
      const baseline = await client.themeProperties.list();
      const target = baseline.data.find((p) => p.path.includes('.'));
      if (!target) {
        throw new Error('No theme property with a nested path found for pathPrefix test');
      }
      const prefix = target.path.slice(0, target.path.lastIndexOf('.'));

      const result = await client.themeProperties.list({ pathPrefix: prefix });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      for (const property of result.data) {
        expect(property.path.startsWith(prefix)).toBe(true);
      }
    });

    it('should support searching by description or path substring', async () => {
      const baseline = await client.themeProperties.list();
      const target = baseline.data[0];
      if (!target) {
        throw new Error('No theme property found for search test');
      }

      const result = await client.themeProperties.list({ search: target.path });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.some((p) => p.path === target.path)).toBe(true);
    });

    it('should combine search and pathPrefix filters', async () => {
      const baseline = await client.themeProperties.list();
      const target = baseline.data.find((p) => p.path.includes('.'));
      if (!target) {
        throw new Error('No theme property with a nested path found for combined filter test');
      }
      const prefix = target.path.slice(0, target.path.lastIndexOf('.'));

      const result = await client.themeProperties.list({
        pathPrefix: prefix,
        search: target.path,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.some((p) => p.path === target.path)).toBe(true);
      for (const property of result.data) {
        expect(property.path.startsWith(prefix)).toBe(true);
      }
    });

    it('should return an empty list for a pathPrefix that matches nothing', async () => {
      const result = await client.themeProperties.list({
        pathPrefix: 'this-prefix-does-not-exist-anywhere',
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
