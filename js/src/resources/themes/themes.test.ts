import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeResource } from './themes';
import { CheckoutPageApiClient } from '../../client';
import type {
  CreateThemeParams,
  CreateThemeResponse,
  DeleteThemeResponse,
  Theme,
  ThemeList,
  ThemeResponse,
  UpdateThemeParams,
  UpdateThemeResponse,
} from '../../types';

const THEME_ID = '507f1f77bcf86cd799439011';
const BASE_THEME_ID = '507f1f77bcf86cd799439012';

const mockTheme: Theme = {
  id: THEME_ID,
  name: 'Brand',
  scope: 'seller',
  deprecated: false,
  variables: { tokens: { colorPrimary: { light: '#4f46e5' } } },
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

describe('ThemeResource', () => {
  let client: CheckoutPageApiClient;
  let themes: ThemeResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    themes = new ThemeResource(client);
  });

  describe('list', () => {
    it('GETs the themes endpoint with scope and pagination as query params', async () => {
      const mockList: ThemeList = { data: [mockTheme], has_more: false, total: 1 };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await themes.list({
        scope: 'seller',
        limit: 5,
        starting_after: BASE_THEME_ID,
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/themes/',
        query: {
          scope: 'seller',
          limit: '5',
          starting_after: BASE_THEME_ID,
          ending_before: undefined,
        },
      });
    });

    it('sends only undefined values when called without arguments', async () => {
      const emptyList: ThemeList = { data: [], has_more: false, total: 0 };
      vi.spyOn(client, 'request').mockResolvedValue(emptyList);

      await themes.list();

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/themes/',
        query: {
          scope: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
      });
    });
  });

  describe('get', () => {
    it('GETs the theme by id and returns the response', async () => {
      const mockResponse: ThemeResponse = { data: mockTheme };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await themes.get(THEME_ID);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: `/v1/themes/${THEME_ID}`,
      });
    });

    it('encodes the id in the path', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTheme });

      await themes.get('a/b?c');

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/themes/a%2Fb%3Fc',
      });
    });

    it('throws when the id is empty', async () => {
      const spy = vi.spyOn(client, 'request');

      await expect(themes.get('')).rejects.toThrow('Theme ID is required');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('POSTs the params as the body and returns the response', async () => {
      const mockResponse: CreateThemeResponse = { data: mockTheme };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const params: CreateThemeParams = {
        name: 'Brand',
        baseThemeId: BASE_THEME_ID,
        variables: { tokens: { colorPrimary: { light: '#4f46e5' }, radius: null } },
      };
      const result = await themes.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/themes/',
        body: params,
      });
    });
  });

  describe('update', () => {
    it('PATCHes the params as the body, keeping null resets', async () => {
      const mockResponse: UpdateThemeResponse = {
        data: { ...mockTheme, name: 'Brand v2', variables: null },
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const params: UpdateThemeParams = { name: 'Brand v2', variables: { tokens: null } };
      const result = await themes.update(THEME_ID, params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/themes/${THEME_ID}`,
        body: params,
      });
    });

    it('encodes the id in the path', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTheme });

      await themes.update('a/b?c', { name: 'Brand' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/themes/a%2Fb%3Fc',
        body: { name: 'Brand' },
      });
    });

    it('throws when the id is empty', async () => {
      const spy = vi.spyOn(client, 'request');

      await expect(themes.update('', { name: 'Brand' })).rejects.toThrow('Theme ID is required');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('DELETEs the theme by id and returns the deleted theme', async () => {
      const mockResponse: DeleteThemeResponse = { data: mockTheme };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await themes.delete(THEME_ID);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: `/v1/themes/${THEME_ID}`,
      });
    });

    it('encodes the id in the path', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTheme });

      await themes.delete('a/b?c');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/themes/a%2Fb%3Fc',
      });
    });

    it('throws when the id is empty', async () => {
      const spy = vi.spyOn(client, 'request');

      await expect(themes.delete('')).rejects.toThrow('Theme ID is required');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
