import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxRateResource } from './tax-rates';
import { CheckoutPageApiClient } from '../../client';
import type { TaxRateList, TaxRateResponse } from '../../types';

const mockTaxRate = {
  id: '507f1f77bcf86cd799439011',
  sellerId: 'seller123',
  stripeId: 'txr_1ABC',
  displayName: 'VAT',
  inclusive: true,
  percentage: 20,
  default: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('TaxRateResource', () => {
  let client: CheckoutPageApiClient;
  let taxRateResource: TaxRateResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    taxRateResource = new TaxRateResource(client);
  });

  describe('list', () => {
    it('should fetch all tax rates', async () => {
      const mockList: TaxRateList = { data: [mockTaxRate] };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await taxRateResource.list();

      expect(result).toEqual(mockList);
      expect(result.data).toHaveLength(1);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/tax-rates/',
      });
    });

    it('should return empty list when no tax rates exist', async () => {
      const mockList: TaxRateList = { data: [] };

      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await taxRateResource.list();

      expect(result.data).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create a tax rate with required fields', async () => {
      const mockResponse: TaxRateResponse = { data: mockTaxRate };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await taxRateResource.create({
        displayName: 'VAT',
        inclusive: true,
        percentage: 20,
      });

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tax-rates/',
        body: {
          displayName: 'VAT',
          inclusive: true,
          percentage: 20,
        },
      });
    });

    it('should create a tax rate as default', async () => {
      const mockResponse: TaxRateResponse = {
        data: { ...mockTaxRate, default: true },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await taxRateResource.create({
        displayName: 'VAT',
        inclusive: true,
        percentage: 20,
        default: true,
      });

      expect(result.data.default).toBe(true);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tax-rates/',
        body: {
          displayName: 'VAT',
          inclusive: true,
          percentage: 20,
          default: true,
        },
      });
    });

    it('should not include default in body when not provided', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTaxRate });

      await taxRateResource.create({
        displayName: 'GST',
        inclusive: false,
        percentage: 10,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/tax-rates/',
        body: {
          displayName: 'GST',
          inclusive: false,
          percentage: 10,
        },
      });
    });
  });

  describe('update', () => {
    it('should update display name', async () => {
      const mockResponse: TaxRateResponse = {
        data: { ...mockTaxRate, displayName: 'Sales Tax' },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await taxRateResource.update('507f1f77bcf86cd799439011', {
        displayName: 'Sales Tax',
      });

      expect(result.data.displayName).toBe('Sales Tax');
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/tax-rates/507f1f77bcf86cd799439011',
        body: { displayName: 'Sales Tax' },
      });
    });

    it('should set as default tax rate', async () => {
      const mockResponse: TaxRateResponse = {
        data: { ...mockTaxRate, default: true },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await taxRateResource.update('507f1f77bcf86cd799439011', {
        default: true,
      });

      expect(result.data.default).toBe(true);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/tax-rates/507f1f77bcf86cd799439011',
        body: { default: true },
      });
    });

    it('should update both fields at once', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTaxRate });

      await taxRateResource.update('507f1f77bcf86cd799439011', {
        displayName: 'VAT Updated',
        default: true,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/tax-rates/507f1f77bcf86cd799439011',
        body: { displayName: 'VAT Updated', default: true },
      });
    });

    it('should send empty body when no params provided', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockTaxRate });

      await taxRateResource.update('507f1f77bcf86cd799439011', {});

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/tax-rates/507f1f77bcf86cd799439011',
        body: {},
      });
    });

    it('should throw error for missing tax rate id', async () => {
      await expect(taxRateResource.update('', {})).rejects.toThrow('Tax rate ID is required');
    });
  });
});
