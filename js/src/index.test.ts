import { describe, expect, it } from 'vitest';
import { createCheckoutPageClient } from './index';
import { AccountResource } from './resources/accounts/accounts';

describe('CheckoutPageClient', () => {
  it('exposes the accounts resource', () => {
    const client = createCheckoutPageClient({ apiKey: 'test_api_key' });

    expect(client.accounts).toBeInstanceOf(AccountResource);
  });
});
