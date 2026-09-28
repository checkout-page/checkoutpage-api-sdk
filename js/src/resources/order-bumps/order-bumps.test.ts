import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { CheckoutPagesResource } from '../checkout-pages/checkout-pages';
import { EventsResource } from '../events/events';
import type { OrderBump, OrderBumpList, OrderBumpResponse } from '../../types';

const orderBump: OrderBump = {
  productId: 'product_bump',
  addedAt: '2026-09-24T08:00:00.000Z',
  enabled: true,
  preselected: false,
  hidden: false,
  showHideLogic: {
    enabled: false,
    subject: 'price',
    comparison: 'is',
    priceId: null,
    ticketTypeIds: [],
    orderBumpProductIds: [],
  },
  allowQuantity: false,
  shortenDescription: false,
  product: { id: 'product_bump', title: 'Gift wrapping', currency: 'usd', imageUrl: null },
  price: {
    amount: 500,
    currency: 'usd',
    billingType: 'one_time',
    interval: null,
    intervalCount: null,
  },
  unavailableReason: null,
  usedOnPageCount: 1,
  hasPurchases: false,
};

describe('OrderBumpsResource', () => {
  let client: CheckoutPageApiClient;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
  });

  describe('on checkout pages', () => {
    let checkoutPages: CheckoutPagesResource;

    beforeEach(() => {
      checkoutPages = new CheckoutPagesResource(client);
    });

    it('lists the order bumps on a page', async () => {
      const response: OrderBumpList = { data: [orderBump] };
      vi.spyOn(client, 'request').mockResolvedValue(response);

      const result = await checkoutPages.orderBumps.list('page_123');

      expect(result).toEqual(response);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/checkout-pages/page_123/order-bumps',
      });
    });

    it('adds an order bump', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: orderBump });

      await checkoutPages.orderBumps.create('page_123', {
        productId: 'product_bump',
        preselected: true,
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/checkout-pages/page_123/order-bumps',
        body: { productId: 'product_bump', preselected: true },
      });
    });

    it('updates an order bump', async () => {
      const response: OrderBumpResponse = { data: { ...orderBump, hidden: true } };
      vi.spyOn(client, 'request').mockResolvedValue(response);

      const result = await checkoutPages.orderBumps.update('page_123', 'product_bump', {
        hidden: true,
        showHideLogic: { enabled: true, subject: 'order_bump', orderBumpProductIds: ['other'] },
      });

      expect(result).toEqual(response);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/checkout-pages/page_123/order-bumps/product_bump',
        body: {
          hidden: true,
          showHideLogic: { enabled: true, subject: 'order_bump', orderBumpProductIds: ['other'] },
        },
      });
    });

    it('removes an order bump', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({
        data: { success: true, message: 'Order bump removed successfully' },
      });

      await checkoutPages.orderBumps.delete('page_123', 'product_bump');

      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/v1/checkout-pages/page_123/order-bumps/product_bump',
      });
    });

    it('reorders the order bumps', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: [orderBump] });

      await checkoutPages.orderBumps.reorder('page_123', { productIds: ['b', 'a'] });

      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/checkout-pages/page_123/order-bumps/reorder',
        body: { productIds: ['b', 'a'] },
      });
    });

    it('requires a page ID and a product ID', async () => {
      await expect(checkoutPages.orderBumps.list('')).rejects.toThrow('Page ID is required');
      await expect(checkoutPages.orderBumps.update('page_123', '', {})).rejects.toThrow(
        'Product ID is required'
      );
      await expect(checkoutPages.orderBumps.delete('page_123', '')).rejects.toThrow(
        'Product ID is required'
      );
    });
  });

  describe('on events', () => {
    it('uses the events path', async () => {
      const events = new EventsResource(client);
      vi.spyOn(client, 'request').mockResolvedValue({ data: [] });

      await events.orderBumps.list('event_123');
      await events.orderBumps.create('event_123', { productId: 'product_bump' });

      expect(client.request).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        path: '/v1/events/event_123/order-bumps',
      });
      expect(client.request).toHaveBeenNthCalledWith(2, {
        method: 'POST',
        path: '/v1/events/event_123/order-bumps',
        body: { productId: 'product_bump' },
      });
    });
  });
});
