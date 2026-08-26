import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { ThemePropertiesResource } from './theme-properties';

describe('ThemePropertiesResource', () => {
  let client: CheckoutPageApiClient;
  let resource: ThemePropertiesResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    resource = new ThemePropertiesResource(client);
  });

  describe('list', () => {
    it('GETs /v1/theme-properties/ with no filters', async () => {
      const mockResponse = { data: [], has_more: false, total: 0 } as any;
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await resource.list();

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/theme-properties/',
        query: {
          search: undefined,
          pathPrefix: undefined,
        },
      });
    });

    it('forwards search and pathPrefix filters', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({
        data: [],
        has_more: false,
        total: 0,
      } as any);

      await resource.list({
        search: 'color',
        pathPrefix: 'variables.tokens',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/theme-properties/',
        query: {
          search: 'color',
          pathPrefix: 'variables.tokens',
        },
      });
    });

    it('returns the wrapped envelope verbatim (data + has_more + total)', async () => {
      const payload = {
        data: [
          {
            path: 'variables.tokens.colorPrimary',
            type: 'color',
            description: 'Primary accent color.',
            defaultValue: '#171717',
          },
          {
            path: 'variables.tokens.fontFamily',
            type: 'font',
            description: 'Base font family.',
            options: [{ value: 'inter', label: 'Inter' }],
          },
        ],
        has_more: false,
        total: 2,
      } as any;
      vi.spyOn(client, 'request').mockResolvedValue(payload);

      const result = await resource.list();

      expect(result).toBe(payload);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.has_more).toBe(false);
    });
  });
});
