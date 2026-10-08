import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  CreateEventFieldParams,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

const OPTIONS = [
  { label: 'Google', value: 'google' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'A friend' },
];

describe('EventsResource multi-select field integration tests', () => {
  let client: CheckoutPageClient;
  let eventId: string;

  const multiSelect = (
    overrides: Partial<CreateEventFieldParams> = {}
  ): CreateEventFieldParams => ({
    label: `Source ${uniqueSuffix()}`,
    element: 'multi-select',
    options: OPTIONS,
    ...overrides,
  });

  beforeAll(async () => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    const response = await client.events.create({
      name: `SDK Multi-select Fields ${uniqueSuffix()}`,
    });
    eventId = response.data.id;
  });

  afterAll(async () => {
    if (!eventId) return;
    try {
      await client.events.delete(eventId);
    } catch {
      // Best-effort cleanup for integration tests; deleting the event removes its fields.
    }
  });

  it('creates a multi-select with its look, counts and default ticks as option values', async () => {
    const { data: created } = await client.events.fields.create(
      eventId,
      multiSelect({
        layout: 'list',
        minValue: { enabled: true, value: '2' },
        maxValue: { enabled: true, value: '3' },
        defaultValue: { enabled: true, values: ['google', 'facebook'] },
      })
    );

    expect(created.element).toBe('multi-select');
    expect(created.layout).toBe('list');
    expect(created.minValue).toMatchObject({ enabled: true, value: '2' });
    expect(created.maxValue).toMatchObject({ enabled: true, value: '3' });
    expect(created.defaultValue?.values).toEqual(['google', 'facebook']);
    expect(created.options?.map((option) => option.label)).toEqual([
      'Google',
      'Facebook',
      'A friend',
    ]);

    const { data: fetched } = await client.events.fields.get(eventId, created.id);
    expect(fetched.layout).toBe('list');
    expect(fetched.defaultValue?.values).toEqual(['google', 'facebook']);
  });

  it('refuses a maximum of 1, which is a single choice', async () => {
    const attempt = client.events.fields.create(
      eventId,
      multiSelect({ maxValue: { enabled: true, value: '1' } })
    );

    await expect(attempt).rejects.toThrow(ValidationError);
    await expect(
      client.events.fields.create(eventId, multiSelect({ maxValue: { enabled: true, value: '1' } }))
    ).rejects.toThrow(/maximum selections must be 2 or more/);
  });

  it('refuses a maximum above the number of options', async () => {
    await expect(
      client.events.fields.create(eventId, multiSelect({ maxValue: { enabled: true, value: '4' } }))
    ).rejects.toThrow(/cannot be more than the number of options \(3\)/);
  });

  it('refuses a maximum below the minimum', async () => {
    await expect(
      client.events.fields.create(
        eventId,
        multiSelect({
          minValue: { enabled: true, value: '3' },
          maxValue: { enabled: true, value: '2' },
        })
      )
    ).rejects.toThrow(/cannot be below the minimum/);
  });

  it('refuses a default with more ticks than the maximum', async () => {
    await expect(
      client.events.fields.create(
        eventId,
        multiSelect({
          maxValue: { enabled: true, value: '2' },
          defaultValue: { enabled: true, values: ['google', 'facebook', 'A friend'] },
        })
      )
    ).rejects.toThrow(/default value has 3 options but the maximum is 2/);
  });

  it('refuses a default that is not one of the options', async () => {
    await expect(
      client.events.fields.create(
        eventId,
        multiSelect({ defaultValue: { enabled: true, values: ['bing'] } })
      )
    ).rejects.toThrow(/default value "bing" is not one of the options/);
  });

  it('refuses the label of an option that has a value as a default', async () => {
    await expect(
      client.events.fields.create(
        eventId,
        multiSelect({ defaultValue: { enabled: true, values: ['Google'] } })
      )
    ).rejects.toThrow(/default value "Google" is not one of the options/);
  });

  it('takes the label of an option without a value as its default', async () => {
    const { data: created } = await client.events.fields.create(
      eventId,
      multiSelect({ defaultValue: { enabled: true, values: ['A friend'] } })
    );

    expect(created.defaultValue?.values).toEqual(['A friend']);
  });
});
