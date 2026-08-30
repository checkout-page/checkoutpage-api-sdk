import type { CheckoutPageApiClient } from '../../client';
import {
  CreateWebhookParams,
  CreateWebhookResponse,
  DeleteWebhookResponse,
  WebhookList,
  WebhookListParams,
} from '../../types';

export class WebhookResource {
  constructor(private client: CheckoutPageApiClient) {}

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
   * Delete a webhook endpoint. Deliveries stop immediately; the returned
   * object is its final state. The webhook no longer appears in `list()`,
   * and deleting the same id again returns 404.
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
