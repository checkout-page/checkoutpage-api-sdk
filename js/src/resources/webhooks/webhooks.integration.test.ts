import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  ConflictError,
  ValidationError,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('WebhookResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdIds: string[] = [];

  const HOOK_URL_PREFIX = 'https://example.com/sdk-hooks/';
  const hookUrl = () => `${HOOK_URL_PREFIX}${uniqueSuffix()}`;

  // A run aborted before afterEach leaks webhooks, and the seller is capped at
  // 10 — without this sweep one bad run wedges every later one.
  beforeAll(async () => {
    config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    const { data: existing } = await client.webhooks.list({ limit: 100 });
    for (const webhook of existing) {
      if (!webhook.url.startsWith(HOOK_URL_PREFIX)) continue;
      try {
        await client.webhooks.delete(webhook.id);
      } catch {
        // Best-effort — a later create will surface a still-full cap.
      }
    }
  });

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      try {
        await client.webhooks.delete(id);
      } catch {
        // Best-effort cleanup — the seller is capped at 10 webhooks.
      }
    }
  });

  it('creates a webhook and returns the secret once', async () => {
    const { data: webhook } = await client.webhooks.create({
      name: `SDK ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid', 'payment.paid', 'subscription.created'],
      customHeaders: { Authorization: 'Bearer receiver-token' },
    });
    createdIds.push(webhook.id);

    expect(webhook.secret.length).toBeGreaterThanOrEqual(10);
    expect(webhook.events).toEqual(['payment.paid', 'subscription.created']);
    expect(webhook.status).toBe('active');
    expect(webhook.customHeaders).toEqual({ Authorization: 'Bearer receiver-token' });
  });

  it('lists webhooks without secrets and filters by event and status', async () => {
    const { data: webhook } = await client.webhooks.create({
      name: `SDK list ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['booking.paid'],
    });
    createdIds.push(webhook.id);

    const all = await client.webhooks.list({ limit: 100 });
    const mine = all.data.find((w) => w.id === webhook.id);
    expect(mine).toBeDefined();
    expect(mine).not.toHaveProperty('secret');
    expect(typeof all.has_more).toBe('boolean');
    expect(all.total).toBeGreaterThanOrEqual(1);

    const byEvent = await client.webhooks.list({ event: 'booking.paid', limit: 100 });
    expect(byEvent.data.some((w) => w.id === webhook.id)).toBe(true);
    const byOtherEvent = await client.webhooks.list({ event: 'ticket.created', limit: 100 });
    expect(byOtherEvent.data.some((w) => w.id === webhook.id)).toBe(false);
    const active = await client.webhooks.list({ status: 'active', limit: 100 });
    expect(active.data.some((w) => w.id === webhook.id)).toBe(true);
    const inactive = await client.webhooks.list({ status: 'inactive', limit: 100 });
    expect(inactive.data.some((w) => w.id === webhook.id)).toBe(false);
  });

  it('deletes a webhook so it no longer lists', async () => {
    const { data: webhook } = await client.webhooks.create({
      name: `SDK delete ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['customer.created'],
    });
    createdIds.push(webhook.id);

    const { data: deleted } = await client.webhooks.delete(webhook.id);
    expect(deleted.id).toBe(webhook.id);

    const listed = await client.webhooks.list({ limit: 100 });
    expect(listed.data.some((w) => w.id === webhook.id)).toBe(false);
  });

  it('rejects http URLs with a ValidationError', async () => {
    await expect(
      client.webhooks.create({
        name: 'insecure',
        url: 'http://example.com/hooks',
        events: ['payment.paid'],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a duplicate URL with a ConflictError', async () => {
    const url = hookUrl();
    const { data: webhook } = await client.webhooks.create({
      name: 'first',
      url,
      events: ['payment.paid'],
    });
    createdIds.push(webhook.id);

    await expect(
      client.webhooks.create({ name: 'second', url, events: ['payment.paid'] })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
