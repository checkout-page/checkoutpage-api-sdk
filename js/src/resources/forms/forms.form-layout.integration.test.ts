import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, ValidationError, createCheckoutPageClient } from '../../index';
import type { CreateFormParams, Form, CreateFormLayout, FormLayout } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('FormsResource formLayout integration tests', () => {
  let client: CheckoutPageClient;
  let createdPageIds: string[] = [];

  beforeAll(() => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  });

  afterEach(async () => {
    for (const pageId of createdPageIds.splice(0)) {
      await client.forms.delete(pageId).catch(() => undefined);
    }
  });

  const fields: NonNullable<CreateFormParams['fields']> = [
    { label: 'Email', element: 'email', type: 'email', required: true },
    { key: 'first-name', element: 'text', label: 'First name' },
    { key: 'last-name', element: 'text', label: 'Last name' },
    { key: 'notes', element: 'textarea', label: 'Notes' },
  ];

  const layoutByKey: CreateFormLayout = [
    { type: 'heading', id: 'your-details', text: 'Your details', level: 'heading' },
    {
      type: 'group',
      id: 'name-row',
      name: 'Name',
      columns: 2,
      items: [
        { type: 'field', fieldKey: 'first-name' },
        { type: 'field', fieldKey: 'last-name' },
      ],
    },
    { type: 'divider', id: 'divider-1' },
    { type: 'field', fieldKey: 'notes' },
  ];

  const createPage = async (overrides: Partial<CreateFormParams> = {}) => {
    const name = `SDK form layout ${uniqueSuffix()}`;
    const { data } = await client.forms.create({
      name,
      title: name,
      fields,
      formLayout: layoutByKey,
      ...overrides,
    });
    createdPageIds.push(data.id);
    return data;
  };

  const expectValidationError = async (request: Promise<unknown>, message: string) => {
    const error = await request.then(
      () => undefined,
      (reason: unknown) => reason
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toContain(message);
  };

  const fieldIdByLabel = (page: Form, label: string) => {
    const field = page.fields?.find((item) => item.label === label);
    expect(field).toBeDefined();
    return field!.id;
  };

  const expectLayoutStartsWith = (page: Form, expected: FormLayout) => {
    expect(page.formLayout.slice(0, expected.length)).toEqual(expected);

    const listed = page.formLayout.flatMap((item) => (item.type === 'group' ? item.items : [item]));
    const listedFieldIds = listed.flatMap((item) => (item.type === 'field' ? [item.fieldId] : []));
    expect([...listedFieldIds].sort()).toEqual(page.fields!.map((field) => field.id).sort());
  };

  it('creates a page with a layout that references fields by key and returns it on get', async () => {
    const page = await createPage();
    const first = fieldIdByLabel(page, 'First name');
    const last = fieldIdByLabel(page, 'Last name');
    const notes = fieldIdByLabel(page, 'Notes');

    const expected: FormLayout = [
      { type: 'heading', id: 'your-details', text: 'Your details', level: 'heading' },
      {
        type: 'group',
        id: 'name-row',
        name: 'Name',
        columns: 2,
        items: [
          { type: 'field', fieldId: first },
          { type: 'field', fieldId: last },
        ],
      },
      { type: 'divider', id: 'divider-1' },
      { type: 'field', fieldId: notes },
    ];
    expectLayoutStartsWith(page, expected);

    const { data: fetched } = await client.forms.get(page.id);
    expect(fetched.formLayout).toEqual(page.formLayout);
  });

  it('replaces the whole layout on update', async () => {
    const page = await createPage();
    const first = fieldIdByLabel(page, 'First name');
    const last = fieldIdByLabel(page, 'Last name');
    const notes = fieldIdByLabel(page, 'Notes');

    const layout: FormLayout = [
      { type: 'heading', id: 'about-you', text: 'About you', level: 'subheading' },
      {
        type: 'group',
        id: 'everything',
        columns: 3,
        items: [
          { type: 'field', fieldId: notes },
          { type: 'field', fieldId: last },
          { type: 'field', fieldId: first },
        ],
      },
    ];

    const { data: updated } = await client.forms.update(page.id, { formLayout: layout });
    expectLayoutStartsWith(updated, layout);
    expect(updated.formLayout.some((item) => item.type === 'divider')).toBe(false);

    const { data: fetched } = await client.forms.get(page.id);
    expect(fetched.formLayout).toEqual(updated.formLayout);
  });

  it('rejects a layout that references an unknown field key on create', async () => {
    await expectValidationError(
      createPage({ formLayout: [{ type: 'field', fieldKey: 'no-such-key' }] }),
      'formLayout fieldKey "no-such-key" does not match the key of a field'
    );
  });

  it('rejects a field item with fieldId instead of fieldKey on create', async () => {
    const byId = [{ type: 'field', fieldId: 'first-name' }] as unknown as CreateFormLayout;
    await expectValidationError(createPage({ formLayout: byId }), 'formLayout.0.fieldKey');
  });

  it('rejects a layout that references a field id not on the page on update', async () => {
    const page = await createPage();

    const missingFieldId = fakeObjectId('not-on-page');
    await expectValidationError(
      client.forms.update(page.id, {
        formLayout: [{ type: 'field', fieldId: missingFieldId }],
      }),
      `Field ${missingFieldId} is not on this page`
    );

    const { data: fetched } = await client.forms.get(page.id);
    expect(fetched.formLayout).toEqual(page.formLayout);
  });

  it('rejects the discount code box on a form', async () => {
    const discountCode: FormLayout = [{ type: 'discount-code' }];

    await expectValidationError(
      createPage({ formLayout: discountCode }),
      'a form has no discount code'
    );

    const page = await createPage();
    await expectValidationError(
      client.forms.update(page.id, { formLayout: discountCode }),
      'a form has no discount code'
    );
  });
});
