import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  CheckoutPageClient,
  createCheckoutPageClient,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

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

  it('creates a webhook with a secret', async () => {
    const { data: webhook } = await client.webhooks.create({
      name: `SDK ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid', 'payment.paid', 'subscription.created'],
      customHeaders: { Authorization: 'Bearer receiver-token' },
      secret: 'not-very-secret',
    });
    createdIds.push(webhook.id);

    expect(webhook.secret).toBe('not-very-secret');
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

  it('gets a webhook by id without the secret', async () => {
    const { data: created } = await client.webhooks.create({
      name: `sdk-it-get ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid', 'checkout_page.created'],
      customHeaders: { Authorization: 'Bearer receiver-token' },
    });
    createdIds.push(created.id);

    const { data: fetched } = await client.webhooks.get(created.id);

    const { secret, ...createdWithoutSecret } = created;
    expect(secret.length).toBeGreaterThanOrEqual(10);
    expect(fetched).toEqual(createdWithoutSecret);
    expect(fetched).not.toHaveProperty('secret');
  });

  it('updates a webhook, reads the update back, then deletes it', async () => {
    const { data: created } = await client.webhooks.create({
      name: `sdk-it-update ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
      customHeaders: { 'X-Old': 'old' },
    });
    createdIds.push(created.id);

    const name = `sdk-it-updated ${uniqueSuffix()}`;
    const url = hookUrl();
    const { data: updated } = await client.webhooks.update(created.id, {
      name,
      url,
      events: ['checkout_page.updated', 'product.created', 'product.created'],
      customHeaders: { 'X-New': 'new' },
      status: 'inactive',
    });

    expect(updated).toMatchObject({
      id: created.id,
      name,
      url,
      events: ['checkout_page.updated', 'product.created'],
      customHeaders: { 'X-New': 'new' },
      status: 'inactive',
    });
    expect(updated).not.toHaveProperty('secret');
    expect(await client.webhooks.get(created.id)).toEqual({ data: updated });

    const { data: resumed } = await client.webhooks.update(created.id, { status: 'active' });
    expect(resumed).toMatchObject({
      name,
      url,
      events: ['checkout_page.updated', 'product.created'],
      customHeaders: { 'X-New': 'new' },
      status: 'active',
    });
    expect(await client.webhooks.get(created.id)).toEqual({ data: resumed });

    await client.webhooks.delete(created.id);
    await expect(client.webhooks.get(created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns a NotFoundError for an unknown id on get and update', async () => {
    const missingId = fakeObjectId('missing');

    const get = client.webhooks.get(missingId);
    await expect(get).rejects.toBeInstanceOf(NotFoundError);
    await expect(get).rejects.toThrow('Webhook not found');

    const update = client.webhooks.update(missingId, { status: 'inactive' });
    await expect(update).rejects.toBeInstanceOf(NotFoundError);
    await expect(update).rejects.toThrow('Webhook not found');
  });

  it('rejects updating to a URL another webhook uses with a ConflictError', async () => {
    const { data: first } = await client.webhooks.create({
      name: `sdk-it-conflict-a ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(first.id);
    const { data: second } = await client.webhooks.create({
      name: `sdk-it-conflict-b ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(second.id);

    await expect(client.webhooks.update(second.id, { url: first.url })).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  it('rejects an http URL on update with a ValidationError', async () => {
    const { data: webhook } = await client.webhooks.create({
      name: `sdk-it-http ${uniqueSuffix()}`,
      url: hookUrl(),
      events: ['payment.paid'],
    });
    createdIds.push(webhook.id);

    await expect(
      client.webhooks.update(webhook.id, { url: 'http://example.com/hooks' })
    ).rejects.toBeInstanceOf(ValidationError);
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
