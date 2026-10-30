import { describe, expect, it } from 'vitest';
import { loadApp } from './app';
import { conformance, requestShape } from './conformance';
import { spec } from './spec';

const app = loadApp();
const events = (spec as any).paths['/v1/webhooks/'].post.requestBody.content['application/json']
  .schema.properties.events.items.enum as string[];

describe('webhooks', () => {
  it('covers every subscribable event exactly once across the webhooks', () => {
    const all = app
      .byType('webhook')
      .flatMap((w) => (w.code.params as any)[0].options.map((o: any) => o.value));
    expect([...all].sort()).toEqual([...events].sort());
  });

  it.each(app.byType('webhook').map((w) => [w.id, w]))(
    '%s attaches, updates and detaches through /v1/webhooks',
    (_id, w: any) => {
      const attach = requestShape(w.code.attach);
      expect(attach.method).toBe('POST');
      expect(conformance(attach)).toEqual([]);
      expect(attach.bodyKeys).toEqual(
        expect.arrayContaining(['name', 'url', 'events', 'customHeaders'])
      );
      expect(w.code.attach.body.name).toContain('substring(');
      expect(w.code.attach.log.sanitize).toEqual(
        expect.arrayContaining([
          'response.body.data.secret',
          'request.body.customHeaders.x-make-token',
        ])
      );
      const update = requestShape(w.code.update);
      expect(update).toMatchObject({ method: 'PATCH', path: '/v1/webhooks/__param__' });
      expect(conformance(update)).toEqual([]);
      expect(update.bodyKeys).toContain('events');
      const detach = requestShape(w.code.detach);
      expect(detach).toMatchObject({ method: 'DELETE', path: '/v1/webhooks/__param__' });
      expect(conformance(detach)).toEqual([]);
      expect(w.code.detach.response.valid).toContain('404');
      expect(w.code.communication.condition).toContain("body.event != 'webhook.test'");
      expect(w.meta).toMatchObject({ webhookType: 'web', connection: 'checkoutPage' });
    }
  );

  it('links every instant trigger to a webhook with a matching interface', () => {
    for (const m of app.byType('module').filter((m) => m.meta.moduleType === 'instant_trigger')) {
      const w = app.get('webhook', m.meta.webhook as string);
      const outputKeys = Object.keys((w.code.communication as any).output);
      const interfaceNames = (m.code.interface as any[]).map((f) => f.name);
      expect(interfaceNames.sort()).toEqual(outputKeys.sort());
      expect(m.code.staticParams).toEqual([]);
    }
  });
});
