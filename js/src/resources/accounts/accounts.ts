import type { CheckoutPageApiClient } from '../../client';
import type { Account } from '../../types';

export class AccountResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve the seller account the API key belongs to: store slug, display
   * name and logo.
   *
   * The endpoint wraps the account in a `data` envelope (the OpenAPI spec
   * documents the bare object); this unwraps it so callers get the account.
   */
  async get(): Promise<Account> {
    const response = await this.client.request<{ data: Account }>({
      method: 'GET',
      path: '/v1/account/',
    });

    return response.data;
  }
}
