import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponResource } from './coupons';
import { CheckoutPageApiClient } from '../../client';
import { CouponList, CreateCouponResponse } from '../../types';

describe('CouponResource', () => {
  let client: CheckoutPageApiClient;
  let couponResource: CouponResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
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

  describe('create', () => {
    it('should create an amount-off coupon', async () => {
      const mockCoupon: CreateCouponResponse = {
        data: {
          id: '67ee075004de439ab0b675b6',
          label: 'Spring Sale',
          code: 'SPRING25',
          amountOff: 2500,
          currency: 'usd',
          percentOff: null,
          appliesToSetupFee: false,
          duration: 'once',
          durationInMonths: 0,
          timesRedeemed: 0,
          deleted: false,
          sellerId: 'seller123',
          stripeCouponId: 'jMT0WJUD',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCoupon);

      const result = await couponResource.create({
        type: 'amount',
        label: 'Spring Sale',
        code: 'SPRING25',
        amountOff: 2500,
        currency: 'usd',
        duration: 'once',
      });

      expect(result).toEqual(mockCoupon);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/coupons/',
        body: {
          label: 'Spring Sale',
          code: 'SPRING25',
          amountOff: 2500,
          currency: 'usd',
          duration: 'once',
        },
      });
    });

    it('should create a percentage-off coupon', async () => {
      const mockCoupon: CreateCouponResponse = {
        data: {
          id: '67ee075004de439ab0b675b7',
          label: 'Clearance Sale',
          code: 'CLEAR50',
          amountOff: null,
          currency: undefined,
          percentOff: 50,
          appliesToSetupFee: true,
          duration: 'forever',
          durationInMonths: 0,
          timesRedeemed: 0,
          deleted: false,
          stripeCouponId: 'jMT0WJUD',
          sellerId: 'seller123',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCoupon);

      const result = await couponResource.create({
        type: 'percent',
        label: 'Clearance Sale',
        code: 'CLEAR50',
        percentOff: 50,
        duration: 'forever',
        appliesToSetupFee: true,
      });

      expect(result).toEqual(mockCoupon);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/coupons/',
        body: {
          label: 'Clearance Sale',
          code: 'CLEAR50',
          percentOff: 50,
          duration: 'forever',
          appliesToSetupFee: true,
        },
      });
    });

    it('should create a repeating coupon with durationInMonths', async () => {
      const mockCoupon: CreateCouponResponse = {
        data: {
          id: '67ee075004de439ab0b675b8',
          label: 'Summer Special',
          code: 'SUMMER20',
          amountOff: 1000,
          currency: 'eur',
          percentOff: null,
          appliesToSetupFee: false,
          duration: 'repeating',
          durationInMonths: 3,
          timesRedeemed: 0,
          deleted: false,
          stripeCouponId: 'jMT0WJUD',
          sellerId: 'seller123',
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCoupon);

      const result = await couponResource.create({
        type: 'amount',
        label: 'Summer Special',
        code: 'SUMMER20',
        amountOff: 1000,
        currency: 'eur',
        duration: 'repeating',
        durationInMonths: 3,
      });

      expect(result).toEqual(mockCoupon);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/coupons/',
        body: {
          label: 'Summer Special',
          code: 'SUMMER20',
          amountOff: 1000,
          currency: 'eur',
          duration: 'repeating',
          durationInMonths: 3,
        },
      });
    });

    it('should create a coupon with optional fields', async () => {
      const mockCoupon: CreateCouponResponse = {
        data: {
          id: '67ee075004de439ab0b675b9',
          label: 'Winter Sale',
          code: 'WINTER30',
          amountOff: 3000,
          currency: 'gbp',
          percentOff: null,
          appliesToSetupFee: true,
          duration: 'repeating',
          durationInMonths: 6,
          timesRedeemed: 0,
          deleted: false,
          stripeCouponId: 'jMT0WJUD',
          sellerId: 'seller123',
          pageIds: ['page1', 'page2'],
          maxRedemptions: 100,
          redeemBy: '2025-12-31T23:59:59.000Z',
          createdAt: '2024-01-04T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockCoupon);

      const result = await couponResource.create({
        type: 'amount',
        label: 'Winter Sale',
        code: 'WINTER30',
        amountOff: 3000,
        currency: 'gbp',
        duration: 'repeating',
        durationInMonths: 6,
        appliesToSetupFee: true,
        pageIds: ['page1', 'page2'],
        maxRedemptions: 100,
        redeemBy: '2025-12-31T23:59:59.000Z',
      });

      expect(result).toEqual(mockCoupon);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/coupons/',
        body: {
          label: 'Winter Sale',
          code: 'WINTER30',
          amountOff: 3000,
          currency: 'gbp',
          duration: 'repeating',
          durationInMonths: 6,
          appliesToSetupFee: true,
          pageIds: ['page1', 'page2'],
          maxRedemptions: 100,
          redeemBy: '2025-12-31T23:59:59.000Z',
        },
      });
    });
  });
});
