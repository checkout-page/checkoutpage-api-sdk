import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageFieldResource } from './fields';
import { CheckoutPageApiClient } from '../../client';
import type { PageFieldList, CreatePageFieldParams, UpdatePageFieldParams } from '../../types';

describe('PageFieldResource', () => {
  let client: CheckoutPageApiClient;
  let pageFieldResource: PageFieldResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    pageFieldResource = new PageFieldResource(client);
  });

  describe('list', () => {
    it('should fetch fields for a page', async () => {
      const mockFieldList: PageFieldList = {
        data: [
          {
            id: 'field_123',
            type: 'text',
            label: 'Email',
            required: true,
            order: 0,
          },
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockFieldList);

      const result = await pageFieldResource.list('page_123');

      expect(result).toEqual(mockFieldList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/pages/page_123/fields',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageFieldResource.list('')).rejects.toThrow('Page ID is required');
    });
  });

  describe('create', () => {
    it('should create a field with required fields', async () => {
      const params: CreatePageFieldParams = {
        type: 'text',
        label: 'Email',
      };

      const mockResponse: PageFieldList = {
        data: [
          {
            id: 'field_123',
            type: 'text',
            label: 'Email',
            required: false,
            order: 0,
          },
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageFieldResource.create('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/fields',
        body: {
          type: 'text',
          label: 'Email',
        },
      });
    });

    it('should create field with optional fields', async () => {
      const params: CreatePageFieldParams = {
        type: 'select',
        label: 'Country',
        placeholder: 'Select country',
        helpText: 'Choose your country',
        required: true,
        options: ['USA', 'UK', 'Canada'],
      };

      vi.spyOn(client, 'request').mockResolvedValue({ data: [] });

      await pageFieldResource.create('page_123', params);

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/pages/page_123/fields',
        body: {
          type: 'select',
          label: 'Country',
          placeholder: 'Select country',
          helpText: 'Choose your country',
          required: true,
          options: ['USA', 'UK', 'Canada'],
        },
      });
    });

    it('should throw error for missing page id', async () => {
      const params: CreatePageFieldParams = { type: 'text', label: 'Test' };
      await expect(pageFieldResource.create('', params)).rejects.toThrow('Page ID is required');
    });
  });

  describe('update', () => {
    it('should update a field', async () => {
      const params: UpdatePageFieldParams = {
        label: 'Updated Label',
        required: true,
      };

      const mockResponse: PageFieldList = {
        data: [
          {
            id: 'field_123',
            type: 'text',
            label: 'Updated Label',
            required: true,
            order: 0,
          },
        ],
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await pageFieldResource.update('page_123', 'field_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/pages/page_123/fields/field_123',
        body: {
          label: 'Updated Label',
          required: true,
        },
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageFieldResource.update('', 'field_123', {})).rejects.toThrow(
        'Page ID is required'
      );
    });

    it('should throw error for missing field id', async () => {
      await expect(pageFieldResource.update('page_123', '', {})).rejects.toThrow(
        'Field ID is required'
      );
    });
  });

  describe('delete', () => {
    it('should delete a field', async () => {
      vi.spyOn(client, 'request').mockResolvedValue(undefined);

      await pageFieldResource.delete('page_123', 'field_123');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/pages/page_123/fields/field_123',
      });
    });

    it('should throw error for missing page id', async () => {
      await expect(pageFieldResource.delete('', 'field_123')).rejects.toThrow(
        'Page ID is required'
      );
    });

    it('should throw error for missing field id', async () => {
      await expect(pageFieldResource.delete('page_123', '')).rejects.toThrow(
        'Field ID is required'
      );
    });
  });
});
