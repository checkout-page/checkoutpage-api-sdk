import type { CheckoutPageApiClient } from '../../client';
import {
  CreateWebhookParams,
  CreateWebhookResponse,
  DeleteWebhookResponse,
  UpdateWebhookParams,
  UpdateWebhookResponse,
  WebhookList,
  WebhookListParams,
  WebhookResponse,
} from '../../types';

export class WebhookResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * Retrieve a single webhook endpoint by ID. The signing secret is never
   * returned — only `create` returns it, and only once.
   *
   * @example
   * const { data: webhook } = await client.webhooks.get(webhookId);
   */
  async get(webhookId: string): Promise<WebhookResponse> {
    if (!webhookId) {
      throw new Error('Webhook ID is required');
    }

    return this.client.request<WebhookResponse>({
      method: 'GET',
      path: `/v1/webhooks/${encodeURIComponent(webhookId)}`,
    });
  }

  /**
   * List webhook endpoints, newest first. Secrets are never returned.
   *
   * @example
   * const { data, has_more } = await client.webhooks.list({ event: 'payment.paid' });
   */
  async list(args: WebhookListParams = {}): Promise<WebhookList> {
    const query: Record<string, string | undefined> = {
      status: args.status,
      event: args.event,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<WebhookList>({
      method: 'GET',
      path: '/v1/webhooks/',
      query,
    });
  }

  /**
   * Create a webhook endpoint. The `url` must use https.
   *
   * The response is the only place the signing `secret` is ever returned —
   * store it immediately. Omit `secret` to have one generated.
   *
   * @example
   * const { data: webhook } = await client.webhooks.create({
   *   name: 'CRM sync',
   *   url: 'https://example.com/hooks/checkoutpage',
   *   events: ['payment.paid', 'subscription.created'],
   * });
   * saveSecret(webhook.secret);
   */
  async create(params: CreateWebhookParams): Promise<CreateWebhookResponse> {
    return this.client.request<CreateWebhookResponse>({
      method: 'POST',
      path: '/v1/webhooks/',
      body: params,
    });
  }

  /**
   * Update a webhook endpoint. Only the fields supplied are changed — omit a
   * field to leave it as-is. `events` and `customHeaders` are replaced
   * wholesale when supplied, not merged. `url` must use https. `status`
   * accepts `active` or `inactive` (`failed` is system-managed).
   *
   * @example
   * const { data: webhook } = await client.webhooks.update(webhookId, {
   *   status: 'inactive',
   * });
   */
  async update(webhookId: string, params: UpdateWebhookParams): Promise<UpdateWebhookResponse> {
    if (!webhookId) {
      throw new Error('Webhook ID is required');
    }

    return this.client.request<UpdateWebhookResponse>({
      method: 'PATCH',
      path: `/v1/webhooks/${webhookId}`,
      body: params,
    });
  }

  /**
   * Delete a webhook endpoint. Deliveries stop immediately; the returned
   * object is its final state and a later `get` of the same id returns 404.
   */
  async delete(webhookId: string): Promise<DeleteWebhookResponse> {
    if (!webhookId) {
      throw new Error('Webhook ID is required');
    }

    return this.client.request<DeleteWebhookResponse>({
      method: 'DELETE',
      path: `/v1/webhooks/${encodeURIComponent(webhookId)}`,
    });
  }
}
