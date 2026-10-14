import { describe, it, expect, vi, beforeEach, expectTypeOf } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { CheckoutPagesResource } from '../checkout-pages/checkout-pages';
import { EventsResource } from '../events/events';
import { OrderBumpsResource } from './order-bumps';
import type { operations } from '../../generated/schema';
import type {
  CreateOrderBumpParams,
  DeleteOrderBumpResponse,
  OrderBump,
  OrderBumpList,
  OrderBumpResponse,
  ReorderOrderBumpsParams,
  UpdateOrderBumpParams,
} from '../../types';

const orderBump = (productId: string, overrides: Partial<OrderBump> = {}): OrderBump => ({
  productId,
  addedAt: '2026-10-14T00:00:00.000Z',
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
  product: { id: productId, title: 'Gift wrapping', currency: 'usd', imageUrl: null },
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
  ...overrides,
});

describe('OrderBumpsResource', () => {
  let client: CheckoutPageApiClient;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
  });

  it('hangs off checkout pages and events', () => {
    expect(new CheckoutPagesResource(client).orderBumps).toBeInstanceOf(OrderBumpsResource);
    expect(new EventsResource(client).orderBumps).toBeInstanceOf(OrderBumpsResource);
  });

  it('shares one set of types because the event endpoints have the same contract', () => {
    expectTypeOf<
      operations['events/order-bumps/list']['responses'][200]['content']['application/json']
    >().toEqualTypeOf<OrderBumpList>();
    expectTypeOf<
      operations['events/order-bumps/update']['responses'][200]['content']['application/json']
    >().toEqualTypeOf<OrderBumpResponse>();
    expectTypeOf<
      NonNullable<
        operations['events/order-bumps/create']['requestBody']
      >['content']['application/json']
    >().toEqualTypeOf<CreateOrderBumpParams>();
    expectTypeOf<
      NonNullable<
        operations['events/order-bumps/update']['requestBody']
      >['content']['application/json']
    >().toEqualTypeOf<UpdateOrderBumpParams>();
    expectTypeOf<
      NonNullable<
        operations['events/order-bumps/reorder']['requestBody']
      >['content']['application/json']
    >().toEqualTypeOf<ReorderOrderBumpsParams>();
    expectTypeOf<
      operations['events/order-bumps/delete']['responses'][200]['content']['application/json']
    >().toEqualTypeOf<DeleteOrderBumpResponse>();
  });

  describe.each([
    {
      name: 'checkout pages',
      make: () => new CheckoutPagesResource(client).orderBumps,
      prefix: 'checkout-pages',
    },
    { name: 'events', make: () => new EventsResource(client).orderBumps, prefix: 'events' },
  ])('on $name', ({ make, prefix }) => {
    let orderBumps: OrderBumpsResource;

    beforeEach(() => {
      orderBumps = make();
    });

    it('lists the order bumps on a page', async () => {
      const mockResponse: OrderBumpList = { data: [orderBump('bump_1'), orderBump('bump_2')] };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await orderBumps.list('page_123');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: `/v1/${prefix}/page_123/order-bumps`,
      });
    });

    it('adds an order bump with its placement settings', async () => {
      const params: CreateOrderBumpParams = {
        productId: 'bump_1',
        preselected: true,
        allowQuantity: true,
        showHideLogic: { enabled: true, subject: 'order_bump', orderBumpProductIds: ['bump_2'] },
      };
      const mockResponse: OrderBumpResponse = {
        data: orderBump('bump_1', { preselected: true, allowQuantity: true }),
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await orderBumps.create('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: `/v1/${prefix}/page_123/order-bumps`,
        body: params,
      });
    });

    it('updates an order bump by its product id', async () => {
      const params: UpdateOrderBumpParams = {
        enabled: false,
        hidden: true,
        shortenDescription: true,
      };
      const mockResponse: OrderBumpResponse = {
        data: orderBump('bump_1', { enabled: false, hidden: true, shortenDescription: true }),
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await orderBumps.update('page_123', 'bump_1', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/${prefix}/page_123/order-bumps/bump_1`,
        body: params,
      });
    });

    it('removes an order bump from a page', async () => {
      const mockResponse: DeleteOrderBumpResponse = {
        data: { success: true, message: 'Order bump removed successfully' },
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await orderBumps.delete('page_123', 'bump_1');

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: `/v1/${prefix}/page_123/order-bumps/bump_1`,
      });
    });

    it('reorders the order bumps on a page', async () => {
      const params: ReorderOrderBumpsParams = { productIds: ['bump_2', 'bump_1'] };
      const mockResponse: OrderBumpList = { data: [orderBump('bump_2'), orderBump('bump_1')] };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await orderBumps.reorder('page_123', params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: `/v1/${prefix}/page_123/order-bumps/reorder`,
        body: params,
      });
    });

    it('requires a page id on every method', async () => {
      const request = vi.spyOn(client, 'request');

      await expect(orderBumps.list('')).rejects.toThrow('Page ID is required');
      await expect(orderBumps.create('', { productId: 'bump_1' })).rejects.toThrow(
        'Page ID is required'
      );
      await expect(orderBumps.update('', 'bump_1', { enabled: true })).rejects.toThrow(
        'Page ID is required'
      );
      await expect(orderBumps.delete('', 'bump_1')).rejects.toThrow('Page ID is required');
      await expect(orderBumps.reorder('', { productIds: [] })).rejects.toThrow(
        'Page ID is required'
      );
      expect(request).not.toHaveBeenCalled();
    });

    it('requires a product id to update or remove', async () => {
      const request = vi.spyOn(client, 'request');

      await expect(orderBumps.update('page_123', '', { enabled: true })).rejects.toThrow(
        'Product ID is required'
      );
      await expect(orderBumps.delete('page_123', '')).rejects.toThrow('Product ID is required');
      expect(request).not.toHaveBeenCalled();
    });
  });
});
