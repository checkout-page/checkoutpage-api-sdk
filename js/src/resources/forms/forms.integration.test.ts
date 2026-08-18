import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateFormParams, Form } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { createImageFile, fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('FormsResource integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];
  let createdCheckoutPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const forgetPage = (pageId: string) => {
    createdPageIds = createdPageIds.filter((id) => id !== pageId);
  };

  const createDownloadFile = (name = 'form-guide.txt') => {
    const content = `Form attachment ${uniqueSuffix()}`;
    return new File([new Blob([content], { type: 'text/plain' })], name, { type: 'text/plain' });
  };

  const uploadImage = async (namePrefix = 'form-image') => {
    const result = await client.files.upload({
      file: createImageFile(`${namePrefix}-${uniqueSuffix()}.png`),
      purpose: 'image',
    });

    return result.data.id;
  };

  const uploadFile = async (namePrefix = 'form-file') => {
    const result = await client.files.upload({
      file: createDownloadFile(`${namePrefix}-${uniqueSuffix()}.txt`),
      purpose: 'file',
    });

    return result.data.id;
  };

  const pageIncludesImage = (
    page: {
      images?: Array<{
        fileId?: string | null;
      }> | null;
    },
    imageId: string
  ) => page.images?.some((image) => image.fileId === imageId) ?? false;

  const pageIncludesFile = (
    page: {
      files?: Array<{
        id?: string | null;
      }> | null;
    },
    fileId: string
  ) => page.files?.some((file) => file.id === fileId) ?? false;

  const expectIsoDate = (value: string | null | undefined) => {
    expect(typeof value).toBe('string');
    expect(Number.isNaN(new Date(value as string).getTime())).toBe(false);
  };

  const expectBaseFormResponse = (form: Form, expectedName?: string) => {
    expect(form.id).toBeTypeOf('string');
    expect(form.sellerId).toBe(config.testSellerId);
    expect(form.type).toBe('form');
    expect(form.status).toMatch(/published|draft|archived/);
    expect(form.name).toBeTypeOf('string');
    if (expectedName) {
      expect(form.name).toBe(expectedName);
    }
    expectIsoDate(form.createdAt);
    expectIsoDate(form.updatedAt);
    expect(typeof form.visitCount).toBe('number');
    expect(form.url).toContain('checkoutpage');
    expect(typeof form.submissionCount).toBe('number');
  };

  const expectImageMetadata = (form: Form, imageId: string) => {
    const image = form.images?.find((item) => item.fileId === imageId);
    expect(image).toBeDefined();
    expect(image?.name).toBeTypeOf('string');
    expect(image?.url).toContain('http');
  };

  const expectFileMetadata = (form: Form, fileId: string) => {
    const file = form.files?.find((item) => item.id === fileId);
    expect(file).toBeDefined();
    expect(file?.name).toBeTypeOf('string');
    expect(file?.location).toContain('http');
    expect(file?.purpose).toBe('file');
    expect(typeof file?.size).toBe('number');
    expect(file?.type).toBe('text/plain');
  };

  const expectFieldResponseShape = (form: Form, label: string) => {
    const field = getFieldByLabel(form, label);
    expect(field.id).toBeTypeOf('string');
    expect(typeof field.order).toBe('number');
    expect(typeof field.required).toBe('boolean');
    expectIsoDate(field.createdAt);
    expectIsoDate(field.updatedAt);
    return field;
  };

  const createReference = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 36);

  const getFieldByLabel = (form: Form, label: string) => {
    const field = form.fields?.find((item) => item.label === label);
    expect(field).toBeDefined();
    return field!;
  };

  const createForm = async (overrides: Partial<CreateFormParams> = {}) => {
    const suffix = uniqueSuffix();
    const params: CreateFormParams = {
      name: `SDK Form ${suffix}`,
      title: `SDK Form Title ${suffix}`,
      ...overrides,
    };

    const response = await client.forms.create(params);
    rememberPage(response.data.id);
    return response;
  };

  beforeAll(() => {
    config = loadIntegrationConfig();
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  const createRedirectCheckoutPage = async () => {
    const suffix = uniqueSuffix();
    const response = await client.checkoutPages.create({
      name: `SDK Redirect Target ${suffix}`,
      productData: {
        title: `SDK Redirect Product ${suffix}`,
        price: {
          amount: 4900,
          currency: 'usd',
        },
      },
    });
    createdCheckoutPageIds.push(response.data.id);
    return response.data;
  };

  afterEach(async () => {
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        await client.forms.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdPageIds = [];

    for (const pageId of [...createdCheckoutPageIds].reverse()) {
      try {
        await client.checkoutPages.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdCheckoutPageIds = [];
  });

  describe('list', () => {
    it('lists forms', async () => {
      const result = await client.forms.list();

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('respects the limit query parameter', async () => {
      const result = await client.forms.list({ limit: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('supports starting_after pagination', async () => {
      await createForm();
      await createForm();

      const firstPage = await client.forms.list({ limit: 1 });
      expect(firstPage.data).toHaveLength(1);
      expect(firstPage.has_more).toBe(true);

      const secondPage = await client.forms.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0].id);
    });

    it('supports ending_before pagination', async () => {
      await createForm();
      await createForm();
      await createForm();

      const seedPage = await client.forms.list({ limit: 3 });
      expect(seedPage.data.length).toBeGreaterThanOrEqual(2);

      const result = await client.forms.list({
        limit: 1,
        ending_before: seedPage.data[1].id,
      });

      expect(result.data[0]?.id).not.toBe(seedPage.data[1].id);
    });

    it('filters forms by status', async () => {
      const created = await createForm({ status: 'draft' });
      const result = await client.forms.list({
        status: 'draft',
        search: created.data.name ?? 'unknown',
      });

      expect(result.data.some((form) => form.id === created.data.id)).toBe(true);
      expect(result.data.every((form) => form.status === 'draft')).toBe(true);
    });

    it('filters forms by search', async () => {
      const token = `sdk-form-search-${uniqueSuffix()}`;
      const imageId = await uploadImage('form-list-image');
      const fileId = await uploadFile('form-list-file');
      const created = await createForm({
        name: token,
        title: token,
        description: '<p>Searchable form description.</p>',
        imageIds: [imageId],
        fileIds: [fileId],
        fields: [
          {
            label: 'Search Email',
            element: 'email',
            type: 'email',
            required: true,
          },
        ],
      });
      const result = await client.forms.list({ search: token });
      const matched = result.data.find((form) => form.id === created.data.id);

      expect(matched).toBeDefined();
      expectBaseFormResponse(matched!, token);
      expect(matched?.title).toBe(token);
      expect(matched?.description).toBeDefined();
      expect(matched?.descriptionHtml).toContain('Searchable form description');
      expect(matched?.fields?.some((field) => field.label === 'Search Email')).toBe(true);
      expect(pageIncludesImage(matched!, imageId)).toBe(true);
      expect(pageIncludesFile(matched!, fileId)).toBe(true);
    }, 20000);

    it.each([
      {
        name: 'search only',
        params: (token: string) => ({ search: token }),
        expectedStatuses: ['published', 'draft'],
      },
      {
        name: 'search and published status',
        params: (token: string) => ({ search: token, status: 'published' as const }),
        expectedStatuses: ['published'],
      },
      {
        name: 'search and draft status',
        params: (token: string) => ({ search: token, status: 'draft' as const }),
        expectedStatuses: ['draft'],
      },
    ])('supports combined list filters for $name', async ({ params, expectedStatuses }) => {
      const token = `sdk-form-list-combo-${uniqueSuffix()}`;

      const published = await createForm({
        name: `${token}-published`,
        title: `${token}-published`,
        status: 'published',
      });
      const draft = await createForm({
        name: `${token}-draft`,
        title: `${token}-draft`,
        status: 'draft',
      });

      const result = await client.forms.list(params(token));
      const matchingForms = result.data.filter(
        (form) => form.id === published.data.id || form.id === draft.data.id
      );

      expect(matchingForms).not.toHaveLength(0);
      expect(matchingForms.map((form) => form.status).sort()).toEqual(expectedStatuses.sort());
      expect(
        matchingForms.every(
          (form) => form.name?.includes(token) || form.title?.includes(token) || false
        )
      ).toBe(true);
    });

    it('returns an empty list for an unmatched search', async () => {
      const result = await client.forms.list({
        search: `sdk-form-unmatched-${uniqueSuffix()}`,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });

  describe('create', () => {
    it('creates a minimal form', async () => {
      const { data } = await createForm();

      expectBaseFormResponse(data);
      expect(data.type).toBe('form');
      expect(data.status).toBe('published');
      expect(data.title).toContain('SDK Form Title');
      expect(data.files ?? []).toEqual([]);
    });

    it('creates a draft form', async () => {
      const { data } = await createForm({ status: 'draft' });

      expect(data.status).toBe('draft');
    });

    it('creates a form with uploaded imageIds', async () => {
      const imageId = await uploadImage('form-page');
      const { data } = await createForm({ imageIds: [imageId] });

      expect(pageIncludesImage(data, imageId)).toBe(true);
      expectImageMetadata(data, imageId);
    });

    it('creates a form with uploaded fileIds', async () => {
      const fileId = await uploadFile('form-download');
      const { data } = await createForm({ fileIds: [fileId] });

      expect(pageIncludesFile(data, fileId)).toBe(true);
      expectFileMetadata(data, fileId);
    });

    it('creates a form with uploaded imageIds and fileIds together', async () => {
      const imageId = await uploadImage('form-page-both');
      const fileId = await uploadFile('form-download-both');
      const { data } = await createForm({
        imageIds: [imageId],
        fileIds: [fileId],
      });

      expect(pageIncludesImage(data, imageId)).toBe(true);
      expect(pageIncludesFile(data, fileId)).toBe(true);
      expectImageMetadata(data, imageId);
      expectFileMetadata(data, fileId);
    }, 10000);

    it('creates a form with exhaustive page configuration and field combinations', async () => {
      const imageId = await uploadImage('form-complete-page');
      const fileId = await uploadFile('form-complete-file');
      const funnelPage = await createRedirectCheckoutPage();
      const slug = `sdk-form-${uniqueSuffix()}`;
      const formName = `Full Form ${uniqueSuffix()}`;
      const title = `Full Form Title ${uniqueSuffix()}`;

      const fields: NonNullable<CreateFormParams['fields']> = [
        {
          key: 'delivery-method',
          label: 'Delivery Method',
          element: 'select',
          required: true,
          reference: createReference('delivery-method'),
          options: [
            { key: 'digital', label: 'Digital', value: 'digital' },
            { key: 'physical', label: 'Physical', value: 'physical' },
          ],
        },
        {
          label: 'Business Email',
          element: 'email',
          type: 'email',
          required: true,
          placeholder: 'you@example.com',
          reference: createReference('business-email'),
          key: 'business-email',
        },
        {
          label: 'Billing Email',
          element: 'email',
          type: 'billing-email',
          required: false,
          placeholder: 'billing@example.com',
        },
        {
          label: 'Company Name',
          element: 'text',
          type: 'company-name',
          required: true,
          placeholder: 'Acme Inc.',
          hidden: true,
          defaultValue: { enabled: true, value: 'Acme Inc.' },
          minValue: { enabled: true, value: '1' },
          maxValue: { enabled: true, value: '100' },
        },
        { label: 'Full Name', element: 'text', type: 'name', required: true },
        { label: 'First Name', element: 'text', type: 'first-name', required: true },
        { label: 'Last Name', element: 'text', type: 'last-name', required: true },
        {
          label: 'Phone Number',
          element: 'phone',
          type: 'phone',
          required: true,
          showSelectedDialCode: true,
        },
        { label: 'Street Address', element: 'text', type: 'address-line1', required: true },
        { label: 'Address Line 2', element: 'text', type: 'address-line2', required: false },
        { label: 'City', element: 'text', type: 'address-city', required: true },
        {
          label: 'Country',
          element: 'country',
          type: 'address-country',
          required: true,
          limitAllowedCountries: { enabled: true, countries: ['US', 'CA'] },
        },
        { label: 'Postal Code', element: 'text', type: 'address-postal_code', required: true },
        { label: 'State', element: 'text', type: 'address-state', required: true },
        { label: 'Shipping Name', element: 'text', type: 'shipping-name', required: false },
        { label: 'Shipping Phone', element: 'phone', type: 'shipping-phone', required: false },
        {
          label: 'Shipping Address 1',
          element: 'text',
          type: 'shipping-address-line1',
          required: false,
        },
        {
          label: 'Shipping Address 2',
          element: 'text',
          type: 'shipping-address-line2',
          required: false,
        },
        { label: 'Shipping City', element: 'text', type: 'shipping-address-city', required: false },
        {
          label: 'Shipping Country',
          element: 'country',
          type: 'shipping-address-country',
          required: false,
        },
        {
          label: 'Shipping Postal Code',
          element: 'text',
          type: 'shipping-address-postal_code',
          required: false,
        },
        {
          label: 'Shipping State',
          element: 'text',
          type: 'shipping-address-state',
          required: false,
        },
        {
          label: 'Tax ID',
          element: 'tax-id',
          required: false,
          reference: createReference('tax-id'),
        },
        { label: 'PO Number', element: 'po-number', required: false, placeholder: 'PO-2026-001' },
        {
          label: 'Order ID',
          element: 'text',
          required: false,
          hidden: true,
          defaultValue: { enabled: true, value: 'preset' },
          key: 'orderId',
        },
        {
          label: 'Long Answer',
          element: 'textarea',
          required: false,
          placeholder: 'Additional notes',
        },
        {
          label: 'Seats',
          element: 'number',
          required: true,
          minValue: { enabled: true, value: '1' },
          maxValue: { enabled: true, value: '10' },
        },
        { label: 'Quantity', element: 'quantity', required: true },
        { label: 'Start Date', element: 'date', required: true },
        { label: 'Preferred Time', element: 'time', required: false },
        { label: 'Appointment Date & Time', element: 'date-time', required: false },
        { label: 'I agree to the terms', element: 'checkbox', required: true },
        {
          label: 'T-Shirt Size',
          element: 'multiple-choice',
          required: true,
          options: [
            { label: 'Small', value: 's' },
            { label: 'Medium', value: 'm' },
            { label: 'Large', value: 'l' },
          ],
        },
        {
          label: 'Shipping Address',
          element: 'text',
          type: 'shipping-address-line1',
          reference: createReference('shipping-address'),
          showHideLogic: {
            enabled: true,
            comparison: 'is',
            value: 'physical',
            element: {
              elementType: 'field',
              elementId: 'delivery-method',
            },
          },
        },
      ];

      const { data } = await createForm({
        name: formName,
        title,
        slug,
        locale: 'en-US',
        fields,
        allowDynamicTitle: true,
        allowDynamicDescription: true,
        closePopupOnClickOutside: true,
        redirect: {
          enabled: true,
          url: 'https://example.com/pre-form',
        },
        afterPaymentAction: 'redirect',
        confirmationCheckoutTitle: 'Form submitted',
        confirmationCheckoutMessage: '<p>Thanks for submitting the form.</p>',
        redirectUrl: 'https://example.com/forms/thanks',
        redirectUrlPath: [{ key: 'order', identifier: 'orderId' }],
        redirectUrlQuery: [{ parameter: 'email', key: 'fields', fieldKey: 'business-email' }],
        redirectUrlInsideEmbed: true,
        sendPaymentNotification: false,
        notifyEmail: 'forms@example.com',
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Form received',
        confirmationEmailMessage: '<p>We received your form.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
        googleIndex: false,
        trackingCodes: '<script>window.sdkFormTest=true;</script>',
        invoiceSettings: {
          bankDetails: 'Account 123456',
          additionalInformation: {
            enabled: true,
            title: 'Payment terms',
            message: 'Payment is due in 30 days.',
          },
          dueDays: {
            enabled: true,
            days: 30,
          },
        },
        funnelSteps: [
          {
            type: 'checkout',
            order: 0,
            enabled: true,
            config: {
              pageId: funnelPage.id,
            },
          },
        ],
        description: '<p>Full form description.</p>',
        imageIds: [imageId],
        fileIds: [fileId],
      });

      expectBaseFormResponse(data, formName);
      expect(data.slug).toBe(slug);
      expect(data.locale).toBe('en-US');
      expect(data.title).toBe(title);
      expect(data.description).toBeDefined();
      expect(data.descriptionHtml).toContain('Full form description');
      expect(data.closePopupOnClickOutside).toBe(true);
      expect(data.redirect?.enabled).toBe(true);
      expect(data.redirect?.url).toBe('https://example.com/pre-form');
      expect(data.afterPaymentAction).toBe('redirect');
      expect(data.confirmationCheckoutTitle).toBe('Form submitted');
      expect(data.confirmationCheckoutMessage).toBeDefined();
      expect(data.redirectUrl).toBe('https://example.com/forms/thanks');
      expect(data.redirectUrlPath?.[0]?.key).toBe('order');
      expect(data.redirectUrlQuery?.[0]?.parameter).toBe('email');
      expect(data.redirectUrlInsideEmbed).toBe(true);
      expect(data.sendPaymentNotification).toBe(false);
      expect(data.notifyEmail).toBe('forms@example.com');
      expect(data.sendEmailConfirmation).toBe(true);
      expect(data.customizeEmailConfirmation).toBe(true);
      expect(data.confirmationEmailSubject).toBe('Form received');
      expect(data.confirmationEmailMessage).toBeDefined();
      expect(data.confirmationEmailShowLogo).toBe(false);
      expect(data.confirmationEmailShowStoreName).toBe(false);
      expect(data.googleIndex).toBe(false);
      expect(data.trackingCodes).toContain('sdkFormTest');
      expect(data.allowDynamicTitle).toBe(true);
      expect(data.allowDynamicDescription).toBe(true);
      expect(data.invoiceSettings?.bankDetails).toBe('Account 123456');
      expect(data.invoiceSettings?.additionalInformation?.enabled).toBe(true);
      expect(data.invoiceSettings?.additionalInformation?.title).toBe('Payment terms');
      expect(data.invoiceSettings?.additionalInformation?.message).toBe(
        'Payment is due in 30 days.'
      );
      expect(data.invoiceSettings?.dueDays?.enabled).toBe(true);
      expect(data.invoiceSettings?.dueDays?.days).toBe(30);
      expect(data.funnelSteps?.length).toBe(1);
      const checkoutStep = data.funnelSteps?.[0];
      expect(checkoutStep?.type).toBe('checkout');
      expect(checkoutStep?.order).toBe(0);
      expect(checkoutStep?.enabled).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((checkoutStep?.config as any)?.pageId).toBe(funnelPage.id);
      expect(pageIncludesImage(data, imageId)).toBe(true);
      expect(pageIncludesFile(data, fileId)).toBe(true);
      expectImageMetadata(data, imageId);
      expectFileMetadata(data, fileId);
      expect(data.files?.[0]?.name).toContain('form-complete-file');
      expect(data.fields?.length).toBe(fields.length);

      const deliveryMethod = expectFieldResponseShape(data, 'Delivery Method');
      expect(deliveryMethod.element).toBe('select');
      expect(deliveryMethod.options).toHaveLength(2);
      expect(deliveryMethod.reference).toContain('delivery-method');

      const businessEmail = expectFieldResponseShape(data, 'Business Email');
      expect(businessEmail.element).toBe('email');
      expect(businessEmail.type).toBe('email');
      expect(businessEmail.required).toBe(true);
      expect(businessEmail.placeholder).toBe('you@example.com');
      expect(businessEmail.reference).toContain('business-email');

      const billingEmail = expectFieldResponseShape(data, 'Billing Email');
      expect(billingEmail.element).toBe('email');
      expect(billingEmail.type).toBe('billing-email');
      expect(billingEmail.placeholder).toBe('billing@example.com');

      expect(expectFieldResponseShape(data, 'Company Name').type).toBe('company-name');
      expect(expectFieldResponseShape(data, 'Full Name').type).toBe('name');
      expect(expectFieldResponseShape(data, 'First Name').type).toBe('first-name');
      expect(expectFieldResponseShape(data, 'Last Name').type).toBe('last-name');
      expect(expectFieldResponseShape(data, 'Phone Number').type).toBe('phone');
      expect(expectFieldResponseShape(data, 'Street Address').type).toBe('address-line1');
      expect(expectFieldResponseShape(data, 'Address Line 2').type).toBe('address-line2');
      expect(expectFieldResponseShape(data, 'City').type).toBe('address-city');
      expect(expectFieldResponseShape(data, 'Country').type).toBe('address-country');
      expect(expectFieldResponseShape(data, 'Postal Code').type).toBe('address-postal_code');
      expect(expectFieldResponseShape(data, 'State').type).toBe('address-state');
      expect(expectFieldResponseShape(data, 'Shipping Name').type).toBe('shipping-name');
      expect(expectFieldResponseShape(data, 'Shipping Phone').type).toBe('shipping-phone');
      expect(expectFieldResponseShape(data, 'Shipping Address 1').type).toBe(
        'shipping-address-line1'
      );
      expect(expectFieldResponseShape(data, 'Shipping Address 2').type).toBe(
        'shipping-address-line2'
      );
      expect(expectFieldResponseShape(data, 'Shipping City').type).toBe('shipping-address-city');
      expect(expectFieldResponseShape(data, 'Shipping Country').type).toBe(
        'shipping-address-country'
      );
      expect(expectFieldResponseShape(data, 'Shipping Postal Code').type).toBe(
        'shipping-address-postal_code'
      );
      expect(expectFieldResponseShape(data, 'Shipping State').type).toBe('shipping-address-state');

      const taxIdField = expectFieldResponseShape(data, 'Tax ID');
      expect(taxIdField.element).toBe('tax-id');
      expect(taxIdField.reference).toContain('tax-id');

      const poNumberField = expectFieldResponseShape(data, 'PO Number');
      expect(poNumberField.element).toBe('po-number');
      expect(poNumberField.placeholder).toBe('PO-2026-001');

      expect(expectFieldResponseShape(data, 'Order ID').element).toBe('text');
      expect(expectFieldResponseShape(data, 'Long Answer').element).toBe('textarea');
      expect(expectFieldResponseShape(data, 'Seats').element).toBe('number');
      expect(expectFieldResponseShape(data, 'Quantity').element).toBe('quantity');
      expect(expectFieldResponseShape(data, 'Start Date').element).toBe('date');
      expect(expectFieldResponseShape(data, 'Preferred Time').element).toBe('time');
      expect(expectFieldResponseShape(data, 'Appointment Date & Time').element).toBe('date-time');
      expect(expectFieldResponseShape(data, 'I agree to the terms').element).toBe('checkbox');

      const tshirtSize = expectFieldResponseShape(data, 'T-Shirt Size');
      expect(tshirtSize.element).toBe('multiple-choice');
      expect(tshirtSize.options).toHaveLength(3);

      const shippingAddress = expectFieldResponseShape(data, 'Shipping Address');
      expect(shippingAddress.type).toBe('shipping-address-line1');
      expect(shippingAddress.reference).toContain('shipping-address');
      expect(shippingAddress.showHideLogic?.enabled).toBe(true);
      expect(shippingAddress.showHideLogic?.comparison).toBe('is');
      expect(shippingAddress.showHideLogic?.element?.elementType).toBe('field');
      expect(shippingAddress.showHideLogic?.element?.elementId).toBe(deliveryMethod.id);
      // The API resolves the option key/value reference to its persisted option ID in the response
      expect(shippingAddress.showHideLogic?.value).toMatch(/^[0-9a-f]{24}$/);

      const countryField = expectFieldResponseShape(data, 'Country');
      expect(countryField.limitAllowedCountries?.enabled).toBe(true);
      expect(countryField.limitAllowedCountries?.countries).toEqual(['US', 'CA']);

      const phoneField = expectFieldResponseShape(data, 'Phone Number');
      expect(phoneField.showSelectedDialCode).toBe(true);

      const companyField = expectFieldResponseShape(data, 'Company Name');
      expect(companyField.hidden).toBe(true);
      expect(companyField.defaultValue?.enabled).toBe(true);
      expect(companyField.defaultValue?.value).toBe('Acme Inc.');
      expect(companyField.minValue?.value).toBe('1');
      expect(companyField.maxValue?.value).toBe('100');

      const plainTextField = expectFieldResponseShape(data, 'Order ID');
      expect(plainTextField.hidden).toBe(true);
      expect(plainTextField.defaultValue?.value).toBe('preset');
    }, 15000);

    it('creates a form with redirect configuration', async () => {
      const redirectPage = await createRedirectCheckoutPage();

      const { data } = await createForm({
        afterPaymentAction: 'checkout',
        redirectPageId: redirectPage.id,
      });

      expect(data.afterPaymentAction).toBe('checkout');
      expect(data.redirectPageId).toBe(redirectPage.id);
    });

    it('rejects an uppercase slug on create', async () => {
      await expect(
        createForm({
          slug: `/SDK-Form-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('rejects an unknown redirectPageId on create', async () => {
      await expect(
        createForm({
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('rejects an unknown funnel page reference on create', async () => {
      await expect(
        createForm({
          funnelSteps: [
            {
              type: 'checkout',
              order: 0,
              enabled: true,
              config: {
                pageId: fakeObjectId('missingfunnel'),
              },
            },
          ],
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('creates a form with customized confirmation email content', async () => {
      const { data } = await createForm({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Thanks for contacting us',
        confirmationEmailMessage: '<p>Your submission has been received.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
      });

      expect(data.sendEmailConfirmation).toBe(true);
      expect(data.customizeEmailConfirmation).toBe(true);
      expect(data.confirmationEmailSubject).toBe('Thanks for contacting us');
      expect(data.confirmationEmailMessage).toContain('submission has been received');
      expect(data.confirmationEmailShowLogo).toBe(false);
      expect(data.confirmationEmailShowStoreName).toBe(false);
    });

    it('creates a form with a custom redirectUrl resolving field keys to field IDs', async () => {
      const { data } = await createForm({
        afterPaymentAction: 'redirect',
        fields: [
          {
            element: 'email',
            type: 'email',
            required: true,
            label: 'Email',
            reference: 'email',
          },
          {
            element: 'text',
            required: true,
            label: 'URL path variable',
            reference: 'url_path',
            key: 'url_path_key',
          },
        ],
        redirectUrl: 'https://not-a-url',
        redirectUrlPath: [
          {
            fieldKey: 'url_path_key',
            key: 'fields',
          },
        ],
        redirectUrlQuery: [{ key: 'fields', fieldKey: 'url_path_key', parameter: 'URLPathParam' }],
      });

      const urlPathField = data.fields?.find((f) => f.reference === 'url_path');
      expect(urlPathField).toBeDefined();
      expect(data.redirectUrl).toEqual('https://not-a-url');
      expect(data.redirectUrlPath).toEqual([{ key: 'fields', identifier: urlPathField?.id }]);
      expect(data.redirectUrlQuery).toEqual([
        {
          parameter: 'URLPathParam',
          key: 'fields',
          identifier: urlPathField?.id,
        },
      ]);
    });

    it('ignores missing fileIds when the API accepts the request', async () => {
      await expect(
        client.forms.create({
          name: `Missing file form ${uniqueSuffix()}`,
          fileIds: [fakeObjectId('missingfile')],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails when imageIds reference a missing file', async () => {
      await expect(
        client.forms.create({
          name: `Missing image form ${uniqueSuffix()}`,
          imageIds: [fakeObjectId('missingimage')],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get', () => {
    it('gets an existing form by id', async () => {
      const created = await createForm();
      const result = await client.forms.get(created.data.id);

      expectBaseFormResponse(result.data, created.data.name ?? undefined);
      expect(result.data.id).toBe(created.data.id);
      expect(result.data.type).toBe('form');
    });

    it('returns uploaded imageIds and fileIds', async () => {
      const imageId = await uploadImage('form-get-image');
      const fileId = await uploadFile('form-get-file');
      const created = await createForm({
        imageIds: [imageId],
        fileIds: [fileId],
      });
      const result = await client.forms.get(created.data.id);

      expect(pageIncludesImage(result.data, imageId)).toBe(true);
      expect(pageIncludesFile(result.data, fileId)).toBe(true);
      expectImageMetadata(result.data, imageId);
      expectFileMetadata(result.data, fileId);
    }, 10000);

    it('returns configured form title description and metadata', async () => {
      const created = await createForm({
        title: `Configured Form Title ${uniqueSuffix()}`,
        description: '<p>Configured form description.</p>',
        sendPaymentNotification: false,
      });
      const result = await client.forms.get(created.data.id);

      expect(result.data.title).toContain('Configured Form Title');
      expect(result.data.description).toBeDefined();
      expect(result.data.descriptionHtml).toContain('Configured form description');
      expect(result.data.sellerId).toBe(config.testSellerId);
      expect(typeof result.data.submissionCount).toBe('number');
      expect(result.data.sendPaymentNotification).toBe(false);
      expect(result.data.files ?? []).toEqual([]);
    });

    it('fails for an unknown form id', async () => {
      await expect(client.forms.get(fakeObjectId('missingform'))).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed form id', async () => {
      await expect(client.forms.get('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('updates form metadata and attachments exhaustively', async () => {
      const redirectPage = await createRedirectCheckoutPage();
      const created = await createForm({
        fields: [
          {
            element: 'email',
            type: 'email',
            required: true,
            label: 'Email',
            reference: 'email',
          },
        ],
      });
      const imageId = await uploadImage('form-update-image');
      const fileId = await uploadFile('form-update-file');
      const updatedSlug = `updated-form-${uniqueSuffix()}`;
      const createdEmailField = created.data.fields?.find((field) => field.reference === 'email');

      expect(createdEmailField).toBeDefined();

      const result = await client.forms.update(created.data.id, {
        name: `Updated Form ${uniqueSuffix()}`,
        slug: updatedSlug,
        locale: 'fr-FR',
        status: 'draft',
        allowDynamicTitle: true,
        allowDynamicDescription: true,
        closePopupOnClickOutside: true,
        redirect: {
          enabled: true,
          url: 'https://example.com/pre-update',
        },
        afterPaymentAction: 'checkout',
        confirmationCheckoutTitle: 'Updated confirmation title',
        confirmationCheckoutMessage: '<p>Updated confirmation body.</p>',
        redirectUrl: 'https://example.com/updated-redirect',
        redirectUrlPath: [{ key: 'order', identifier: 'orderId' }],
        redirectUrlQuery: [
          {
            parameter: 'email',
            key: 'fields',
            fieldId: createdEmailField!.id,
          },
        ],
        redirectUrlInsideEmbed: true,
        redirectPageId: redirectPage.id,
        sendPaymentNotification: true,
        notifyEmail: 'updated-forms@example.com',
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Updated email subject',
        confirmationEmailMessage: '<p>Updated email body.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
        googleIndex: false,
        trackingCodes: '<script>window.sdkFormUpdated=true;</script>',
        invoiceSettings: {
          bankDetails: 'Updated account',
          dueDays: {
            enabled: true,
            days: 14,
          },
        },
        funnelSteps: [
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'redirect',
              redirectUrl: 'https://example.com/post-submit',
            },
          },
        ],
        title: `Updated Form Title ${uniqueSuffix()}`,
        description: '<p>Updated form description.</p>',
        imageIds: [imageId],
        fileIds: [fileId],
      });

      expectBaseFormResponse(result.data);
      expect(result.data.status).toBe('draft');
      expect(result.data.slug).toBe(updatedSlug);
      expect(result.data.locale).toBe('fr-FR');
      expect(result.data.closePopupOnClickOutside).toBe(true);
      expect(result.data.redirect?.enabled).toBe(true);
      expect(result.data.redirect?.url).toBe('https://example.com/pre-update');
      expect(result.data.afterPaymentAction).toBe('checkout');
      expect(result.data.confirmationCheckoutTitle).toBe('Updated confirmation title');
      expect(result.data.confirmationCheckoutMessage).toBeDefined();
      expect(result.data.redirectUrl).toBe('https://example.com/updated-redirect');
      expect(result.data.redirectUrlPath?.[0]?.key).toBe('order');
      expect(result.data.redirectUrlQuery?.[0]?.parameter).toBe('email');
      expect(result.data.redirectUrlInsideEmbed).toBe(true);
      expect(result.data.sendPaymentNotification).toBe(true);
      expect(result.data.notifyEmail).toBe('updated-forms@example.com');
      expect(result.data.sendEmailConfirmation).toBe(true);
      expect(result.data.customizeEmailConfirmation).toBe(true);
      expect(result.data.confirmationEmailSubject).toBe('Updated email subject');
      expect(result.data.confirmationEmailMessage).toBeDefined();
      expect(result.data.confirmationEmailShowLogo).toBe(false);
      expect(result.data.confirmationEmailShowStoreName).toBe(false);
      expect(result.data.googleIndex).toBe(false);
      expect(result.data.trackingCodes).toContain('sdkFormUpdated');
      expect(result.data.allowDynamicTitle).toBe(true);
      expect(result.data.allowDynamicDescription).toBe(true);
      expect(result.data.redirectPageId).toBe(redirectPage.id);
      expect(result.data.invoiceSettings?.bankDetails).toBe('Updated account');
      expect(result.data.invoiceSettings?.dueDays?.enabled).toBe(true);
      expect(result.data.invoiceSettings?.dueDays?.days).toBe(14);
      expect(result.data.funnelSteps?.length).toBe(1);
      const updatedConfirmationStep = result.data.funnelSteps?.[0];
      expect(updatedConfirmationStep?.type).toBe('confirmation');
      expect(updatedConfirmationStep?.order).toBe(1);
      expect(updatedConfirmationStep?.enabled).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((updatedConfirmationStep?.config as any)?.action).toBe('redirect');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((updatedConfirmationStep?.config as any)?.redirectUrl).toBe(
        'https://example.com/post-submit'
      );
      expect(result.data.title).toContain('Updated Form Title');
      expect(result.data.description).toBeDefined();
      expect(result.data.descriptionHtml).toContain('Updated form description');
      expect(pageIncludesImage(result.data, imageId)).toBe(true);
      expect(pageIncludesFile(result.data, fileId)).toBe(true);
      expectImageMetadata(result.data, imageId);
      expectFileMetadata(result.data, fileId);
    }, 15000);

    it('rejects an uppercase slug on update', async () => {
      const created = await createForm();

      await expect(
        client.forms.update(created.data.id, {
          slug: `/Updated-Form-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('rejects an unknown redirectPageId on update', async () => {
      const created = await createForm();

      await expect(
        client.forms.update(created.data.id, {
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('rejects an unknown funnel page reference on update', async () => {
      const created = await createForm();

      await expect(
        client.forms.update(created.data.id, {
          funnelSteps: [
            {
              type: 'checkout',
              order: 0,
              enabled: true,
              config: {
                pageId: fakeObjectId('missingfunnel'),
              },
            },
          ],
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('updates form attachments independently', async () => {
      const created = await createForm();
      const imageId = await uploadImage('form-independent-image');
      const fileId = await uploadFile('form-independent-file');

      const imageResult = await client.forms.update(created.data.id, {
        imageIds: [imageId],
      });
      expect(pageIncludesImage(imageResult.data, imageId)).toBe(true);
      expectImageMetadata(imageResult.data, imageId);

      const fileResult = await client.forms.update(created.data.id, {
        fileIds: [fileId],
      });
      expect(pageIncludesFile(fileResult.data, fileId)).toBe(true);
      expectFileMetadata(fileResult.data, fileId);
    }, 30000);

    it('preserves omitted attachment collections while replacing the provided collection', async () => {
      const originalImageId = await uploadImage('form-preserve-original-image');
      const originalFileId = await uploadFile('form-preserve-original-file');
      const replacementImageId = await uploadImage('form-preserve-replacement-image');
      const replacementFileId = await uploadFile('form-preserve-replacement-file');

      const created = await createForm({
        imageIds: [originalImageId],
        fileIds: [originalFileId],
      });

      const imageOnlyResult = await client.forms.update(created.data.id, {
        imageIds: [replacementImageId],
      });

      expect(pageIncludesImage(imageOnlyResult.data, replacementImageId)).toBe(true);
      expect(pageIncludesImage(imageOnlyResult.data, originalImageId)).toBe(false);
      expect(pageIncludesFile(imageOnlyResult.data, originalFileId)).toBe(true);

      const fileOnlyResult = await client.forms.update(created.data.id, {
        fileIds: [replacementFileId],
      });

      expect(pageIncludesImage(fileOnlyResult.data, replacementImageId)).toBe(true);
      expect(pageIncludesFile(fileOnlyResult.data, replacementFileId)).toBe(true);
      expect(pageIncludesFile(fileOnlyResult.data, originalFileId)).toBe(false);
    }, 30000);

    it('resolves redirect path and query identifiers on update across field and built-in keys', async () => {
      const created = await createForm({
        fields: [
          {
            element: 'email',
            type: 'email',
            required: true,
            label: 'Email',
            reference: 'email',
          },
          {
            element: 'text',
            required: true,
            label: 'Order Reference',
            key: 'order_reference',
            reference: 'order-reference',
          },
        ],
      });

      const createdOrderReferenceField = created.data.fields?.find(
        (field) => field.reference === 'order-reference'
      );
      const createdEmailField = created.data.fields?.find((field) => field.reference === 'email');

      expect(createdOrderReferenceField).toBeDefined();
      expect(createdEmailField).toBeDefined();

      const updated = await client.forms.update(created.data.id, {
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/forms/updated',
        redirectUrlPath: [
          {
            key: 'fields',
            fieldId: createdOrderReferenceField!.id,
          },
          {
            key: 'orderId',
            identifier: 'orderId',
          },
        ],
        redirectUrlQuery: [
          {
            parameter: 'email',
            key: 'fields',
            fieldId: createdEmailField!.id,
          },
          {
            parameter: 'orderId',
            key: 'orderId',
            identifier: 'orderId',
          },
        ],
      });

      const orderReferenceField = updated.data.fields?.find(
        (field) => field.reference === 'order-reference'
      );
      const emailField = updated.data.fields?.find((field) => field.reference === 'email');

      expect(orderReferenceField).toBeDefined();
      expect(emailField).toBeDefined();
      expect(updated.data.redirectUrl).toBe('https://example.com/forms/updated');
      expect(updated.data.redirectUrlPath).toEqual([
        { key: 'fields', identifier: orderReferenceField?.id },
        { key: 'orderId', identifier: 'orderId' },
      ]);
      expect(updated.data.redirectUrlQuery).toEqual([
        {
          parameter: 'email',
          key: 'fields',
          identifier: emailField?.id,
        },
        {
          parameter: 'orderId',
          key: 'orderId',
          identifier: 'orderId',
        },
      ]);
    });

    it('preserves slug while clearing other nullable settings and attachment collections', async () => {
      const imageId = await uploadImage('form-clear-image');
      const fileId = await uploadFile('form-clear-file');
      const created = await createForm({
        slug: `clear-form-${uniqueSuffix()}`,
        redirectUrl: 'https://example.com/original',
        notifyEmail: 'owner@example.com',
        confirmationCheckoutTitle: 'Original confirmation title',
        confirmationCheckoutMessage: '<p>Original confirmation message.</p>',
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Original subject',
        confirmationEmailMessage: '<p>Original email body.</p>',
        trackingCodes: '<script>window.clearForm=true;</script>',
        imageIds: [imageId],
        fileIds: [fileId],
      });

      const result = await client.forms.update(created.data.id, {
        slug: null,
        redirectUrl: null,
        notifyEmail: null,
        confirmationCheckoutTitle: null,
        confirmationCheckoutMessage: null,
        confirmationEmailSubject: null,
        confirmationEmailMessage: null,
        trackingCodes: null,
        imageIds: [],
        fileIds: [],
      });

      expect(result.data.slug).toBe(created.data.slug);
      expect(result.data.redirectUrl).toBeNull();
      expect(result.data.notifyEmail).toBeNull();
      expect(result.data.confirmationCheckoutTitle).toBeNull();
      expect(result.data.confirmationCheckoutMessage).toBeNull();
      expect(result.data.confirmationEmailSubject).toBeNull();
      expect(result.data.confirmationEmailMessage).toBeNull();
      expect(result.data.trackingCodes).toBeNull();
      expect(result.data.images ?? []).toEqual([]);
      expect(result.data.files ?? []).toEqual([]);
    }, 30000);

    it('fails for an unknown form id', async () => {
      await expect(
        client.forms.update(fakeObjectId('missingform'), { name: 'Missing form' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('archives an existing form', async () => {
      const created = await createForm();
      const result = await client.forms.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
      expectBaseFormResponse(result.data);
    });

    it('marks the form as archived in the response', async () => {
      const created = await createForm();
      const result = await client.forms.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.status).toBe('archived');
      expect(result.data.type).toBe('form');
      expect(typeof result.data.submissionCount).toBe('number');
    });

    it('fails for an unknown form id', async () => {
      await expect(client.forms.delete(fakeObjectId('missingform'))).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed form id', async () => {
      await expect(client.forms.delete('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('field option ids', () => {
    it('returns an id on each option for a select field', async () => {
      const { data } = await createForm({
        fields: [
          { label: 'Email', element: 'email', type: 'email', required: true },
          {
            label: 'Delivery Method',
            element: 'select',
            required: false,
            options: [
              { label: 'Digital', value: 'digital' },
              { label: 'Physical', value: 'physical' },
            ],
          },
        ],
      });

      const selectField = data.fields?.find((f) => f.element === 'select');
      expect(selectField).toBeDefined();
      expect(selectField?.options).toHaveLength(2);
      selectField?.options?.forEach((option) => {
        expect(option.id).toBeTypeOf('string');
        expect(option.id).toMatch(/^[0-9a-f]{24}$/);
      });
    });

    it('returns an id on each option for a multiple-choice field', async () => {
      const { data } = await createForm({
        fields: [
          { label: 'Email', element: 'email', type: 'email', required: true },
          {
            label: 'T-Shirt Size',
            element: 'multiple-choice',
            required: false,
            options: [
              { label: 'Small', value: 's' },
              { label: 'Medium', value: 'm' },
              { label: 'Large', value: 'l' },
            ],
          },
        ],
      });

      const choiceField = data.fields?.find((f) => f.element === 'multiple-choice');
      expect(choiceField).toBeDefined();
      expect(choiceField?.options).toHaveLength(3);
      choiceField?.options?.forEach((option) => {
        expect(option.id).toBeTypeOf('string');
        expect(option.id).toMatch(/^[0-9a-f]{24}$/);
      });
    });

    it('returns option ids when retrieving a form by id', async () => {
      const created = await createForm({
        fields: [
          { label: 'Email', element: 'email', type: 'email', required: true },
          {
            label: 'Preferred Plan',
            element: 'select',
            required: false,
            options: [
              { label: 'Starter', value: 'starter' },
              { label: 'Pro', value: 'pro' },
            ],
          },
        ],
      });

      const result = await client.forms.get(created.data.id);
      const selectField = result.data.fields?.find((f) => f.element === 'select');
      expect(selectField).toBeDefined();
      expect(selectField?.options).toHaveLength(2);
      selectField?.options?.forEach((option) => {
        expect(option.id).toBeTypeOf('string');
        expect(option.id).toMatch(/^[0-9a-f]{24}$/);
      });
    });
  });

  describe('rich text fields return HTML', () => {
    it('returns description as HTML, not lexical JSON', async () => {
      const { data } = await createForm({
        description: '<p>This is the <strong>form</strong> description.</p>',
      });

      expect(data.description).toBeTypeOf('string');
      expect(data.description).toContain('<p>');
      expect(data.description).not.toContain('"root"');
    });

    it('returns confirmationCheckoutMessage as HTML, not slate JSON', async () => {
      const { data } = await createForm({
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: 'Form submitted',
        confirmationCheckoutMessage: '<p>Thanks for submitting.</p>',
      });

      expect(data.confirmationCheckoutMessage).toBeTypeOf('string');
      expect(data.confirmationCheckoutMessage).toContain('<p>');
      expect(data.confirmationCheckoutMessage).not.toContain('"children"');
    });

    it('returns confirmationEmailMessage as HTML, not slate JSON', async () => {
      const { data } = await createForm({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Your submission',
        confirmationEmailMessage: '<p>We received your form.</p>',
      });

      expect(data.confirmationEmailMessage).toBeTypeOf('string');
      expect(data.confirmationEmailMessage).toContain('<p>');
      expect(data.confirmationEmailMessage).not.toContain('"children"');
    });
  });
});
