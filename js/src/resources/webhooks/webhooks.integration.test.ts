import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  ConflictError,
  NotFoundError,
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

  it('gets a webhook by id without the secret', async () => {
    const { data: created } = await client.webhooks.create({
      name: `SDK get ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(created.id);

    const { data: fetched } = await client.webhooks.get(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(created.name);
    expect(fetched).not.toHaveProperty('secret');
  });

  it('rejects get of a deleted webhook with a NotFoundError', async () => {
    const { data: created } = await client.webhooks.create({
      name: `SDK get deleted ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(created.id);

    await client.webhooks.delete(created.id);

    await expect(client.webhooks.get(created.id)).rejects.toBeInstanceOf(NotFoundError);
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

  it('updates name, status, and events, and the change is reflected on get', async () => {
    const { data: created } = await client.webhooks.create({
      name: `SDK update ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(created.id);

    const { data: updated } = await client.webhooks.update(created.id, {
      name: 'Renamed via SDK',
      status: 'inactive',
      events: ['booking.paid', 'booking.paid', 'ticket.created'],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed via SDK');
    expect(updated.status).toBe('inactive');
    expect(updated.events).toEqual(['booking.paid', 'ticket.created']);
    expect(updated).not.toHaveProperty('secret');

    const { data: fetched } = await client.webhooks.get(created.id);
    expect(fetched.name).toBe('Renamed via SDK');
    expect(fetched.status).toBe('inactive');
    expect(fetched.events).toEqual(['booking.paid', 'ticket.created']);
  });

  it('rejects an http URL update with a ValidationError', async () => {
    const { data: created } = await client.webhooks.create({
      name: `SDK update http ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(created.id);

    await expect(
      client.webhooks.update(created.id, { url: 'http://example.com/insecure' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects updating to a URL already used by another webhook with a ConflictError', async () => {
    const takenUrl = hookUrl();
    const { data: taken } = await client.webhooks.create({
      name: `SDK update taken-url ${uniqueSuffix()}`,
      url: takenUrl,
      events: ['payment.paid'],
    });
    createdIds.push(taken.id);

    const { data: toUpdate } = await client.webhooks.create({
      name: `SDK update dup ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(toUpdate.id);

    await expect(
      client.webhooks.update(toUpdate.id, { url: takenUrl }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
