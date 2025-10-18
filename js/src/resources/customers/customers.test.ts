import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CustomerResource } from './customers'
import { CheckoutPageClient } from '../../client'
import type { Customer } from '../../types'

describe('CustomerResource', () => {
  let client: CheckoutPageClient
  let customerResource: CustomerResource

  beforeEach(() => {
    client = new CheckoutPageClient({ apiKey: 'test_api_key' })
    customerResource = new CustomerResource(client)
  })

  describe('get', () => {
    it('should fetch a customer by id', async () => {
      const mockCustomer: Customer = {
        id: '6812fe6e9f39b6760576f01c',
        email: 'test@example.com',
        name: 'Test Customer',
        seller: 'seller123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer)

      const result = await customerResource.get('6812fe6e9f39b6760576f01c')

      expect(result).toEqual(mockCustomer)
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/customers/6812fe6e9f39b6760576f01c',
      })
    })

    it('should throw error for missing customer id', async () => {
      await expect(customerResource.get('')).rejects.toThrow('Customer ID is required')
    })

    it('should return customer with optional fields', async () => {
      const mockCustomer: Customer = {
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
      }

      vi.spyOn(client, 'request').mockResolvedValue(mockCustomer)

      const result = await customerResource.get('6812fe6e9f39b6760576f01c')

      expect(result).toEqual(mockCustomer)
      expect(result.companyName).toBe('Test Company')
      expect(result.address?.city).toBe('San Francisco')
      expect(result.shipping?.name).toBe('Shipping Name')
    })
  })
})
