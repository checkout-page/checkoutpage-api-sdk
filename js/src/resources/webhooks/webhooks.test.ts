import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookResource } from './webhooks';
import { CheckoutPageApiClient } from '../../client';
import type {
  CreateWebhookParams,
  CreateWebhookResponse,
  DeleteWebhookResponse,
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

  describe('get', () => {
    it('GETs the webhook by id', async () => {
      const mockResponse: WebhookResponse = { data: mockWebhook };
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await webhooks.get(WEBHOOK_ID);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: `/v1/webhooks/${WEBHOOK_ID}`,
      });
    });

    it('throws when the id is empty', async () => {
      await expect(webhooks.get('')).rejects.toThrow('Webhook ID is required');
    });
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
