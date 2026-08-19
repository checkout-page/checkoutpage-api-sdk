import { describe, expect, it } from 'vitest';
import { createCheckoutPageClient } from './index';
import { AccountResource } from './resources/accounts/accounts';
import { TicketResource } from './resources/tickets/tickets';

describe('CheckoutPageClient', () => {
  it('exposes the accounts resource', () => {
    const client = createCheckoutPageClient({ apiKey: 'test_api_key' });

    expect(client.accounts).toBeInstanceOf(AccountResource);
  });

  it('exposes the tickets resource at the root, matching /v1/tickets', () => {
    const client = createCheckoutPageClient({ apiKey: 'test_api_key' });

    expect(client.tickets).toBeInstanceOf(TicketResource);
    expect(client.events).not.toHaveProperty('tickets');
  });
});
