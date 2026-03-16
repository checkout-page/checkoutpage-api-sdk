import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  APIError,
  CheckoutPageClient,
  CreateFormFieldParams,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('FormsResource fields integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdFormIds: string[] = [];
  let createdFieldsByFormId: Map<string, string[]> = new Map();

  const rememberForm = (formId: string) => {
    createdFormIds.push(formId);
  };

  const rememberField = (formId: string, fieldId: string) => {
    const existing = createdFieldsByFormId.get(formId) ?? [];
    existing.push(fieldId);
    createdFieldsByFormId.set(formId, existing);
  };

  const forgetField = (formId: string, fieldId: string) => {
    createdFieldsByFormId.set(
      formId,
      (createdFieldsByFormId.get(formId) ?? []).filter((id) => id !== fieldId)
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

  const createForm = async () => {
    const response = await client.forms.create({
      name: `SDK Form Fields ${uniqueSuffix()}`,
      title: `SDK Form Fields Title ${uniqueSuffix()}`,
    });
    rememberForm(response.data.id);
    return response.data;
  };

  const createField = async (formId: string, params: CreateFormFieldParams) => {
    const result = await client.forms.fields.create(formId, params);
    rememberField(formId, result.data.id);
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
    for (const formId of [...createdFormIds].reverse()) {
      const fieldIds = [...(createdFieldsByFormId.get(formId) ?? [])].reverse();

      for (const fieldId of fieldIds) {
        try {
          await client.forms.fields.delete(formId, fieldId);
        } catch {
          // Best-effort cleanup for integration tests.
        }
      }

      createdFieldsByFormId.delete(formId);

      try {
        await client.forms.delete(formId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }

    createdFormIds = [];
    createdFieldsByFormId = new Map();
  });

  it('lists fields for a form', async () => {
    const form = await createForm();
    const result = await client.forms.fields.list(form.id);

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    for (const field of result.data) {
      expectFieldShape(field);
    }
  });

  it('returns default form fields alongside custom fields', async () => {
    const form = await createForm();
    const customField = await createField(form.id, {
      label: `Integration Text ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.list(form.id);

    expect(result.data.some((field) => field.id === customField.id)).toBe(true);
    expect(result.data.some((field) => field.element === 'email')).toBe(true);
    expect(result.data.some((field) => field.type === 'name')).toBe(true);
  });

  it('fails for an unknown form id', async () => {
    await expect(client.forms.fields.list(fakeObjectId('badform'))).rejects.toThrow(NotFoundError);
  });

  it('fails for a malformed form id', async () => {
    await expect(client.forms.fields.list('not-a-valid-id')).rejects.toThrow(ValidationError);
  });

  it('creates a basic text field', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
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
  ] as Array<{
    element: CreateFormFieldParams['element'];
    type?: CreateFormFieldParams['type'];
  }>)('creates all supported field element and type combinations %#', async ({ element, type }) => {
    const form = await createForm();
    const field = await createField(form.id, {
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
  });

  it('creates a select field with options', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Select ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
      ],
    });

    expect(field.options).toHaveLength(2);
    expect(field.options?.[0]?.label).toBe('Starter');
    expect(field.options?.[0]?.value).toBe('starter');
  });

  it('creates a field with default value settings', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
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
    const form = await createForm();
    const sourceField = await createField(form.id, {
      label: `Checkbox Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const dependentField = await createField(form.id, {
      label: `Dependent ${uniqueSuffix()}`,
      element: 'text',
      showHideLogic: {
        enabled: true,
        comparison: 'IS',
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
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Seats ${uniqueSuffix()}`,
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
    const form = await createForm();
    const field = await createField(form.id, {
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
    const form = await createForm();
    const field = await createField(form.id, {
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

  it('fails when show hide logic references a missing field key', async () => {
    const form = await createForm();

    await expect(
      client.forms.fields.create(form.id, {
        label: `Missing Source ${uniqueSuffix()}`,
        element: 'text',
        showHideLogic: {
          enabled: true,
          comparison: 'IS',
          value: 'missing-option',
          element: {
            elementType: 'field',
            elementId: 'missing-field-key',
          },
        },
      })
    ).rejects.toThrow(APIError);
  });

  it('fails for an unknown form id on create', async () => {
    await expect(
      client.forms.fields.create(fakeObjectId('badform'), { label: 'Field', element: 'text' })
    ).rejects.toThrow(NotFoundError);
  });

  it('fails for a malformed form id on create', async () => {
    await expect(
      client.forms.fields.create('not-a-valid-id', { label: 'Field', element: 'text' })
    ).rejects.toThrow(ValidationError);
  });

  it('gets an existing form field', async () => {
    const form = await createForm();
    const createdField = await createField(form.id, {
      label: `Get Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.get(form.id, createdField.id);

    expectFieldShape(result.data);
    expect(result.data.id).toBe(createdField.id);
    expect(result.data.label).toBe(createdField.label);
  });

  it('returns option and conditional logic data', async () => {
    const form = await createForm();
    const sourceField = await createField(form.id, {
      label: `Logic Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField(form.id, {
      label: `Selectable Target ${uniqueSuffix()}`,
      element: 'select',
      options: [
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
      ],
      showHideLogic: {
        enabled: true,
        comparison: 'IS',
        value: 'TRUE',
        element: {
          elementId: sourceField.id,
        },
      },
    });

    const result = await client.forms.fields.get(form.id, targetField.id);

    expect(result.data.options).toHaveLength(2);
    expect(result.data.showHideLogic?.enabled).toBe(true);
    expect(result.data.showHideLogic?.element?.elementId).toBe(sourceField.id);
  });

  it('fails for an unknown field id', async () => {
    const form = await createForm();

    await expect(client.forms.fields.get(form.id, fakeObjectId('badfield'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('fails for a field that does not belong to the form', async () => {
    const form = await createForm();
    const otherForm = await createForm();
    const otherField = await createField(otherForm.id, {
      label: `Other Field ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(client.forms.fields.get(form.id, otherField.id)).rejects.toThrow(NotFoundError);
  });

  it('fails for a malformed form id on get', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Malformed Get ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(client.forms.fields.get('not-a-valid-id', field.id)).rejects.toThrow(
      ValidationError
    );
  });

  it('fails for a malformed field id on get', async () => {
    const form = await createForm();

    await expect(client.forms.fields.get(form.id, 'not-a-valid-id')).rejects.toThrow(
      ValidationError
    );
  });

  it('updates a field label and placeholder', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Update Label ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.update(form.id, field.id, {
      label: `Updated Label ${uniqueSuffix()}`,
      placeholder: 'Updated placeholder',
    });

    expectFieldShape(result.data);
    expect(result.data.label).toContain('Updated Label');
    expect(result.data.placeholder).toBe('Updated placeholder');
  });

  it('updates selectable options', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Update Select ${uniqueSuffix()}`,
      element: 'select',
      options: [{ label: 'Old', value: 'old' }],
    });

    const result = await client.forms.fields.update(form.id, field.id, {
      options: [
        { label: 'New One', value: 'new-1' },
        { label: 'New Two', value: 'new-2' },
      ],
    });

    expect(result.data.options).toHaveLength(2);
    expect(result.data.options?.[0]?.label).toBe('New One');
  });

  it('updates show hide logic', async () => {
    const form = await createForm();
    const sourceField = await createField(form.id, {
      label: `Update Logic Source ${uniqueSuffix()}`,
      element: 'checkbox',
    });

    const targetField = await createField(form.id, {
      label: `Update Logic Target ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.update(form.id, targetField.id, {
      showHideLogic: {
        enabled: true,
        comparison: 'IS',
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
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Update Order ${uniqueSuffix()}`,
      element: 'text',
      required: false,
    });

    const result = await client.forms.fields.update(form.id, field.id, {
      order: 99,
      required: true,
    });

    expect(result.data.order).toBe(99);
    expect(result.data.required).toBe(true);
  });

  it('clears nullable field settings when null is provided', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
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

    const result = await client.forms.fields.update(form.id, field.id, {
      placeholder: null,
      defaultValue: null,
      minValue: null,
    });

    expect(result.data.placeholder).toBeNull();
    expect(result.data.defaultValue).toBeNull();
    expect(result.data.minValue).toBeNull();
  });

  it('fails for an unknown field id on update', async () => {
    const form = await createForm();

    await expect(
      client.forms.fields.update(form.id, fakeObjectId('badfield'), {
        label: 'Nope',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('fails for a field that does not belong to the form on update', async () => {
    const form = await createForm();
    const otherForm = await createForm();
    const otherField = await createField(otherForm.id, {
      label: `Other Update Field ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(
      client.forms.fields.update(form.id, otherField.id, { label: 'Nope' })
    ).rejects.toThrow(NotFoundError);
  });

  it('fails for a malformed form id on update', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Malformed Update ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(
      client.forms.fields.update('not-a-valid-id', field.id, { label: 'Nope' })
    ).rejects.toThrow(ValidationError);
  });

  it('fails for a malformed field id on update', async () => {
    const form = await createForm();

    await expect(
      client.forms.fields.update(form.id, 'not-a-valid-id', { label: 'Nope' })
    ).rejects.toThrow(ValidationError);
  });

  it('deletes a custom form field', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Delete Me ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.delete(form.id, field.id);
    forgetField(form.id, field.id);

    expect(result.data.success).toBe(true);
    await expect(client.forms.fields.get(form.id, field.id)).rejects.toThrow(NotFoundError);
  });

  it('returns success and message after deletion', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Delete Response ${uniqueSuffix()}`,
      element: 'text',
    });

    const result = await client.forms.fields.delete(form.id, field.id);
    forgetField(form.id, field.id);

    expect(result.data).toEqual({
      success: true,
      message: 'Field deleted successfully',
    });
  });

  it('fails when deleting the same field twice', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Delete Twice ${uniqueSuffix()}`,
      element: 'text',
    });

    await client.forms.fields.delete(form.id, field.id);
    forgetField(form.id, field.id);

    await expect(client.forms.fields.delete(form.id, field.id)).rejects.toThrow(NotFoundError);
  });

  it('fails for an unknown field id on delete', async () => {
    const form = await createForm();

    await expect(client.forms.fields.delete(form.id, fakeObjectId('badfield'))).rejects.toThrow(
      NotFoundError
    );
  });

  it('fails for a field that does not belong to the form on delete', async () => {
    const form = await createForm();
    const otherForm = await createForm();
    const otherField = await createField(otherForm.id, {
      label: `Other Delete Field ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(client.forms.fields.delete(form.id, otherField.id)).rejects.toThrow(NotFoundError);
  });

  it('fails for a malformed form id on delete', async () => {
    const form = await createForm();
    const field = await createField(form.id, {
      label: `Malformed Delete ${uniqueSuffix()}`,
      element: 'text',
    });

    await expect(client.forms.fields.delete('not-a-valid-id', field.id)).rejects.toThrow(
      ValidationError
    );
  });

  it('fails for a malformed field id on delete', async () => {
    const form = await createForm();

    await expect(client.forms.fields.delete(form.id, 'not-a-valid-id')).rejects.toThrow(
      ValidationError
    );
  });
});
