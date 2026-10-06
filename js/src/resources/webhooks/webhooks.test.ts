import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookResource } from './webhooks';
import { CheckoutPageApiClient } from '../../client';
import type {
  CreateWebhookParams,
  CreateWebhookResponse,
  DeleteWebhookResponse,
  UpdateWebhookParams,
  UpdateWebhookResponse,
  Webhook,
  WebhookList,
  WebhookResponse,
} from '../../types';

const WEBHOOK_ID = '507f1f77bcf86cd799439011';

const mockWebhook: Webhook = {
  id: WEBHOOK_ID,
  name: 'CRM sync',
  url: 'https://example.com/hooks',
  events: ['payment.paid'],
  status: 'active',
  apiVersion: 'v1',
  customHeaders: {},
  deliveryCount: 0,
  successCount: 0,
  failureCount: 0,
  lastTriggeredAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

describe('WebhookResource', () => {
  let client: CheckoutPageApiClient;
  let webhooks: WebhookResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    webhooks = new WebhookResource(client);
  });

  describe('list', () => {
    it('GETs the webhooks endpoint with filters and pagination as query params', async () => {
      const mockList: WebhookList = { data: [mockWebhook], has_more: false, total: 1 };
      vi.spyOn(client, 'request').mockResolvedValue(mockList);

      const result = await webhooks.list({
        status: 'active',
        event: 'payment.paid',
        limit: 5,
        starting_after: WEBHOOK_ID,
      });

      expect(result).toEqual(mockList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/webhooks/',
        query: {
          status: 'active',
          event: 'payment.paid',
          limit: '5',
          starting_after: WEBHOOK_ID,
          ending_before: undefined,
        },
      });
    });

    it('sends only undefined values when called without arguments', async () => {
      const emptyList: WebhookList = { data: [], has_more: false, total: 0 };
      vi.spyOn(client, 'request').mockResolvedValue(emptyList);

      await webhooks.list();

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/webhooks/',
        query: {
          status: undefined,
          event: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
      });
    });
  });

  describe('create', () => {
    it('POSTs the params as the body and returns the response with the secret', async () => {
      const mockResponse: CreateWebhookResponse = {
        data: { ...mockWebhook, secret: 'generated' },
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const params: CreateWebhookParams = {
        name: 'CRM sync',
        url: 'https://example.com/hooks',
        events: ['payment.paid'],
        customHeaders: { Authorization: 'Bearer x' },
      };
      const result = await webhooks.create(params);

      expect(result.data.secret).toBe('generated');
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/webhooks/',
        body: params,
      });
    });
  });

  describe('get', () => {
    it('GETs the webhook by id and returns the response', async () => {
      const mockResponse: WebhookResponse = { data: mockWebhook };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await webhooks.get(WEBHOOK_ID);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: `/v1/webhooks/${WEBHOOK_ID}`,
      });
    });

    it('encodes the id in the path', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockWebhook });

      await webhooks.get('a/b?c');

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/webhooks/a%2Fb%3Fc',
      });
    });

    it('throws when the id is empty', async () => {
      const spy = vi.spyOn(client, 'request');

      await expect(webhooks.get('')).rejects.toThrow('Webhook ID is required');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('PATCHes the params as the body and returns the response', async () => {
      const mockResponse: UpdateWebhookResponse = {
        data: {
          ...mockWebhook,
          url: 'https://example.com/hooks/v2',
          events: ['checkout_page.updated', 'product.created'],
          status: 'inactive',
        },
      };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const params: UpdateWebhookParams = {
        name: 'CRM sync v2',
        url: 'https://example.com/hooks/v2',
        events: ['checkout_page.updated', 'product.created'],
        customHeaders: {},
        status: 'inactive',
      };
      const result = await webhooks.update(WEBHOOK_ID, params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/webhooks/${WEBHOOK_ID}`,
        body: params,
      });
    });

    it('sends an empty body as-is', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockWebhook });

      await webhooks.update(WEBHOOK_ID, {});

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: `/v1/webhooks/${WEBHOOK_ID}`,
        body: {},
      });
    });

    it('encodes the id in the path', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({ data: mockWebhook });

      await webhooks.update('a/b?c', { status: 'active' });

      expect(client.request).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/v1/webhooks/a%2Fb%3Fc',
        body: { status: 'active' },
      });
    });

    it('throws when the id is empty', async () => {
      const spy = vi.spyOn(client, 'request');

      await expect(webhooks.update('', { status: 'inactive' })).rejects.toThrow(
        'Webhook ID is required'
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('DELETEs the webhook by id', async () => {
      const mockResponse: DeleteWebhookResponse = { data: mockWebhook };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await webhooks.delete(WEBHOOK_ID);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: `/v1/webhooks/${WEBHOOK_ID}`,
      });
    });

    it('throws when the id is empty', async () => {
      await expect(webhooks.delete('')).rejects.toThrow('Webhook ID is required');
    });
  });
});
