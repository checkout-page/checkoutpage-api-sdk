import { beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { AuthenticationError } from '../../errors';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('AccountResource integration tests', () => {
  let client: CheckoutPageClient;

  const config = loadIntegrationConfig();

  beforeAll(() => {
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('get', () => {
    it('returns the account the API key belongs to', async () => {
      const account = await client.accounts.get();

      expect(typeof account.id).toBe('string');
      expect(account.id).not.toHaveLength(0);
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('displayName');
      expect(account).toHaveProperty('logo');
    });

    it('resolves to the seller the test API key is scoped to', async () => {
      if (!config.testSellerId) {
        throw new Error('TEST_SELLER_ID must be set to verify account scoping');
      }

      const account = await client.accounts.get();

      expect(account.id).toBe(config.testSellerId);
    });

    it('returns the store slug and display name as strings or null', async () => {
      const account = await client.accounts.get();

      for (const field of ['name', 'displayName'] as const) {
        const value = account[field];
        expect(value === null || typeof value === 'string').toBe(true);
      }
    });

    it('returns a logo with a url, or null when none is set', async () => {
      const account = await client.accounts.get();

      if (account.logo === null) {
        expect(account.logo).toBeNull();
        return;
      }

      expect(typeof account.logo.url).toBe('string');
      expect(account.logo.url).not.toHaveLength(0);
    });

    it('rejects an invalid API key', async () => {
      const unauthorized = createCheckoutPageClient({
        apiKey: 'sk_invalid_key_for_testing',
        baseUrl: config.baseUrl,
      });

      await expect(unauthorized.accounts.get()).rejects.toThrow(AuthenticationError);
    });
  });
});
