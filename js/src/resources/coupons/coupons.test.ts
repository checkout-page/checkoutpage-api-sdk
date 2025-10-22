import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponResource } from './coupons';
import { CheckoutPageClient } from '../../client';
import { CouponList } from '../../types';

describe('CouponResource', () => {
  let client: CheckoutPageClient;
  let couponResource: CouponResource;

  beforeEach(() => {
    client = new CheckoutPageClient({ apiKey: 'test_api_key' });
    couponResource = new CouponResource(client);
  });

  describe('list', () => {
    it('should fetch a list of coupons with default parameters', async () => {
      const mockCouponList: CouponList = {
        data: [
          {
            id: '67ee075004de439ab0b675b6',
            label: 'Summer 20% Off',
            code: 'SUMMER20',
            amountOff: null,
            percentOff: 20,
            appliesToSetupFee: false,
            duration: 'repeating',
            durationInMonths: 3,
            timesRedeemed: 5,
            deleted: false,
            sellerId: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '67ee075004de439ab0b675b7',
            label: 'Holiday Special',
            code: 'HOLIDAY25',
            amountOff: 25,
            currency: 'usd',
            percentOff: null,
            appliesToSetupFee: true,
            duration: 'once',
            timesRedeemed: 10,
            deleted: false,
            sellerId: 'seller123',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        has_more: false,
        total: 2,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCouponList);

      const result = await couponResource.list();

      expect(result).toEqual(mockCouponList);
      expect(result.data).toHaveLength(2);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: undefined,
          skip: undefined,
        },
        path: '/v1/coupons/',
      });
    });

    it('should fetch coupons with pagination parameters', async () => {
      const mockCouponList: CouponList = {
        data: [
          {
            id: '67ee075004de439ab0b675b6',
            label: 'Summer 20% Off',
            code: 'SUMMER20',
            amountOff: null,
            percentOff: 20,
            appliesToSetupFee: false,
            duration: 'repeating',
            durationInMonths: 3,
            timesRedeemed: 5,
            deleted: false,
            sellerId: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        has_more: true,
        total: 100,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCouponList);

      const result = await couponResource.list({
        limit: 10,
        skip: 5,
      });

      expect(result).toEqual(mockCouponList);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(100);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: undefined,
          limit: '10',
          skip: '5',
        },
        path: '/v1/coupons/',
      });
    });

    it('should fetch coupons with search parameter', async () => {
      const mockCouponList: CouponList = {
        data: [
          {
            id: '67ee075004de439ab0b675b6',
            label: 'Summer 20% Off',
            code: 'SUMMER20',
            amountOff: null,
            percentOff: 20,
            appliesToSetupFee: false,
            duration: 'repeating',
            durationInMonths: 3,
            timesRedeemed: 5,
            deleted: false,
            sellerId: 'seller123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        has_more: false,
        total: 1,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCouponList);

      const result = await couponResource.list({
        search: 'SUMMER',
        limit: 10,
      });

      expect(result).toEqual(mockCouponList);
      expect(result.data[0].code).toBe('SUMMER20');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'SUMMER',
          limit: '10',
          skip: undefined,
        },
        path: '/v1/coupons/',
      });
    });

    it('should return empty list when no coupons exist', async () => {
      const mockCouponList: CouponList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCouponList);

      const result = await couponResource.list();

      expect(result).toEqual(mockCouponList);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });
});
