import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  CheckoutPageClient,
  CreateCheckoutPageFieldParams,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('CheckoutPagesResource fields integration tests', () => {
  let client: CheckoutPageClient;
  let invalidClient: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let pageId: string;
  let createdFieldIds: string[] = [];

  const createField = async (params: CreateCheckoutPageFieldParams) => {
    const result = await client.checkoutPages.fields.create(pageId, params);
    createdFieldIds.push(result.data.id);
    return result.data;
  };

  const forgetField = (fieldId: string) => {
    createdFieldIds = createdFieldIds.filter((id) => id !== fieldId);
  };

  beforeAll(async () => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    invalidClient = createCheckoutPageClient({
      apiKey: 'invalid_api_key',
      baseUrl: config.baseUrl,
    });

    const suffix = uniqueSuffix();
    const page = await client.checkoutPages.create({
      name: `SDK Fields Host ${suffix}`,
      productData: {
        title: `SDK Fields Product ${suffix}`,
        price: {
          amount: 4900,
          currency: 'usd',
        },
      },
    });
    pageId = page.data.id;
  });

  afterAll(async () => {
    try {
      await client.checkoutPages.delete(pageId);
    } catch {
      // Best-effort cleanup for integration tests.
    }
  });

  afterEach(async () => {
    for (const fieldId of [...createdFieldIds].reverse()) {
      try {
        await client.checkoutPages.fields.delete(pageId, fieldId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }

    createdFieldIds = [];
  });

  it('lists fields for a checkout page', async () => {
    const result = await client.checkoutPages.fields.list(pageId);

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    for (const field of result.data) {
      expect(field).toHaveProperty('id');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('element');
      expect(field).toHaveProperty('order');
    }
  });

  it('returns default checkout fields alongside custom fields', async () => {
    const customField = await createField({
      label: `Integration Text ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.list(pageId);

    expect(result.data.some((field) => field.id === customField.id)).toBe(true);
    expect(result.data.some((field) => field.element === 'email')).toBe(true);
  });

  it('fails for an unknown checkout page id', async () => {
    await expect(client.checkoutPages.fields.list(fakeObjectId('badpage'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('fails for an invalid api key', async () => {
    await expect(invalidClient.checkoutPages.fields.list(pageId)).rejects.toThrow(
      AuthenticationError
    );
  });

  it('creates a basic text field', async () => {
    const field = await createField({
      label: `Basic Text ${uniqueSuffix()}`,
      element: 'text',
      placeholder: 'Type here',
    });

    expect(field.label).toContain('Basic Text');
    expect(field.element).toBe('text');
    expect(field.placeholder).toBe('Type here');
  });

  it.each([
    { element: 'text', type: 'company-name' },
    { element: 'number' },
    { element: 'date' },
    { element: 'time' },
    { element: 'date-time' },
    { element: 'email', type: 'billing-email' },
    { element: 'phone', type: 'phone' },
    { element: 'country', type: 'address-country' },
    { element: 'checkbox' },
    { element: 'textarea' },
  ] as Array<{
    element: CreateCheckoutPageFieldParams['element'];
    type?: CreateCheckoutPageFieldParams['type'];
  }>)('creates supported type and element combination %#', async ({ element, type }) => {
    const field = await createField({
      label: `Combo ${element} ${uniqueSuffix()}`,
      element,
      ...(type ? { type } : {}),
      ...(element === 'email' ? { required: true } : {}),
    });

    expect(field.element).toBe(element);
    if (type) {
      expect(field.type).toBe(type);
    }
  });

  it('creates a select field with options', async () => {
    const field = await createField({
      label: `Select ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
      ],
    });

    expect(field.options).toHaveLength(2);
    expect(field.options?.[0]?.label).toBe('Starter');
  });

  it('creates a field with default value settings', async () => {
    const field = await createField({
      label: `Default ${uniqueSuffix()}`,
      element: 'text',
      defaultValue: {
        enabled: true,
        value: 'Acme Inc.',
      },
    });

    expect(field.defaultValue?.enabled).toBe(true);
    expect(field.defaultValue?.value).toBe('Acme Inc.');
  });

  it('creates a field with showHideLogic referencing an existing field', async () => {
    const sourceField = await createField({
      label: `Checkbox Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const dependentField = await createField({
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
    expect(dependentField.showHideLogic?.value).toBe('TRUE');
  });

  it('creates a field with min and max value settings', async () => {
    const field = await createField({
      label: `Seats ${uniqueSuffix()}`,
      element: 'number',
      minValue: { enabled: true, value: '1' },
      maxValue: { enabled: true, value: '10' },
    });

    expect(field.minValue?.enabled).toBe(true);
    expect(field.minValue?.value).toBe('1');
    expect(field.maxValue?.enabled).toBe(true);
    expect(field.maxValue?.value).toBe('10');
  });

  it('creates a field with country restrictions', async () => {
    const field = await createField({
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
    const field = await createField({
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

  it('fails when multiple quantity fields are added', async () => {
    await createField({
      label: `Quantity ${uniqueSuffix()}`,
      element: 'quantity',
      required: true,
    });

    await expect(
      client.checkoutPages.fields.create(pageId, {
        label: `Second Quantity ${uniqueSuffix()}`,
        element: 'quantity',
        required: true,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('fails when references are not unique', async () => {
    const reference = `duplicate-ref-${uniqueSuffix()}`;

    await createField({
      label: `Reference One ${uniqueSuffix()}`,
      element: 'text',
      reference,
    });

    await expect(
      client.checkoutPages.fields.create(pageId, {
        label: `Reference Two ${uniqueSuffix()}`,
        element: 'text',
        reference,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('fails when multiple email fields are added', async () => {
    await expect(
      client.checkoutPages.fields.create(pageId, {
        label: `Extra Email ${uniqueSuffix()}`,
        element: 'email',
        type: 'email',
        required: true,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('gets an existing checkout page field', async () => {
    const createdField = await createField({
      label: `Get Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.get(pageId, createdField.id);

    expect(result.data.id).toBe(createdField.id);
    expect(result.data.label).toBe(createdField.label);
  });

  it('returns option and conditional logic data', async () => {
    const sourceField = await createField({
      label: `Logic Checkbox ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField({
      label: `Selectable Target ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
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

    const result = await client.checkoutPages.fields.get(pageId, targetField.id);

    expect(result.data.options).toHaveLength(2);
    expect(result.data.showHideLogic?.enabled).toBe(true);
    expect(result.data.showHideLogic?.element?.elementId).toBe(sourceField.id);
  });

  it('fails for an unknown field id', async () => {
    await expect(client.checkoutPages.fields.get(pageId, fakeObjectId('badfield'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('updates a field label and placeholder', async () => {
    const field = await createField({
      label: `Update Label ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.update(pageId, field.id, {
      label: `Updated Label ${uniqueSuffix()}`,
      placeholder: 'Updated placeholder',
    });

    expect(result.data.label).toContain('Updated Label');
    expect(result.data.placeholder).toBe('Updated placeholder');
  });

  it('updates selectable options', async () => {
    const field = await createField({
      label: `Update Select ${uniqueSuffix()}`,
      element: 'select',
      options: [{ label: 'Old', value: 'old' }],
    });

    const result = await client.checkoutPages.fields.update(pageId, field.id, {
      options: [
        { label: 'New One', value: 'new-1' },
        { label: 'New Two', value: 'new-2' },
      ],
    });

    expect(result.data.options).toHaveLength(2);
    expect(result.data.options?.[0]?.label).toBe('New One');
  });

  it('updates show hide logic', async () => {
    const sourceField = await createField({
      label: `Update Logic Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField({
      label: `Update Logic Target ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.update(pageId, targetField.id, {
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
    const field = await createField({
      label: `Update Order ${uniqueSuffix()}`,
      element: 'text',
      required: false,
    });

    const result = await client.checkoutPages.fields.update(pageId, field.id, {
      order: 99,
      required: true,
    });

    expect(result.data.order).toBe(99);
    expect(result.data.required).toBe(true);
  });

  it('clears nullable field settings when null is provided', async () => {
    const field = await createField({
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

    const result = await client.checkoutPages.fields.update(pageId, field.id, {
      placeholder: null,
      defaultValue: null,
      minValue: null,
    });

    expect(result.data.placeholder).toBeNull();
    expect(result.data.defaultValue).toBeNull();
    expect(result.data.minValue).toBeNull();
  });

  it('fails for an unknown field id on update', async () => {
    await expect(
      client.checkoutPages.fields.update(pageId, fakeObjectId('badfield'), {
        label: 'Nope',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('fails when references are not unique on update', async () => {
    const reference = `update-ref-${uniqueSuffix()}`;
    const source = await createField({
      label: `Reference Source ${uniqueSuffix()}`,
      element: 'text',
      reference,
    });
    const target = await createField({
      label: `Reference Target ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(
      client.checkoutPages.fields.update(pageId, target.id, {
        reference,
      })
    ).rejects.toThrow(ValidationError);

    expect(source.reference).toBe(reference);
  });

  it('fails when multiple quantity fields are added on update', async () => {
    await createField({
      label: `Existing Quantity ${uniqueSuffix()}`,
      element: 'quantity',
      required: true,
    });

    const target = await createField({
      label: `Quantity Target ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(
      client.checkoutPages.fields.update(pageId, target.id, {
        element: 'quantity',
        required: true,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('fails when multiple email fields are added on update', async () => {
    const target = await createField({
      label: `Email Target ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(
      client.checkoutPages.fields.update(pageId, target.id, {
        element: 'email',
        type: 'email',
        required: true,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('deletes a custom checkout page field', async () => {
    const field = await createField({
      label: `Delete Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.delete(pageId, field.id);
    forgetField(field.id);

    expect(result.data.success).toBe(true);
    await expect(client.checkoutPages.fields.get(pageId, field.id)).rejects.toThrow(NotFoundError);
  });

  it('returns success and message after deletion', async () => {
    const field = await createField({
      label: `Delete Response ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.checkoutPages.fields.delete(pageId, field.id);
    forgetField(field.id);

    expect(result.data).toEqual({
      success: true,
      message: 'Field deleted successfully',
    });
  });

  it('fails when deleting the same field twice', async () => {
    const field = await createField({
      label: `Delete Twice ${uniqueSuffix()}`,
      element: 'text',
    });

    await client.checkoutPages.fields.delete(pageId, field.id);
    forgetField(field.id);

    await expect(client.checkoutPages.fields.delete(pageId, field.id)).rejects.toThrow(
      NotFoundError
    );
  });

  it('fails for an unknown field id on delete', async () => {
    await expect(
      client.checkoutPages.fields.delete(pageId, fakeObjectId('badfield'))
    ).rejects.toThrow(NotFoundError);
  });
});
