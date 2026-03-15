import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { CheckoutPagesResource } from './checkout-pages';
import type {
  CheckoutPageFieldDeleteResponse,
  CheckoutPageFieldList,
  CheckoutPageFieldResponse,
} from '../../types';

describe('CheckoutPagesResource fields', () => {
  let client: CheckoutPageApiClient;
  let checkoutPagesResource: CheckoutPagesResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    checkoutPagesResource = new CheckoutPagesResource(client);
  });

  it('lists all fields for a checkout page', async () => {
    const mockResponse: CheckoutPageFieldList = {
      data: [
        {
          id: 'field-default',
          label: 'Email',
          element: 'email',
          required: true,
          order: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'field-custom',
          label: 'Company Name',
          element: 'text',
          required: false,
          order: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await checkoutPagesResource.fields.list('page_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/checkout-pages/page_123/fields',
    });
  });

  it('creates a checkout page field', async () => {
    const mockResponse: CheckoutPageFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Shipping Address',
        element: 'text',
        required: false,
        order: 2,
        showHideLogic: {
          enabled: true,
          comparison: 'IS',
          value: 'option_123',
          element: {
            elementId: 'field_source',
            elementType: 'field',
            elementTitle: 'Shipping Method',
          },
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    };

    const params = {
      label: 'Shipping Address',
      element: 'text' as const,
      showHideLogic: {
        enabled: true,
        comparison: 'IS' as const,
        value: 'option_123',
        element: {
          elementId: 'field_source',
        },
      },
      defaultValue: null,
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await checkoutPagesResource.fields.create('page_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/checkout-pages/page_123/fields',
      body: params,
    });
  });

  it('gets a checkout page field by id', async () => {
    const mockResponse: CheckoutPageFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Company Name',
        element: 'text',
        required: false,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await checkoutPagesResource.fields.get('page_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/checkout-pages/page_123/fields/field_123',
    });
  });

  it('updates a checkout page field and preserves nullable payloads', async () => {
    const mockResponse: CheckoutPageFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Updated Label',
        element: 'text',
        required: true,
        order: 1,
        placeholder: undefined,
        defaultValue: undefined,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    };

    const params = {
      label: 'Updated Label',
      placeholder: null,
      defaultValue: null,
      minValue: null,
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await checkoutPagesResource.fields.update('page_123', 'field_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/checkout-pages/page_123/fields/field_123',
      body: params,
    });
  });

  it('deletes a checkout page field', async () => {
    const mockResponse: CheckoutPageFieldDeleteResponse = {
      success: true,
      message: 'Field deleted successfully',
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await checkoutPagesResource.fields.delete('page_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/checkout-pages/page_123/fields/field_123',
    });
  });

  it('throws for missing page ids or field ids', async () => {
    await expect(checkoutPagesResource.fields.list('')).rejects.toThrow('Page ID is required');
    await expect(checkoutPagesResource.fields.create('', { label: 'Field' })).rejects.toThrow(
      'Page ID is required'
    );
    await expect(checkoutPagesResource.fields.get('page_123', '')).rejects.toThrow(
      'Field ID is required'
    );
    await expect(
      checkoutPagesResource.fields.update('page_123', '', { label: 'Field' })
    ).rejects.toThrow('Field ID is required');
    await expect(checkoutPagesResource.fields.delete('page_123', '')).rejects.toThrow(
      'Field ID is required'
    );
  });
});
