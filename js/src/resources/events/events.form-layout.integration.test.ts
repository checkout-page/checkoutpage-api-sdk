import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, ValidationError, createCheckoutPageClient } from '../../index';
import type { CreateEventParams, Event, FormLayout } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource formLayout integration tests', () => {
  let client: CheckoutPageClient;
  let createdPageIds: string[] = [];

  beforeAll(() => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  });

  afterEach(async () => {
    for (const pageId of createdPageIds.splice(0)) {
      await client.events.delete(pageId).catch(() => undefined);
    }
  });

  const fields: NonNullable<CreateEventParams['fields']> = [
    { label: 'Email', element: 'email', type: 'email', required: true },
    { key: 'first-name', element: 'text', label: 'First name' },
    { key: 'last-name', element: 'text', label: 'Last name' },
    { key: 'notes', element: 'textarea', label: 'Notes' },
  ];

  const layoutByKey: FormLayout = [
    { type: 'heading', id: 'your-details', text: 'Your details', level: 'heading' },
    {
      type: 'group',
      id: 'name-row',
      name: 'Name',
      columns: 2,
      items: [
        { type: 'field', fieldId: 'first-name' },
        { type: 'field', fieldId: 'last-name' },
      ],
    },
    { type: 'divider', id: 'divider-1' },
    { type: 'field', fieldId: 'notes' },
    { type: 'discount-code', id: 'discount-code' },
  ];

  const createPage = async (overrides: Partial<CreateEventParams> = {}) => {
    const name = `SDK form layout ${uniqueSuffix()}`;
    const { data } = await client.events.create({
      name,
      title: name,
      eventDetails: {
        type: 'in_person',
        currency: 'usd',
        startDate: '2027-09-01T09:00:00Z',
        endDate: '2027-09-01T17:00:00Z',
        timezone: 'UTC',
        location: 'SDK Form Layout Venue',
      },
      fields,
      showCouponCodeField: true,
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

  const fieldIdByLabel = (page: Event, label: string) => {
    const field = page.fields?.find((item) => item.label === label);
    expect(field).toBeDefined();
    return field!.id;
  };

  const expectLayoutStartsWith = (page: Event, expected: FormLayout) => {
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
      layoutByKey[0],
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
      layoutByKey[2],
      { type: 'field', fieldId: notes },
      layoutByKey[4],
    ];
    expectLayoutStartsWith(page, expected);

    const { data: fetched } = await client.events.get(page.id);
    expect(fetched.formLayout).toEqual(page.formLayout);
  });

  it('replaces the whole layout on update', async () => {
    const page = await createPage();
    const first = fieldIdByLabel(page, 'First name');
    const last = fieldIdByLabel(page, 'Last name');
    const notes = fieldIdByLabel(page, 'Notes');

    const layout: FormLayout = [
      { type: 'discount-code', id: 'discount-code' },
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

    const { data: updated } = await client.events.update(page.id, { formLayout: layout });
    expectLayoutStartsWith(updated, layout);
    expect(updated.formLayout.some((item) => item.type === 'divider')).toBe(false);

    const { data: fetched } = await client.events.get(page.id);
    expect(fetched.formLayout).toEqual(updated.formLayout);
  });

  it('rejects a layout that references an unknown field key on create', async () => {
    await expectValidationError(
      createPage({ formLayout: [{ type: 'field', fieldId: 'no-such-key' }] }),
      'formLayout fieldId "no-such-key" does not match the key of a field'
    );
  });

  it('rejects a layout that references a field id not on the page on update', async () => {
    const page = await createPage();

    const missingFieldId = fakeObjectId('not-on-page');
    await expectValidationError(
      client.events.update(page.id, {
        formLayout: [{ type: 'field', fieldId: missingFieldId }],
      }),
      `Field ${missingFieldId} is not on this page`
    );

    const { data: fetched } = await client.events.get(page.id);
    expect(fetched.formLayout).toEqual(page.formLayout);
  });
});
