import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { FormsResource } from './forms';
import type { FormFieldDeleteResponse, FormFieldList, FormFieldResponse } from '../../types';

describe('FormsResource fields', () => {
  let client: CheckoutPageApiClient;
  let formsResource: FormsResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    formsResource = new FormsResource(client);
  });

  it('lists all fields for a form', async () => {
    const mockResponse: FormFieldList = {
      data: [
        {
          id: 'field-default',
          label: 'Email address',
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

    const result = await formsResource.fields.list('form_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/forms/form_123/fields',
    });
  });

  it('creates a form field', async () => {
    const mockResponse: FormFieldResponse = {
      data: {
        id: 'field_123',
        label: 'Shipping Address',
        element: 'text',
        required: false,
        order: 2,
        showHideLogic: {
          enabled: true,
          comparison: 'is',
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
        comparison: 'is' as const,
        value: 'option_123',
        element: {
          elementId: 'field_source',
        },
      },
      defaultValue: null,
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await formsResource.fields.create('form_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/forms/form_123/fields',
      body: params,
    });
  });

  it('gets a form field by id', async () => {
    const mockResponse: FormFieldResponse = {
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

    const result = await formsResource.fields.get('form_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/forms/form_123/fields/field_123',
    });
  });

  it('updates a form field and preserves nullable payloads', async () => {
    const mockResponse: FormFieldResponse = {
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

    const result = await formsResource.fields.update('form_123', 'field_123', params);

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/forms/form_123/fields/field_123',
      body: params,
    });
  });

  it('deletes a form field and keeps the response wrapped', async () => {
    const mockResponse: { data: FormFieldDeleteResponse } = {
      data: {
        success: true,
        message: 'Field deleted successfully',
      },
    };

    vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

    const result = await formsResource.fields.delete('form_123', 'field_123');

    expect(result).toEqual(mockResponse);
    expect(client.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/forms/form_123/fields/field_123',
    });
  });

  it('throws for missing page ids or field ids', async () => {
    await expect(formsResource.fields.list('')).rejects.toThrow('Page ID is required');
    await expect(formsResource.fields.create('', { label: 'Field' })).rejects.toThrow(
      'Page ID is required'
    );
    await expect(formsResource.fields.get('form_123', '')).rejects.toThrow('Field ID is required');
    await expect(formsResource.fields.update('form_123', '', { label: 'Field' })).rejects.toThrow(
      'Field ID is required'
    );
    await expect(formsResource.fields.delete('form_123', '')).rejects.toThrow(
      'Field ID is required'
    );
  });
});
