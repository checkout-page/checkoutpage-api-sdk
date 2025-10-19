import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerResource } from './customers';
import { CheckoutPageClient } from '../../client';
import type { Customer, CustomerList } from '../../types';

describe('CustomerResource', () => {
  let client: CheckoutPageClient;
  let customerResource: CustomerResource;

  beforeEach(() => {
    client = new CheckoutPageClient({ apiKey: 'test_api_key' });
    customerResource = new CustomerResource(client);
  });

  describe('get', () => {
    it('should fetch a customer by id', async () => {
      const mockCustomer: Customer = {
        data: {
          id: '6812fe6e9f39b6760576f01c',
          email: 'test@example.com',
          name: 'Test Customer',
          seller: 'seller123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer);

      const result = await customerResource.get('6812fe6e9f39b6760576f01c');

      expect(result).toEqual(mockCustomer);
      expect(result.data.id).toBe('6812fe6e9f39b6760576f01c');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/customers/6812fe6e9f39b6760576f01c',
      });
    });

    it('should throw error for missing customer id', async () => {
      await expect(customerResource.get('')).rejects.toThrow('Customer ID is required');
    });

    it('should return customer with optional fields', async () => {
      const mockCustomer: Customer = {
        data: {
          id: '6812fe6e9f39b6760576f01c',
          email: 'test@example.com',
          name: 'Test Customer',
          companyName: 'Test Company',
          phone: '+1234567890',
          billingEmail: 'billing@example.com',
          address: {
            line1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
          },
          shipping: {
            name: 'Shipping Name',
            phone: '+0987654321',
            address: {
              line1: '456 Shipping Ave',
              city: 'Los Angeles',
              state: 'CA',
              postalCode: '90001',
              country: 'US',
            },
          },
          taxId: 'tax123',
          taxIdType: 'us_ein',
          seller: 'seller123',
          stripeCustomerId: 'cus_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer);

      const result = await customerResource.get('6812fe6e9f39b6760576f01c');

      expect(result).toEqual(mockCustomer);
      expect(result.data.companyName).toBe('Test Company');
      expect(result.data.address?.city).toBe('San Francisco');
      expect(result.data.shipping?.name).toBe('Shipping Name');
    });
  });

  describe('list', () => {
    it('should fetch a list of customers with default parameters', async () => {
      const mockCustomerList: CustomerList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            email: 'customer1@example.com',
            name: 'Customer 1',
            seller: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '6812fe6e9f39b6760576f01d',
            email: 'customer2@example.com',
            name: 'Customer 2',
            seller: 'seller123',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({});

      expect(result).toEqual(mockCustomerList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {},
        path: '/v1/customers/',
      });
    });

    it('should fetch customers with pagination parameters', async () => {
      const mockCustomerList: CustomerList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            email: 'customer1@example.com',
            name: 'Customer 1',
            seller: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        has_more: true,
        total: 100,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({
        limit: 10,
        skip: 5,
      });

      expect(result).toEqual(mockCustomerList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          limit: '10',
          skip: '5',
        },
        path: '/v1/customers/',
      });
    });

    it('should fetch customers with search parameter', async () => {
      const mockCustomerList: CustomerList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01a',
            email: 'search@example.com',
            name: 'Searched Customer',
            seller: 'seller123',
            createdAt: '2023-12-31T00:00:00.000Z',
            updatedAt: '2023-12-31T00:00:00.000Z',
          },
        ],
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({
        search: 'search@example.com',
        limit: 10,
      });

      expect(result).toEqual(mockCustomerList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'search@example.com',
          limit: '10',
        },
        path: '/v1/customers/',
      });
    });

    it('should return empty list when no customers exist', async () => {
      const mockCustomerList: CustomerList = {
        data: [],
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({});

      expect(result).toEqual(mockCustomerList);
      expect(result.data).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });

    it('should fetch customers with all optional fields populated', async () => {
      const mockCustomerList: CustomerList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            email: 'customer@example.com',
            name: 'Full Customer',
            companyName: 'Test Company',
            phone: '+1234567890',
            billingEmail: 'billing@example.com',
            address: {
              line1: '123 Main St',
              line2: 'Suite 100',
              city: 'San Francisco',
              state: 'CA',
              postalCode: '94105',
              country: 'US',
            },
            shipping: {
              name: 'Shipping Name',
              phone: '+0987654321',
              address: {
                line1: '456 Shipping Ave',
                city: 'Los Angeles',
                state: 'CA',
                postalCode: '90001',
                country: 'US',
              },
            },
            taxId: 'tax123',
            taxIdType: 'us_ein',
            seller: 'seller123',
            stripeCustomerId: 'cus_123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomerList);

      const result = await customerResource.list({ limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].companyName).toBe('Test Company');
      expect(result.data[0].address?.line2).toBe('Suite 100');
      expect(result.data[0].shipping?.address?.city).toBe('Los Angeles');
    });
  });
});
