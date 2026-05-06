import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentResource } from './payments';
import { CheckoutPageApiClient } from '../../client';
import type { PaymentList } from '../../types';

const PAYMENT_ID_1 = '6812fe6e9f39b6760576f01c';
const PAYMENT_ID_2 = '6812fe6e9f39b6760576f01d';
const PAGE_ID = '67fcbdac6a91c25ef2d3534a';
const CUSTOMER_ID = '507f1f77bcf86cd799439010';
const PRODUCT_ID = '507f1f77bcf86cd799439020';
const CURSOR_1 = '507f1f77bcf86cd799439011';
const CURSOR_2 = '507f1f77bcf86cd799439012';

const BASE_PAYMENT: PaymentList['data'][number] = {
  id: PAYMENT_ID_1,
  amount: 10000,
  status: 'paid',
  currency: 'usd',
  taxBreakdown: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const DEFAULT_QUERY = {
  search: undefined,
  status: undefined,
  pageId: undefined,
  customerId: undefined,
  orderId: undefined,
  couponCode: undefined,
  productId: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
  abandonmentStatus: undefined,
  limit: undefined,
  starting_after: undefined,
  ending_before: undefined,
};

describe('PaymentResource', () => {
  let client: CheckoutPageApiClient;
  let paymentResource: PaymentResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    paymentResource = new PaymentResource(client);
  });

  describe('list', () => {
    it('should call the payments endpoint with all default query params when called with no args', async () => {
      const mockPaymentList: PaymentList = { data: [], total: 0, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      await paymentResource.list();

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: DEFAULT_QUERY,
        path: '/v1/payments/',
      });
    });

    it('should return the response from the client', async () => {
      const mockPaymentList: PaymentList = {
        data: [BASE_PAYMENT, { ...BASE_PAYMENT, id: PAYMENT_ID_2, amount: 25000, status: 'pending' }],
        total: 2,
        has_more: false,
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list();

      expect(result).toEqual(mockPaymentList);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty list when no payments exist', async () => {
      const mockPaymentList: PaymentList = { data: [], total: 0, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockPaymentList);

      const result = await paymentResource.list();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    // Pagination

    it('should pass limit as a string', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ limit: 10 });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ limit: '10' }) }),
      );
    });

    it('should pass starting_after for cursor pagination', async () => {
      const mockList: PaymentList = { data: [BASE_PAYMENT], total: 100, has_more: true };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await paymentResource.list({ limit: 10, starting_after: CURSOR_1 });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, limit: '10', starting_after: CURSOR_1 },
        path: '/v1/payments/',
      });
    });

    it('should pass ending_before for cursor pagination', async () => {
      const mockList: PaymentList = { data: [BASE_PAYMENT], total: 100, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await paymentResource.list({ limit: 10, ending_before: CURSOR_2 });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, limit: '10', ending_before: CURSOR_2 },
        path: '/v1/payments/',
      });
    });

    // Existing filters

    it('should pass search param', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ search: 'test@example.com' });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ search: 'test@example.com' }) }),
      );
    });

    it('should pass status filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ status: 'paid' });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ status: 'paid' }) }),
      );
    });

    it('should pass pageId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ pageId: PAGE_ID });

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ pageId: PAGE_ID }) }),
      );
    });

    // New filters

    it('should pass customerId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ customerId: CUSTOMER_ID });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, customerId: CUSTOMER_ID },
        path: '/v1/payments/',
      });
    });

    it('should pass orderId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ orderId: 'ORD-9182' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, orderId: 'ORD-9182' },
        path: '/v1/payments/',
      });
    });

    it('should pass couponCode filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ couponCode: 'SUMMER20' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, couponCode: 'SUMMER20' },
        path: '/v1/payments/',
      });
    });

    it('should pass productId filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ productId: PRODUCT_ID });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, productId: PRODUCT_ID },
        path: '/v1/payments/',
      });
    });

    it('should pass createdAfter filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ createdAfter: '2025-01-01T00:00:00Z' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, createdAfter: '2025-01-01T00:00:00Z' },
        path: '/v1/payments/',
      });
    });

    it('should pass createdBefore filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ createdBefore: '2025-01-31T23:59:59Z' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, createdBefore: '2025-01-31T23:59:59Z' },
        path: '/v1/payments/',
      });
    });

    it('should pass both createdAfter and createdBefore for a date range', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({
        createdAfter: '2025-01-01T00:00:00Z',
        createdBefore: '2025-01-31T23:59:59Z',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          ...DEFAULT_QUERY,
          createdAfter: '2025-01-01T00:00:00Z',
          createdBefore: '2025-01-31T23:59:59Z',
        },
        path: '/v1/payments/',
      });
    });

    it('should pass abandonmentStatus=abandoned', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ abandonmentStatus: 'abandoned' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, abandonmentStatus: 'abandoned' },
        path: '/v1/payments/',
      });
    });

    it('should pass abandonmentStatus=recovered', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [], total: 0, has_more: false });

      await paymentResource.list({ abandonmentStatus: 'recovered' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: { ...DEFAULT_QUERY, abandonmentStatus: 'recovered' },
        path: '/v1/payments/',
      });
    });

    it('should pass all filters together', async () => {
      const mockList: PaymentList = { data: [BASE_PAYMENT], total: 1, has_more: false };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      await paymentResource.list({
        search: 'test@example.com',
        status: 'paid',
        pageId: PAGE_ID,
        customerId: CUSTOMER_ID,
        orderId: 'ORD-9182',
        couponCode: 'SUMMER20',
        productId: PRODUCT_ID,
        createdAfter: '2025-01-01T00:00:00Z',
        createdBefore: '2025-01-31T23:59:59Z',
        abandonmentStatus: 'abandoned',
        limit: 20,
        starting_after: CURSOR_1,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        query: {
          search: 'test@example.com',
          status: 'paid',
          pageId: PAGE_ID,
          customerId: CUSTOMER_ID,
          orderId: 'ORD-9182',
          couponCode: 'SUMMER20',
          productId: PRODUCT_ID,
          createdAfter: '2025-01-01T00:00:00Z',
          createdBefore: '2025-01-31T23:59:59Z',
          abandonmentStatus: 'abandoned',
          limit: '20',
          starting_after: CURSOR_1,
          ending_before: undefined,
        },
        path: '/v1/payments/',
      });
    });
  });
});
