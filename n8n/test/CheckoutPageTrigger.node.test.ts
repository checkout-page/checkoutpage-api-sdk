import { createHmac } from 'crypto';
import {
  NodeApiError,
  NodeOperationError,
  type IDataObject,
  type INodePropertyOptions,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
  CheckoutPageTrigger,
  WEBHOOK_EVENTS,
} from '../nodes/CheckoutPageTrigger/CheckoutPageTrigger.node';
import { apiError, hookContext, requestOptions, webhookContext } from './helpers';

const BASE = 'https://api.checkoutpage.com';
const WEBHOOK_URL = 'https://n8n.example.com/webhook/abc/webhook';
const trigger = new CheckoutPageTrigger();
const hooks = trigger.webhookMethods.default;

function webhookRecord(overrides: IDataObject = {}): IDataObject {
  return {
    id: 'wh_1',
    url: WEBHOOK_URL,
    events: ['booking.created', 'payment.paid'],
    status: 'active',
    ...overrides,
  };
}

describe('description', () => {
  it('is a webhook trigger with no inputs', () => {
    expect(trigger.description.name).toBe('checkoutPageTrigger');
    expect(trigger.description.group).toEqual(['trigger']);
    expect(trigger.description.inputs).toEqual([]);
    expect(trigger.description.webhooks).toEqual([
      { name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
    ]);
  });

  it('offers every webhook event in the spec', async () => {
    const spec = (await import('../../spec/openapi.json')).default as IDataObject;
    const webhooksPath = (spec.paths as Record<string, IDataObject>)['/v1/webhooks/'];
    const findEventEnum = (node: unknown): string[] | undefined => {
      if (!node || typeof node !== 'object') return undefined;
      const values = (node as IDataObject).enum as string[] | undefined;
      if (values?.includes('booking.created') && values.includes('ticket.created')) return values;
      for (const child of Object.values(node as IDataObject)) {
        const found = findEventEnum(child);
        if (found) return found;
      }
      return undefined;
    };
    const resolve = (node: unknown): unknown => {
      const ref = (node as IDataObject | undefined)?.$ref;
      if (typeof ref !== 'string') return node;
      return ref
        .replace('#/', '')
        .split('/')
        .reduce<unknown>((current, key) => (current as IDataObject)[key], spec);
    };
    const requestSchema = resolve(
      (((webhooksPath.post as IDataObject).requestBody as IDataObject).content as IDataObject)[
        'application/json'
      ]
    );
    const specEvents =
      findEventEnum(requestSchema) ??
      findEventEnum(resolve((requestSchema as IDataObject)?.schema));
    expect(specEvents).toBeDefined();
    expect([...WEBHOOK_EVENTS].sort()).toEqual([...(specEvents as string[])].sort());

    const events = trigger.description.properties.find((p) => p.name === 'events');
    expect(events?.type).toBe('multiOptions');
    const options = events?.options as INodePropertyOptions[];
    expect(options.map((o) => o.value)).toEqual([...WEBHOOK_EVENTS]);
    expect(options[0].name).toBe('Booking Abandoned');
  });
});

describe('create', () => {
  it('POSTs /v1/webhooks/ for the selected events and stores the id and secret', async () => {
    const { context, http, staticData } = hookContext(
      { events: ['booking.created', 'payment.paid'] },
      [{ data: webhookRecord({ secret: 'secret-from-api' }) }]
    );
    expect(await hooks.create.call(context)).toBe(true);

    const options = requestOptions(http);
    expect(http.mock.calls[0][0]).toBe('checkoutPageApi');
    expect(options.method).toBe('POST');
    expect(options.url).toBe(`${BASE}/v1/webhooks/`);
    const body = options.body as IDataObject;
    expect(body).toMatchObject({
      name: 'n8n: Bookings to Sheets',
      url: WEBHOOK_URL,
      events: ['booking.created', 'payment.paid'],
    });
    expect(body.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(staticData).toEqual({ webhookId: 'wh_1', webhookSecret: 'secret-from-api' });
  });

  it('keeps the secret it sent when the response leaves it out', async () => {
    const { context, http, staticData } = hookContext({ events: ['booking.created'] }, [
      { data: webhookRecord() },
    ]);
    await hooks.create.call(context);
    expect(staticData.webhookSecret).toBe((requestOptions(http).body as IDataObject).secret);
  });

  it('sends a new random secret each time', async () => {
    const first = hookContext({ events: ['booking.created'] }, [{ data: webhookRecord() }]);
    const second = hookContext({ events: ['booking.created'] }, [{ data: webhookRecord() }]);
    await hooks.create.call(first.context);
    await hooks.create.call(second.context);
    expect(first.staticData.webhookSecret).not.toBe(second.staticData.webhookSecret);
  });

  it('caps the webhook name at 100 characters', async () => {
    const { context, http } = hookContext(
      { events: ['booking.created'] },
      [{ data: webhookRecord() }],
      { workflowName: 'x'.repeat(200) }
    );
    await hooks.create.call(context);
    expect(((requestOptions(http).body as IDataObject).name as string).length).toBe(100);
  });

  it('replaces a leftover webhook for the same URL when the API reports a conflict', async () => {
    const { context, http, staticData } = hookContext({ events: ['booking.created'] }, [
      apiError(409, 'A webhook with this URL already exists'),
      {
        data: [
          webhookRecord({ id: 'wh_other', url: 'https://elsewhere.example.com' }),
          webhookRecord({ id: 'wh_old' }),
        ],
        has_more: false,
      },
      { data: webhookRecord({ id: 'wh_old' }) },
      { data: webhookRecord({ id: 'wh_new' }) },
    ]);
    expect(await hooks.create.call(context)).toBe(true);
    expect(requestOptions(http, 1).method).toBe('GET');
    expect(requestOptions(http, 1).url).toBe(`${BASE}/v1/webhooks/`);
    expect(requestOptions(http, 2).method).toBe('DELETE');
    expect(requestOptions(http, 2).url).toBe(`${BASE}/v1/webhooks/wh_old`);
    expect(requestOptions(http, 3).method).toBe('POST');
    expect(staticData.webhookId).toBe('wh_new');
  });

  it('refuses an http webhook URL before calling the API', async () => {
    const { context, http } = hookContext({ events: ['booking.created'] }, [], {
      webhookUrl: 'http://localhost:5678/webhook-test/abc/webhook',
    });
    await expect(hooks.create.call(context)).rejects.toBeInstanceOf(NodeOperationError);
    expect(http).not.toHaveBeenCalled();
  });

  it("surfaces the API's message, for example the 10-webhook limit", async () => {
    const { context, staticData } = hookContext({ events: ['booking.created'] }, [
      apiError(400, 'The maximum of 10 webhooks has been reached'),
    ]);
    const error = await hooks.create.call(context).catch((e) => e);
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('The maximum of 10 webhooks has been reached');
    expect(staticData).toEqual({});
  });
});

describe('checkExists', () => {
  it('returns false without calling the API when nothing is stored', async () => {
    const { context, http } = hookContext({ events: ['booking.created'] }, []);
    expect(await hooks.checkExists.call(context)).toBe(false);
    expect(http).not.toHaveBeenCalled();
  });

  it('GETs the stored webhook and returns true when it matches', async () => {
    const { context, http, staticData } = hookContext(
      { events: ['payment.paid', 'booking.created'] },
      [{ data: webhookRecord() }],
      { staticData: { webhookId: 'wh_1', webhookSecret: 's' } }
    );
    expect(await hooks.checkExists.call(context)).toBe(true);
    expect(requestOptions(http).method).toBe('GET');
    expect(requestOptions(http).url).toBe(`${BASE}/v1/webhooks/wh_1`);
    expect(staticData).toEqual({ webhookId: 'wh_1', webhookSecret: 's' });
  });

  it('clears static data and returns false when the webhook is gone', async () => {
    const { context, staticData } = hookContext(
      { events: ['booking.created'] },
      [apiError(404, 'Webhook not found')],
      { staticData: { webhookId: 'wh_1', webhookSecret: 's' } }
    );
    expect(await hooks.checkExists.call(context)).toBe(false);
    expect(staticData).toEqual({});
  });

  it('deletes and forgets a webhook whose events changed', async () => {
    const { context, http, staticData } = hookContext(
      { events: ['booking.created'] },
      [{ data: webhookRecord() }, { data: webhookRecord() }],
      { staticData: { webhookId: 'wh_1', webhookSecret: 's' } }
    );
    expect(await hooks.checkExists.call(context)).toBe(false);
    expect(requestOptions(http, 1).method).toBe('DELETE');
    expect(requestOptions(http, 1).url).toBe(`${BASE}/v1/webhooks/wh_1`);
    expect(staticData).toEqual({});
  });

  it('deletes and forgets a webhook that points at another URL (test vs production)', async () => {
    const { context, http, staticData } = hookContext(
      { events: ['booking.created', 'payment.paid'] },
      [
        { data: webhookRecord({ url: 'https://n8n.example.com/webhook-test/abc/webhook' }) },
        { data: {} },
      ],
      { staticData: { webhookId: 'wh_1', webhookSecret: 's' } }
    );
    expect(await hooks.checkExists.call(context)).toBe(false);
    expect(requestOptions(http, 1).method).toBe('DELETE');
    expect(staticData).toEqual({});
  });

  it('does not reuse a webhook whose secret was lost', async () => {
    const { context, staticData } = hookContext(
      { events: ['booking.created', 'payment.paid'] },
      [{ data: webhookRecord() }, { data: {} }],
      { staticData: { webhookId: 'wh_1' } }
    );
    expect(await hooks.checkExists.call(context)).toBe(false);
    expect(staticData).toEqual({});
  });

  it('rethrows other API errors', async () => {
    const { context, staticData } = hookContext(
      { events: ['booking.created'] },
      [apiError(401, 'Invalid API key')],
      { staticData: { webhookId: 'wh_1', webhookSecret: 's' } }
    );
    await expect(hooks.checkExists.call(context)).rejects.toThrow('Invalid API key');
    expect(staticData).toEqual({ webhookId: 'wh_1', webhookSecret: 's' });
  });
});

describe('delete', () => {
  it('DELETEs the stored webhook and clears static data', async () => {
    const { context, http, staticData } = hookContext({}, [{ data: webhookRecord() }], {
      staticData: { webhookId: 'wh_1', webhookSecret: 's' },
    });
    expect(await hooks.delete.call(context)).toBe(true);
    expect(requestOptions(http).method).toBe('DELETE');
    expect(requestOptions(http).url).toBe(`${BASE}/v1/webhooks/wh_1`);
    expect(staticData).toEqual({});
  });

  it('treats an already-deleted webhook as deleted', async () => {
    const { context, staticData } = hookContext({}, [apiError(404, 'Webhook not found')], {
      staticData: { webhookId: 'wh_1', webhookSecret: 's' },
    });
    expect(await hooks.delete.call(context)).toBe(true);
    expect(staticData).toEqual({});
  });

  it('does nothing when no webhook is stored', async () => {
    const { context, http } = hookContext({}, []);
    expect(await hooks.delete.call(context)).toBe(true);
    expect(http).not.toHaveBeenCalled();
  });

  it('rethrows other API errors and keeps the stored webhook', async () => {
    const { context, staticData } = hookContext({}, [apiError(500, 'Internal server error')], {
      staticData: { webhookId: 'wh_1', webhookSecret: 's' },
    });
    await expect(hooks.delete.call(context)).rejects.toBeInstanceOf(NodeApiError);
    expect(staticData.webhookId).toBe('wh_1');
  });
});

describe('webhook', () => {
  const secret = 'stored-webhook-secret';
  const payload = {
    event: 'booking.created',
    data: { id: 'bk_1', customerEmail: 'ada@example.com' },
    seller_id: 'sel_1',
    sellerId: 'sel_1',
    timestamp: '2026-10-22T12:00:00.000Z',
    event_id: 'evt_1',
    eventId: 'evt_1',
    api_version: 'v1',
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const sign = (body: Buffer | string, key = secret) =>
    `sha256=${createHmac('sha256', key).update(body).digest('hex')}`;

  async function deliver(
    headers: IDataObject,
    body: Buffer = rawBody,
    stored: IDataObject = { webhookId: 'wh_1', webhookSecret: secret }
  ) {
    const { context, response } = webhookContext({ rawBody: body, headers, staticData: stored });
    const result = await trigger.webhook.call(context);
    return { result, response };
  }

  function expectRejected(outcome: Awaited<ReturnType<typeof deliver>>) {
    expect(outcome.result).toEqual({ noWebhookResponse: true });
    expect(outcome.result.workflowData).toBeUndefined();
    expect(outcome.response.status).toHaveBeenCalledWith(401);
  }

  it('outputs the payload when the signature is valid', async () => {
    const { result, response } = await deliver({
      'x-webhook-signature': sign(rawBody),
      'x-webhook-timestamp': '1761134400',
    });
    expect(result.workflowData).toEqual([[{ json: payload }]]);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('accepts an upper-case hex digest', async () => {
    const { result } = await deliver({
      'x-webhook-signature': sign(rawBody).toUpperCase().replace('SHA256=', 'sha256='),
    });
    expect(result.workflowData).toBeDefined();
  });

  it('rejects a tampered body', async () => {
    const tampered = Buffer.from(JSON.stringify({ ...payload, data: { id: 'bk_2' } }));
    expectRejected(await deliver({ 'x-webhook-signature': sign(rawBody) }, tampered));
  });

  it('rejects a signature made with the wrong secret', async () => {
    expectRejected(await deliver({ 'x-webhook-signature': sign(rawBody, 'some-other-secret') }));
  });

  it('rejects a missing signature header', async () => {
    expectRejected(await deliver({}));
  });

  it.each([
    ['no prefix', () => createHmac('sha256', secret).update(rawBody).digest('hex')],
    ['wrong algorithm', () => sign(rawBody).replace('sha256=', 'sha1=')],
    ['not hex', () => `sha256=${'z'.repeat(64)}`],
    ['truncated', () => sign(rawBody).slice(0, -2)],
    ['empty', () => ''],
    ['repeated header', () => [sign(rawBody), sign(rawBody)]],
  ])('rejects a malformed header (%s)', async (_label, header) => {
    expectRejected(await deliver({ 'x-webhook-signature': header() }));
  });

  it('rejects every delivery when no secret is stored', async () => {
    expectRejected(await deliver({ 'x-webhook-signature': sign(rawBody, '') }, rawBody, {}));
  });

  it('rejects a request without a raw body', async () => {
    const { context, response } = webhookContext({
      headers: { 'x-webhook-signature': sign('{}') },
      staticData: { webhookSecret: secret },
    });
    const result = await trigger.webhook.call(context);
    expect(result).toEqual({ noWebhookResponse: true });
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
