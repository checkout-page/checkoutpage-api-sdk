import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, ValidationError } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import {
  AmountNonRepeating,
  AmountRepeating,
  PercentNonRepeating,
  PercentRepeating,
} from '../../types';
import { ConflictError } from '../../errors';

describe('CouponResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = new CheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch a list of coupons', async () => {
      const result = await client.coupons.list();

      expect(result).toHaveProperty('data');
      expect(result.total).toBeGreaterThan(0);
      expect(result).toHaveProperty('has_more');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.coupons.list({
        limit: 2,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect skip pagination parameter', async () => {
      const firstPage = await client.coupons.list({
        limit: 1,
      });

      const secondPage = await client.coupons.list({
        limit: 1,
        skip: 1,
      });

      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
    });

    it('should filter coupons by search query', async () => {
      const result = await client.coupons.list({
        search: 'integrationtest',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should return empty array when search has no matches', async () => {
      const result = await client.coupons.list({
        search: 'nonexistent-coupon-12345',
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    it('should handle multiple query parameters together', async () => {
      const result = await client.coupons.list({
        limit: 2,
        skip: 0,
        search: 'test',
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(typeof result.has_more).toBe('boolean');
    });
  });

  describe('create', () => {
    it('should create an amount-off coupon', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Integration Test Amount Coupon',
        code: `TEST_AMOUNT_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      const { data } = await client.coupons.create(params);

      expect(data.id).toBeTypeOf('string');
      expect(data.label).toBe(params.label);
      expect(data.code).toBe(params.code);
      expect(data.amountOff).toBe(params.amountOff);
      expect(data.currency).toBe(params.currency);
      expect(data.duration).toBe(params.duration);
      expect(data).not.toHaveProperty('durationInMonths');
      expect(data).not.toHaveProperty('percentOff');
      expect(data.timesRedeemed).toBe(0);
      expect(data.deleted).toBe(false);
      expect(data.sellerId).toBe(config.testSellerId);
      expect(data.stripeCouponId).toBeTypeOf('string');
      const updatedAt = new Date(data.updatedAt);
      expect(updatedAt instanceof Date && !isNaN(updatedAt.getTime())).toBe(true);
      const createdAt = new Date(data.createdAt);
      expect(createdAt instanceof Date && !isNaN(createdAt.getTime())).toBe(true);
    });

    it('should create an amount-off repeating coupon', async () => {
      const params: AmountRepeating = {
        type: 'amount',
        label: 'Integration Test Amount Coupon',
        code: `TEST_AMOUNT_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'repeating',
        durationInMonths: 12,
      };

      const { data } = await client.coupons.create(params);

      expect(data.id).toBeTypeOf('string');
      expect(data.label).toBe(params.label);
      expect(data.code).toBe(params.code);
      expect(data.amountOff).toBe(params.amountOff);
      expect(data.currency).toBe(params.currency);
      expect(data.duration).toBe(params.duration);
      expect(data.durationInMonths).toBe(params.durationInMonths);
      expect(data).not.toHaveProperty('percentOff');
      expect(data.timesRedeemed).toBe(0);
      expect(data.deleted).toBe(false);
      expect(data.sellerId).toBe(config.testSellerId);
      expect(data.stripeCouponId).toBeTypeOf('string');
      const updatedAt = new Date(data.updatedAt);
      expect(updatedAt instanceof Date && !isNaN(updatedAt.getTime())).toBe(true);
      const createdAt = new Date(data.createdAt);
      expect(createdAt instanceof Date && !isNaN(createdAt.getTime())).toBe(true);
    });

    it('should create a percentage-off coupon', async () => {
      const params: PercentNonRepeating = {
        type: 'percent',
        label: 'Integration Test Percent Coupon',
        code: `TEST_PERCENT_${Date.now()}`,
        percentOff: 25,
        duration: 'forever',
      };

      const { data } = await client.coupons.create(params);

      expect(data.id).toBeTypeOf('string');
      expect(data.label).toBe(params.label);
      expect(data.code).toBe(params.code);
      expect(data.percentOff).toBe(params.percentOff);
      expect(data.duration).toBe(params.duration);
      expect(data).not.toHaveProperty('durationInMonths');
      expect(data).not.toHaveProperty('amountOff');
      expect(data).not.toHaveProperty('currency');
      expect(data.timesRedeemed).toBe(0);
      expect(data.deleted).toBe(false);
      expect(data.sellerId).toBe(config.testSellerId);
      expect(data.stripeCouponId).toBeTypeOf('string');
      const updatedAt = new Date(data.updatedAt);
      expect(updatedAt instanceof Date && !isNaN(updatedAt.getTime())).toBe(true);
      const createdAt = new Date(data.createdAt);
      expect(createdAt instanceof Date && !isNaN(createdAt.getTime())).toBe(true);
    });

    it('should create a percentage-off repeating coupon', async () => {
      const params: PercentRepeating = {
        type: 'percent',
        label: 'Integration Test Percent Coupon',
        code: `TEST_PERCENT_${Date.now()}`,
        percentOff: 25,
        duration: 'repeating',
        durationInMonths: 10,
      };

      const { data } = await client.coupons.create(params);

      expect(data.id).toBeTypeOf('string');
      expect(data.label).toBe(params.label);
      expect(data.code).toBe(params.code);
      expect(data.percentOff).toBe(params.percentOff);
      expect(data.duration).toBe(params.duration);
      expect(data.durationInMonths).toBe(params.durationInMonths);
      expect(data).not.toHaveProperty('amountOff');
      expect(data).not.toHaveProperty('currency');
      expect(data.timesRedeemed).toBe(0);
      expect(data.deleted).toBe(false);
      expect(data.sellerId).toBe(config.testSellerId);
      expect(data.stripeCouponId).toBeTypeOf('string');
      const updatedAt = new Date(data.updatedAt);
      expect(updatedAt instanceof Date && !isNaN(updatedAt.getTime())).toBe(true);
      const createdAt = new Date(data.createdAt);
      expect(createdAt instanceof Date && !isNaN(createdAt.getTime())).toBe(true);
    });

    it('should handle duplicate coupon codes gracefully', async () => {
      const code = `TEST_DUPLICATE_${Date.now()}`;
      const params1: AmountNonRepeating = {
        type: 'amount',
        label: 'First Coupon',
        code,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      const { data: firstCoupon } = await client.coupons.create(params1);
      expect(firstCoupon.code).toBe(code);

      // Attempt to create second coupon with same code should fail
      const params2: AmountNonRepeating = {
        type: 'amount',
        label: 'Second Coupon',
        code,
        amountOff: 2000,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params2)).rejects.toThrow(ConflictError);
    });

    it('newly created coupon should appear in list', async () => {
      const code = `TEST_LIST_${Date.now()}`;
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'List Test Coupon',
        code,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      const { data: createdCoupon } = await client.coupons.create(params);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const list = await client.coupons.list({ search: code });

      const foundCoupon = list.data.find((c) => c.id === createdCoupon.id);
      expect(foundCoupon).toBeDefined();
      expect(foundCoupon?.code).toBe(code);
    });

    it('should handle very large amount values', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Large Amount Test',
        code: `TEST_LARGE_${Date.now()}`,
        amountOff: 999999999,
        currency: 'usd',
        duration: 'once',
      };

      const { data } = await client.coupons.create(params);

      expect(data.amountOff).toBe(params.amountOff);
    });

    it('should accept coupon with special characters in label', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: '50% Off - Summer Sale! 🎉',
        code: `TEST_SPECIAL_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      const { data } = await client.coupons.create(params);

      expect(data.label).toBe(params.label);
    });

    it('should handle max redemptions constraint', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Max Redemptions Test',
        code: `TEST_MAX_REDEEM_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
        maxRedemptions: 50,
      };

      const { data } = await client.coupons.create(params);

      expect(data.maxRedemptions).toBe(50);
    });

    it('should handle redeem by date constraint', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const redeemByDate = futureDate.toISOString();

      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Redeem By Test',
        code: `TEST_REDEEM_BY_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
        redeemBy: redeemByDate,
      };

      const { data } = await client.coupons.create(params);

      expect(data.redeemBy).toBe(redeemByDate);
    });

    it('should handle applies to setup fee flag', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Setup Fee Test',
        code: `TEST_SETUP_FEE_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
        appliesToSetupFee: true,
      };

      const { data } = await client.coupons.create(params);

      expect(data.appliesToSetupFee).toBe(true);
    });
  });

  describe('create - validation errors', () => {
    it('should fail when code has invalid characters', async () => {
      const codeWithSpaces = `  TEST_SPACES_${Date.now()}  `;
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Spaces Test',
        code: codeWithSpaces,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with empty coupon code', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Test Coupon',
        code: '',
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with negative amount off', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Test Coupon',
        code: `TEST_NEG_${Date.now()}`,
        amountOff: -1000,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with zero amount off', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: 'Test Coupon',
        code: `TEST_ZERO_${Date.now()}`,
        amountOff: 0,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with percentage over 100', async () => {
      const params: PercentNonRepeating = {
        type: 'percent',
        label: 'Test Coupon',
        code: `TEST_OVER100_${Date.now()}`,
        percentOff: 150,
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with negative percentage off', async () => {
      const params: PercentNonRepeating = {
        type: 'percent',
        label: 'Test Coupon',
        code: `TEST_NEG_PERCENT_${Date.now()}`,
        percentOff: -25,
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with zero percentage off', async () => {
      const params: PercentNonRepeating = {
        type: 'percent',
        label: 'Test Coupon',
        code: `TEST_ZERO_PERCENT_${Date.now()}`,
        percentOff: 0,
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with negative duration in months', async () => {
      const params: AmountRepeating = {
        type: 'amount',
        label: 'Test Coupon',
        code: `TEST_NEG_MONTHS_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'repeating',
        durationInMonths: -5,
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with zero duration in months', async () => {
      const params: AmountRepeating = {
        type: 'amount',
        label: 'Test Coupon',
        code: `TEST_ZERO_MONTHS_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'repeating',
        durationInMonths: 0,
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with invalid currency code', async () => {
      const params = {
        type: 'amount',
        label: 'Test Coupon',
        code: `TEST_INVALID_CURR_${Date.now()}`,
        amountOff: 1000,
        currency: 'invalid',
        duration: 'once',
      } as unknown as AmountNonRepeating;

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });

    it('should fail with empty label', async () => {
      const params: AmountNonRepeating = {
        type: 'amount',
        label: '',
        code: `TEST_EMPTY_LABEL_${Date.now()}`,
        amountOff: 1000,
        currency: 'usd',
        duration: 'once',
      };

      await expect(client.coupons.create(params)).rejects.toThrow(ValidationError);
    });
  });
});
