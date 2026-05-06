import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  APIError,
  CheckoutPageClient,
  CreateEventFieldParams,
  NotFoundError,
  createCheckoutPageClient,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource fields integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdEventIds: string[] = [];
  let createdFieldsByEventId: Map<string, string[]> = new Map();

  const rememberEvent = (eventId: string) => {
    createdEventIds.push(eventId);
  };

  const rememberField = (eventId: string, fieldId: string) => {
    const existing = createdFieldsByEventId.get(eventId) ?? [];
    existing.push(fieldId);
    createdFieldsByEventId.set(eventId, existing);
  };

  const forgetField = (eventId: string, fieldId: string) => {
    createdFieldsByEventId.set(
      eventId,
      (createdFieldsByEventId.get(eventId) ?? []).filter((id) => id !== fieldId)
    );
  };

  const expectIsoDate = (value: string | null | undefined) => {
    expect(typeof value).toBe('string');
    expect(Number.isNaN(new Date(value as string).getTime())).toBe(false);
  };

  const expectFieldShape = (field: Record<string, any>) => {
    expect(field.id).toBeTypeOf('string');
    expect(field.label).toBeTypeOf('string');
    expect(field.element).toBeTypeOf('string');
    expect(typeof field.required).toBe('boolean');
    expect(typeof field.order).toBe('number');
    expectIsoDate(field.createdAt);
    expectIsoDate(field.updatedAt);
  };

  const createEvent = async () => {
    const response = await client.events.create({
      name: `SDK Event Fields ${uniqueSuffix()}`,
    });
    rememberEvent(response.data.id);
    return response.data;
  };

  const createField = async (eventId: string, params: CreateEventFieldParams) => {
    const result = await client.events.fields.create(eventId, params);
    rememberField(eventId, result.data.id);
    return result.data;
  };

  beforeAll(() => {
    config = loadIntegrationConfig();
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  afterEach(async () => {
    for (const eventId of [...createdEventIds].reverse()) {
      const fieldIds = [...(createdFieldsByEventId.get(eventId) ?? [])].reverse();

      for (const fieldId of fieldIds) {
        try {
          await client.events.fields.delete(eventId, fieldId);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }

      createdFieldsByEventId.delete(eventId);

      try {
        await client.events.delete(eventId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }

    createdEventIds = [];
    createdFieldsByEventId = new Map();
  });

  it('lists fields for an event', async () => {
    const event = await createEvent();
    const result = await client.events.fields.list(event.id);

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    for (const field of result.data) {
      expectFieldShape(field);
    }
  });

  it('returns default event fields alongside custom fields', async () => {
    const event = await createEvent();
    const customField = await createField(event.id, {
      label: `Integration Text ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.list(event.id);

    expect(result.data.some((field) => field.id === customField.id)).toBe(true);
    expect(result.data.some((field) => field.element === 'email')).toBe(true);
  });

  it('returns the element and type for each field in the list', async () => {
    const event = await createEvent();
    await createField(event.id, {
      label: `Select Field ${uniqueSuffix()}`,
      element: 'select',
      options: [{ label: 'Option A', value: 'a' }],
    });

    const result = await client.events.fields.list(event.id);

    for (const field of result.data) {
      expect(field.element).toBeTypeOf('string');
    }
    expect(result.data.some((field) => field.element === 'select')).toBe(true);
  });

  it('fails for an unknown event id', async () => {
    await expect(client.events.fields.list(fakeObjectId('badevent'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('creates a basic text field', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Basic Text ${uniqueSuffix()}`,
      element: 'text',
      placeholder: 'Type here',
    });

    expectFieldShape(field);
    expect(field.label).toContain('Basic Text');
    expect(field.element).toBe('text');
    expect(field.placeholder).toBe('Type here');
  });

  it.each([
    { element: 'text', type: 'company-name' },
    { element: 'text', type: 'first-name' },
    { element: 'text', type: 'last-name' },
    { element: 'text', type: 'address-line1' },
    { element: 'text', type: 'address-city' },
    { element: 'text', type: 'address-line2' },
    { element: 'text', type: 'address-postal_code' },
    { element: 'text', type: 'address-state' },
    { element: 'text', type: 'shipping-name' },
    { element: 'text', type: 'shipping-address-line1' },
    { element: 'text', type: 'shipping-address-city' },
    { element: 'text', type: 'shipping-address-line2' },
    { element: 'text', type: 'shipping-address-postal_code' },
    { element: 'text', type: 'shipping-address-state' },
    { element: 'text' },
    { element: 'number' },
    { element: 'date' },
    { element: 'time' },
    { element: 'date-time' },
    { element: 'email', type: 'billing-email' },
    { element: 'phone', type: 'phone' },
    { element: 'phone', type: 'shipping-phone' },
    { element: 'country', type: 'address-country' },
    { element: 'country', type: 'shipping-address-country' },
    { element: 'checkbox' },
    { element: 'textarea' },
    { element: 'po-number' },
    { element: 'tax-id' },
    { element: 'multiple-choice' },
    { element: 'quantity' },
  ] as Array<{
    element: CreateEventFieldParams['element'];
    type?: CreateEventFieldParams['type'];
  }>)(
    'creates a field with each supported element and type combination %#',
    async ({ element, type }) => {
      const event = await createEvent();
      const field = await createField(event.id, {
        label: `Combo ${element} ${type ?? 'default'} ${uniqueSuffix()}`,
        element,
        ...(type ? { type } : {}),
        ...(element === 'email' ? { required: true } : {}),
      });

      expectFieldShape(field);
      expect(field.element).toBe(element);
      if (type) {
        expect(field.type).toBe(type);
      }
    }
  );

  it('creates a select field with options', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Select ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'General Admission', value: 'ga' },
        { label: 'VIP', value: 'vip' },
      ],
    });

    expect(field.options).toHaveLength(2);
    expect(field.options?.[0]?.label).toBe('General Admission');
    expect(field.options?.[0]?.value).toBe('ga');
    expect(field.element).toBe('select');
  });

  it('creates a field with default value settings', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Default ${uniqueSuffix()}`,
      element: 'text',
      defaultValue: {
        enabled: true,
        value: 'Acme Inc.',
      },
      hidden: true,
      reference: `default-${uniqueSuffix()}`.slice(0, 36),
    });

    expect(field.defaultValue?.enabled).toBe(true);
    expect(field.defaultValue?.value).toBe('Acme Inc.');
    expect(field.hidden).toBe(true);
    expect(field.reference).toContain('default-');
  });

  it('creates a field with show hide logic', async () => {
    const event = await createEvent();
    const sourceField = await createField(event.id, {
      label: `Checkbox Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const dependentField = await createField(event.id, {
      label: `Dependent ${uniqueSuffix()}`,
      element: 'text',
      showHideLogic: {
        enabled: true,
        comparison: 'is',
        value: 'TRUE',
        element: {
          elementId: sourceField.id,
        },
      },
    });

    expect(dependentField.showHideLogic?.enabled).toBe(true);
    expect(dependentField.showHideLogic?.element?.elementId).toBe(sourceField.id);
    expect(typeof dependentField.showHideLogic?.value).toBe('string');
  });

  it('creates a field with min and max value settings', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Quantity ${uniqueSuffix()}`,
      element: 'number',
      minValue: { enabled: true, value: '1' },
      maxValue: { enabled: true, value: '10' },
      order: 99,
      required: true,
    });

    expect(field.minValue?.enabled).toBe(true);
    expect(field.minValue?.value).toBe('1');
    expect(field.maxValue?.enabled).toBe(true);
    expect(field.maxValue?.value).toBe('10');
    expect(field.order).toBe(99);
    expect(field.required).toBe(true);
  });

  it('creates a field with country restrictions', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Country ${uniqueSuffix()}`,
      element: 'country',
      type: 'address-country',
      limitAllowedCountries: {
        enabled: true,
        countries: ['US', 'CA'],
      },
    });

    expect(field.limitAllowedCountries?.enabled).toBe(true);
    expect(field.limitAllowedCountries?.countries).toEqual(['US', 'CA']);
  });

  it('creates a phone field with showSelectedDialCode enabled', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Phone ${uniqueSuffix()}`,
      element: 'phone',
      type: 'phone',
      limitAllowedCountries: {
        enabled: true,
        countries: ['US'],
      },
      showSelectedDialCode: true,
    });

    expect(field.element).toBe('phone');
    expect(field.showSelectedDialCode).toBe(true);
  });

  it('returns element and type in the create response', async () => {
    const event = await createEvent();
    const result = await client.events.fields.create(event.id, {
      label: `Element Type ${uniqueSuffix()}`,
      element: 'text',
      type: 'company-name',
    });
    rememberField(event.id, result.data.id);

    expect(result.data).toBeDefined();
    expect(result.data.element).toBe('text');
    expect(result.data.type).toBe('company-name');
    expectIsoDate(result.data.createdAt);
    expectIsoDate(result.data.updatedAt);
  });

  it('fails when show hide logic references a missing field key', async () => {
    const event = await createEvent();

    await expect(
      client.events.fields.create(event.id, {
        label: `Missing Source ${uniqueSuffix()}`,
        element: 'text',
        showHideLogic: {
          enabled: true,
          comparison: 'is',
          value: 'missing-option',
          element: {
            elementType: 'field',
            elementId: 'missing-field-key',
          },
        },
      })
    ).rejects.toThrow(APIError);
  });

  it('gets an existing event field', async () => {
    const event = await createEvent();
    const createdField = await createField(event.id, {
      label: `Get Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.get(event.id, createdField.id);

    expectFieldShape(result.data);
    expect(result.data.id).toBe(createdField.id);
    expect(result.data.label).toBe(createdField.label);
  });

  it('returns the correct element and type for the field', async () => {
    const event = await createEvent();
    const createdField = await createField(event.id, {
      label: `Type Round Trip ${uniqueSuffix()}`,
      element: 'phone',
      type: 'phone',
    });

    const result = await client.events.fields.get(event.id, createdField.id);

    expect(result.data.element).toBe('phone');
    expect(result.data.type).toBe('phone');
  });

  it('returns option and conditional logic data', async () => {
    const event = await createEvent();
    const sourceField = await createField(event.id, {
      label: `Logic Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField(event.id, {
      label: `Selectable Target ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'General', value: 'general' },
        { label: 'VIP', value: 'vip' },
      ],
      showHideLogic: {
        enabled: true,
        comparison: 'is',
        value: 'TRUE',
        element: {
          elementId: sourceField.id,
        },
      },
    });

    const result = await client.events.fields.get(event.id, targetField.id);

    expect(result.data.options).toHaveLength(2);
    expect(result.data.showHideLogic?.enabled).toBe(true);
    expect(result.data.showHideLogic?.element?.elementId).toBe(sourceField.id);
  });

  it('fails for an unknown field id', async () => {
    const event = await createEvent();

    await expect(client.events.fields.get(event.id, fakeObjectId('badfield'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('fails for a field that does not belong to the event', async () => {
    const event = await createEvent();
    const otherEvent = await createEvent();
    const otherField = await createField(otherEvent.id, {
      label: `Other Field ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(client.events.fields.get(event.id, otherField.id)).rejects.toThrow(NotFoundError);
  });

  it('updates a field label and placeholder', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Update Label ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.update(event.id, field.id, {
      label: `Updated Label ${uniqueSuffix()}`,
      placeholder: 'Updated placeholder',
    });

    expectFieldShape(result.data);
    expect(result.data.label).toContain('Updated Label');
    expect(result.data.placeholder).toBe('Updated placeholder');
  });

  it('updates selectable options', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Update Select ${uniqueSuffix()}`,
      element: 'select',
      options: [{ label: 'Old', value: 'old' }],
    });

    const result = await client.events.fields.update(event.id, field.id, {
      options: [
        { label: 'New One', value: 'new-1' },
        { label: 'New Two', value: 'new-2' },
      ],
    });

    expect(result.data.options).toHaveLength(2);
    expect(result.data.options?.[0]?.label).toBe('New One');
  });

  it('updates show hide logic', async () => {
    const event = await createEvent();
    const sourceField = await createField(event.id, {
      label: `Update Logic Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField(event.id, {
      label: `Update Logic Target ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.update(event.id, targetField.id, {
      showHideLogic: {
        enabled: true,
        comparison: 'is',
        value: 'TRUE',
        element: {
          elementId: sourceField.id,
        },
      },
    });

    expect(result.data.showHideLogic?.enabled).toBe(true);
    expect(result.data.showHideLogic?.element?.elementId).toBe(sourceField.id);
  });

  it('updates ordering and required state', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Update Order ${uniqueSuffix()}`,
      element: 'text',
      required: false,
    });

    const result = await client.events.fields.update(event.id, field.id, {
      order: 99,
      required: true,
    });

    expect(result.data.order).toBe(99);
    expect(result.data.required).toBe(true);
  });

  it('returns element and type in the update response', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Element Type Update ${uniqueSuffix()}`,
      element: 'select',
      options: [{ label: 'A', value: 'a' }],
    });

    console.log(field);

    const result = await client.events.fields.update(event.id, field.id, {
      label: `Element Type Updated ${uniqueSuffix()}`,
    });

    console.log(result);

    expect(result.data.element).toBe('select');
    expectFieldShape(result.data);
  });

  it('clears nullable field settings when null is provided', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Nullable ${uniqueSuffix()}`,
      element: 'text',
      placeholder: 'To be cleared',
      defaultValue: {
        enabled: true,
        value: 'preset',
      },
      minValue: {
        enabled: true,
        value: '1',
      },
    });

    const result = await client.events.fields.update(event.id, field.id, {
      placeholder: null,
      defaultValue: null,
      minValue: null,
    });

    expect(result.data.placeholder).toBeNull();
    expect(result.data.defaultValue).toBeNull();
    expect(result.data.minValue).toBeNull();
  });

  it('fails for an unknown field id on update', async () => {
    const event = await createEvent();

    await expect(
      client.events.fields.update(event.id, fakeObjectId('badfield'), { label: 'Nope' })
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes a custom event field', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Delete Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.delete(event.id, field.id);
    forgetField(event.id, field.id);

    expect(result.data.success).toBe(true);
    await expect(client.events.fields.get(event.id, field.id)).rejects.toThrow(NotFoundError);
  });

  it('returns success and message after deletion', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Delete Response ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.events.fields.delete(event.id, field.id);
    forgetField(event.id, field.id);

    expect(result.data).toEqual({
      success: true,
      message: 'Field deleted successfully',
    });
  });

  it('fails when deleting the same field twice', async () => {
    const event = await createEvent();
    const field = await createField(event.id, {
      label: `Delete Twice ${uniqueSuffix()}`,
      element: 'text',
    });

    await client.events.fields.delete(event.id, field.id);
    forgetField(event.id, field.id);

    await expect(client.events.fields.delete(event.id, field.id)).rejects.toThrow(NotFoundError);
  });

  it('fails for an unknown field id on delete', async () => {
    const event = await createEvent();

    await expect(client.events.fields.delete(event.id, fakeObjectId('badfield'))).rejects.toThrow(
      NotFoundError
    );
  });
});
