import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { NotFoundError } from '../../errors';
import { AccountResource } from './accounts';

describe('AccountResource', () => {
  let client: CheckoutPageApiClient;
  let resource: AccountResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    resource = new AccountResource(client);
  });

  describe('get', () => {
    it('GETs /v1/account/ and unwraps the data envelope', async () => {
      const account = {
        id: '507f1f77bcf86cd799439011',
        name: 'mystore',
        displayName: 'My Store',
        logo: { url: 'https://cdn.example.com/logo.png' },
      };
      vi.spyOn(client, 'request').mockResolvedValue({ data: account } as any);

      const result = await resource.get();

      expect(result).toEqual(account);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/account/',
      });
    });

    it('returns an account with a null logo', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({
        data: {
          id: '507f1f77bcf86cd799439011',
          name: 'mystore',
          displayName: null,
          logo: null,
        },
      } as any);

      const result = await resource.get();

      expect(result.logo).toBeNull();
      expect(result.displayName).toBeNull();
    });

    it('propagates errors from the client', async () => {
      vi.spyOn(client, 'request').mockRejectedValue(new NotFoundError('Account not found'));

      await expect(resource.get()).rejects.toThrow(NotFoundError);
    });
  });
});
