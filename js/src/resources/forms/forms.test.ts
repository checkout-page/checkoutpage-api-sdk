import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { FormsResource } from './forms';
import type { CreateFormParams, UpdateFormParams } from '../../types';

describe('FormsResource', () => {
  let client: CheckoutPageApiClient;
  let formsResource: FormsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    formsResource = new FormsResource(client);
  });

  describe('list', () => {
    it('lists forms and stringifies limit', async () => {
      const mockResponse: any = {
        data: [
          {
            id: 'form_123',
            name: 'Lead form',
            type: 'form',
            status: 'published',
            slug: '/lead-form',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
        total: 1,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await formsResource.list({
        limit: 10,
        status: 'draft',
        search: 'lead',
        starting_after: 'form_120',
        ending_before: 'form_140',
      });

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/forms/',
        query: {
          limit: '10',
          starting_after: 'form_120',
          ending_before: 'form_140',
          status: 'draft',
          search: 'lead',
        },
      });
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const PAGE_1 = {
        data: [
          { id: 'f5', name: 'f5', type: 'form', status: 'published', slug: '/f5', createdAt: '', updatedAt: '' },
          { id: 'f4', name: 'f4', type: 'form', status: 'published', slug: '/f4', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };
      const PAGE_2 = {
        data: [
          { id: 'f3', name: 'f3', type: 'form', status: 'published', slug: '/f3', createdAt: '', updatedAt: '' },
          { id: 'f2', name: 'f2', type: 'form', status: 'published', slug: '/f2', createdAt: '', updatedAt: '' },
        ],
        has_more: true,
        total: 5,
      };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1 as any)
        .mockResolvedValueOnce(PAGE_2 as any)
        .mockResolvedValueOnce({ ...PAGE_1, has_more: false } as any);

      await formsResource.list({ limit: 2 });
      await formsResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await formsResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 'f4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 'f3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates a form', async () => {
      const params: CreateFormParams = {
        name: 'Created form',
        title: 'Created form title',
      };

      const mockResponse: any = {
        data: {
          id: 'form_123',
          name: 'Created form',
          type: 'form',
          status: 'published',
          slug: '/created-form',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await formsResource.create(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/forms/',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when creating a form', async () => {
      const params: CreateFormParams = {
        name: 'Created form',
        title: 'Created form title',
        slug: '/created-form',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'checkout',
            order: 0,
            enabled: true,
            config: {
              pageId: '507f1f77bcf86cd799439012',
            },
          },
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439013',
            },
          },
        ],
      };

      const mockResponse: any = { data: { id: 'form_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await formsResource.create(params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/forms/',
        body: params,
      });
    });
  });

  describe('get', () => {
    it('gets a form by id', async () => {
      const mockResponse: any = {
        data: {
          id: 'form_123',
          name: 'Existing form',
          type: 'form',
          status: 'published',
          slug: '/existing-form',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await formsResource.get('form_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/forms/form_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(formsResource.get('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('updates a form and preserves null payloads', async () => {
      const params: UpdateFormParams = {
        status: 'draft',
        redirectUrl: null,
        notifyEmail: 'owner@example.com',
      };

      const mockResponse: any = {
        data: {
          id: 'form_123',
          name: 'Updated form',
          type: 'form',
          status: 'draft',
          slug: '/updated-form',
          notifyEmail: 'owner@example.com',
          redirectUrl: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await formsResource.update('form_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/forms/form_123',
        body: params,
      });
    });

    it('forwards slug, redirectPageId, and funnelSteps when updating a form', async () => {
      const params: UpdateFormParams = {
        slug: '/updated-form',
        redirectPageId: '507f1f77bcf86cd799439011',
        funnelSteps: [
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'checkout',
              redirectPageId: '507f1f77bcf86cd799439012',
            },
          },
        ],
      };

      const mockResponse: any = { data: { id: 'form_123' } };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      await formsResource.update('form_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/forms/form_123',
        body: params,
      });
    });

    it('throws for missing page id', async () => {
      await expect(formsResource.update('', {})).rejects.toThrow('Page ID is required');
    });
  });

  describe('delete', () => {
    it('archives a form', async () => {
      const mockResponse: any = {
        data: {
          id: 'form_123',
          name: 'Archived form',
          type: 'form',
          status: 'archived',
          slug: '/archived-form',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await formsResource.delete('form_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/forms/form_123',
      });
    });

    it('throws for missing page id', async () => {
      await expect(formsResource.delete('')).rejects.toThrow('Page ID is required');
    });
  });
});
