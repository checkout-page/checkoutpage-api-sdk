import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateCheckoutPageParams } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('CheckoutPagesResource integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const forgetPage = (pageId: string) => {
    createdPageIds = createdPageIds.filter((id) => id !== pageId);
  };

  const createImageFile = (name = 'checkout-page-test.png') => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return new File([new Blob([bytes], { type: 'image/png' })], name, { type: 'image/png' });
  };

  const createDownloadFile = (name = 'checkout-page-guide.txt') => {
    const content = `Checkout page attachment ${uniqueSuffix()}`;
    return new File([new Blob([content], { type: 'text/plain' })], name, { type: 'text/plain' });
  };

  const uploadImage = async () => {
    const result = await client.files.upload({
      file: createImageFile(`checkout-page-${uniqueSuffix()}.png`),
      purpose: 'image',
    });

    return result.data.id;
  };

  const uploadFile = async () => {
    const result = await client.files.upload({
      file: createDownloadFile(`checkout-page-${uniqueSuffix()}.txt`),
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

  const productIncludesImage = (
    page: {
      product?: {
        media?: Array<{
          fileId?: string | null;
        }> | null;
      } | null;
    },
    imageId: string
  ) => page.product?.media?.some((image) => image.fileId === imageId) ?? false;

  const productIncludesFile = (
    page: {
      product?: {
        fileIds?: string[] | null;
      } | null;
    },
    fileId: string
  ) => page.product?.fileIds?.includes(fileId) ?? false;

  const expectPageFlag = (
    page: Record<string, unknown>,
    field: string,
    expected: boolean | string | null
  ) => {
    expect(page[field]).toBe(expected);
  };

  const normalizeSlug = (slug: string | null | undefined) => slug?.replace(/^\/+/, '') ?? slug;

  const createCheckoutPage = async (overrides: Partial<CreateCheckoutPageParams> = {}) => {
    const suffix = uniqueSuffix();
    const params: CreateCheckoutPageParams = {
      name: `SDK Checkout ${suffix}`,
      productData: {
        title: `SDK Product ${suffix}`,
        price: {
          amount: 4900,
          currency: 'usd',
        },
      },
      ...overrides,
    };

    const response = await client.checkoutPages.create(params);
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

  afterEach(async () => {
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        // await client.checkoutPages.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdPageIds = [];
  });

  describe('list', () => {
    it('lists checkout pages', async () => {
      const result = await client.checkoutPages.list();

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('respects the limit query parameter', async () => {
      const result = await client.checkoutPages.list({ limit: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('supports starting_after pagination', async () => {
      await createCheckoutPage();
      await createCheckoutPage();

      const firstPage = await client.checkoutPages.list({ limit: 1 });
      expect(firstPage.data.length).toBe(1);
      expect(firstPage.has_more).toBe(true);

      const secondPage = await client.checkoutPages.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0].id);
    });

    it('supports ending_before pagination', async () => {
      await createCheckoutPage();
      await createCheckoutPage();

      const seedPage = await client.checkoutPages.list({ limit: 2 });
      expect(seedPage.data.length).toBe(2);

      const result = await client.checkoutPages.list({
        limit: 1,
        ending_before: seedPage.data[1].id,
      });

      expect(result.data[0]?.id).not.toBe(seedPage.data[1].id);
    });

    it('filters checkout pages by status', async () => {
      const created = await createCheckoutPage({ status: 'draft' });
      const result = await client.checkoutPages.list({
        status: 'draft',
        search: created.data.name ?? 'unknown',
      });

      expect(result.data.some((page) => page.id === created.data.id)).toBe(true);
      expect(result.data.every((page) => page.status === 'draft')).toBe(true);
    });

    it('filters checkout pages by search', async () => {
      const token = `sdk-search-${uniqueSuffix()}`;
      const created = await createCheckoutPage({ name: token });
      const result = await client.checkoutPages.list({ search: token });

      expect(result.data.some((page) => page.id === created.data.id)).toBe(true);
    });

    it('returns an empty list for an unmatched search', async () => {
      const result = await client.checkoutPages.list({
        search: `sdk-unmatched-${uniqueSuffix()}`,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });

  describe('create', () => {
    it('creates a minimal checkout page', async () => {
      const { data } = await createCheckoutPage();

      expect(data.id).toBeTypeOf('string');
      expect(data.type).toBe('checkout');
      expect(data.status).toBe('published');
      expect(data.product?.title).toContain('SDK Product');
    });

    it('creates a draft checkout page', async () => {
      const { data } = await createCheckoutPage({ status: 'draft' });

      expect(data.status).toBe('draft');
    });

    it('creates a one-time payment checkout page', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `One Time ${uniqueSuffix()}`,
          price: {
            amount: 6500,
            currency: 'usd',
            discountedFromPrice: 8000,
          },
        },
      });

      expect(data.product?.price.amount).toBe(6500);
      expect(data.product?.price.currency).toBe('usd');
      expect(data.product?.price.recurring?.interval).toBeFalsy();
      expect(data.product?.price.paymentPlan?.planIterations).toBeFalsy();
    });

    it('creates a pay what you want checkout page', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `PWYW ${uniqueSuffix()}`,
          price: {
            amount: 100,
            currency: 'usd',
            payWhatYouWant: true,
          },
        },
      });

      expect(data.product?.price.payWhatYouWant).toBe(true);
      expect(data.product?.price.recurring?.interval).toBeFalsy();
      expect(data.product?.price.paymentPlan?.planIterations).toBeFalsy();
    });

    it('fails to create a recurring subscription with trialPeriodDays and startDate set at the same time.', async () => {
      await expect(
        createCheckoutPage({
          productData: {
            title: `Recurring ${uniqueSuffix()}`,
            price: {
              amount: 4999,
              currency: 'usd',
              setupFee: 2999,
              recurring: {
                interval: 'month',
                intervalCount: 1,
                trialPeriodDays: 7,
                startDate: new Date(Date.now() + 86400000).toISOString(),
              },
              discountedFromPrice: 9999,
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('creates a payment plan checkout page', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Payment Plan ${uniqueSuffix()}`,
          price: {
            amount: 12000,
            currency: 'usd',
            paymentPlan: {
              interval: 'month',
              intervalCount: 1,
              planIterations: 3,
            },
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.price.paymentPlan?.interval).toBe('month');
      expect(data.product?.price.paymentPlan?.intervalCount).toBe(1);
      expect(data.product?.price.paymentPlan?.planIterations).toBe(3);
    });

    it('creates a checkout page with uploaded imageIds', async () => {
      const imageId = await uploadImage();
      const { data } = await createCheckoutPage({ imageIds: [imageId] });

      expect(pageIncludesImage(data, imageId)).toBe(true);
    });

    it('creates a checkout page with product fileIds and product imageIds', async () => {
      const productImageId = await uploadImage();
      const productFileId = await uploadFile();
      const { data } = await createCheckoutPage({
        productData: {
          title: `Product attachments ${uniqueSuffix()}`,
          price: {
            amount: 4900,
            currency: 'usd',
          },
          imageIds: [productImageId],
          fileIds: [productFileId],
        },
      });

      expect(productIncludesImage(data, productImageId)).toBe(true);
      expect(productIncludesFile(data, productFileId)).toBe(true);
    }, 15000);

    it('creates a checkout page with inline custom fields', async () => {
      const suffix = uniqueSuffix();
      const { data } = await createCheckoutPage({
        fields: [
          {
            label: 'Email address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: `Company ${suffix}`,
            element: 'text',
            required: true,
          },
        ],
      });

      expect(data.fields?.some((field) => field.label === `Company ${suffix}`)).toBe(true);
    });

    it('rejects inline custom fields with unsupported contains logic', async () => {
      const suffix = uniqueSuffix();
      await expect(
        createCheckoutPage({
          name: `T012_contains_comparison_${suffix}`,
          productData: { title: `T012_${suffix}`, price: { amount: 100, currency: 'usd' } },
          fields: [
            { label: 'Email Address', element: 'email', type: 'email', required: true },
            {
              label: 'Trigger Select',
              element: 'select',
              key: 'trigger-select',
              options: [
                { label: 'Premium', value: 'premium', key: 'opt-premium' },
                { label: 'Basic', value: 'basic', key: 'opt-basic' },
              ],
            },
            {
              label: 'Conditional Notes',
              element: 'textarea',
              showHideLogic: {
                enabled: true,
                comparison: 'contains',
                element: { elementType: 'field', elementId: 'trigger-select' },
                value: 'opt-premium',
              },
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it.each([
      [
        'text field trigger with is comparison',
        [
          {
            label: 'Email Address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: 'Trigger Text',
            element: 'text',
            key: 'trigger-text',
            required: true,
          },
          {
            label: 'Conditional Notes',
            element: 'textarea',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementType: 'field', elementId: 'trigger-text' },
              value: 'yes',
            },
          },
        ],
        /cannot be used as a conditional-logic trigger/,
      ],
      [
        'checkbox trigger with is_empty comparison',
        [
          {
            label: 'Email Address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: 'Agree to Terms',
            element: 'checkbox',
            key: 'agree-to-terms',
            required: true,
          },
          {
            label: 'Conditional Notes',
            element: 'textarea',
            showHideLogic: {
              enabled: true,
              comparison: 'is_empty',
              element: { elementType: 'field', elementId: 'agree-to-terms' },
              value: 'TRUE',
            },
          },
        ],
        /checkbox triggers only support "is" and "is_not"/,
      ],
      [
        'checkbox trigger with is comparison and TRUE value',
        [
          {
            label: 'Email Address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: 'Agree to Terms',
            element: 'checkbox',
            key: 'agree-to-terms',
            required: true,
          },
          {
            label: 'Conditional Notes',
            element: 'textarea',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementType: 'field', elementId: 'agree-to-terms' },
              value: 'TRUE',
            },
          },
        ],
        null,
      ],
      [
        'checkbox trigger with is_not comparison and FALSE value',
        [
          {
            label: 'Email Address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: 'Agree to Terms',
            element: 'checkbox',
            key: 'agree-to-terms',
            required: true,
          },
          {
            label: 'Conditional Notes',
            element: 'textarea',
            showHideLogic: {
              enabled: true,
              comparison: 'is_not',
              element: { elementType: 'field', elementId: 'agree-to-terms' },
              value: 'FALSE',
            },
          },
        ],
        null,
      ],
      [
        'checkbox trigger with invalid boolean token',
        [
          {
            label: 'Email Address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: 'Agree to Terms',
            element: 'checkbox',
            key: 'agree-to-terms',
            required: true,
          },
          {
            label: 'Conditional Notes',
            element: 'textarea',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementType: 'field', elementId: 'agree-to-terms' },
              value: 'yes',
            },
          },
        ],
        /checkbox triggers must use "TRUE" or "FALSE"/,
      ],
    ] as const)(
      'handles inline custom fields with %s',
      async (_scenario, fields, expectedMessage) => {
        const suffix = uniqueSuffix();

        if (expectedMessage) {
          await expect(
            createCheckoutPage({
              name: `T011_field_trigger_limits_${suffix}`,
              productData: {
                title: `T011_${suffix}`,
                price: { amount: 100, currency: 'usd' },
              },
              // @ts-ignore
              fields,
            })
          ).rejects.toThrow(expectedMessage);

          return;
        }

        const { data } = await createCheckoutPage({
          name: `T011_checkbox_true_${suffix}`,
          productData: {
            title: `T011_${suffix}`,
            price: { amount: 100, currency: 'usd' },
          },
          // @ts-ignore
          fields,
        });

        const triggerField = data.fields?.find((field) => field.label === 'Agree to Terms');
        const conditionalField = data.fields?.find((field) => field.label === 'Conditional Notes');
        const inputLogic = fields[2].showHideLogic;

        expect(triggerField?.id).toMatch(/^[0-9a-f]{24}$/);
        expect(conditionalField?.showHideLogic).toMatchObject({
          enabled: true,
          comparison: inputLogic?.comparison,
          element: {
            elementType: 'field',
            elementId: triggerField?.id,
          },
          value: inputLogic?.value,
        });

        const fetched = await client.checkoutPages.get(data.id);
        const fetchedTriggerField = fetched.data.fields?.find(
          (field) => field.label === 'Agree to Terms'
        );
        const fetchedConditionalField = fetched.data.fields?.find(
          (field) => field.label === 'Conditional Notes'
        );

        expect(fetchedConditionalField?.showHideLogic).toMatchObject({
          enabled: true,
          comparison: inputLogic?.comparison,
          element: {
            elementType: 'field',
            elementId: fetchedTriggerField?.id,
          },
          value: inputLogic?.value,
        });
      }
    );

    it('creates a checkout page with redirect configuration', async () => {
      const { data } = await createCheckoutPage({
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/thank-you',
        redirectUrlQuery: [
          {
            parameter: 'orderId',
            key: 'orderId',
            identifier: 'orderId',
          },
        ],
      });

      expect(data.afterPaymentAction).toBe('redirect');
      expect(data.redirectUrl).toBe('https://example.com/thank-you');
    });

    it('creates a checkout page with checkout redirect configuration', async () => {
      const { data } = await createCheckoutPage({
        afterPaymentAction: 'checkout',
        redirectPageId: config.testCheckoutPageId,
      });

      expect(data.afterPaymentAction).toBe('checkout');
      expect(data.redirectPageId).toBe(config.testCheckoutPageId);
    });

    it('creates a checkout page with customized confirmation email content', async () => {
      const { data } = await createCheckoutPage({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Thanks for your order',
        confirmationEmailMessage: '<p>Your order is confirmed.</p>',
      });

      expect(data.customizeEmailConfirmation).toBe(true);
      expect(data.confirmationEmailSubject).toBe('Thanks for your order');
    });

    it.each([
      ['allowDynamicTitle', { allowDynamicTitle: true }, true],
      ['allowDynamicDescription', { allowDynamicDescription: true }, true],
      ['closePopupOnClickOutside', { closePopupOnClickOutside: true }, true],
      ['sendPaymentNotification', { sendPaymentNotification: false }, false],
      ['sendEmailConfirmation', { sendEmailConfirmation: true }, true],
      ['googleIndex', { googleIndex: false }, false],
      ['savePaymentMethod', { savePaymentMethod: true }, true],
      ['showCouponCodeField', { showCouponCodeField: true }, true],
      [
        'showCouponCodeFieldType',
        { showCouponCodeField: true, showCouponCodeFieldType: 'field' },
        'field',
      ],
      ['allowDynamicPrice', { allowDynamicPrice: true }, true],
      ['allowDynamicDiscountedFromPrice', { allowDynamicDiscountedFromPrice: true }, true],
      ['allowDynamicRedirectUrl', { allowDynamicRedirectUrl: true }, true],
      [
        'enableFileAccessForInactiveSubscriptions',
        { enableFileAccessForInactiveSubscriptions: true },
        true,
      ],
      [
        'sendCanceledSubscriptionNotifications',
        { sendCanceledSubscriptionNotifications: false },
        false,
      ],
      [
        'sendRecurringPaymentFailedNotifications',
        { sendRecurringPaymentFailedNotifications: false },
        false,
      ],
      [
        'sendRecurringPaymentSucceededNotifications',
        { sendRecurringPaymentSucceededNotifications: false },
        false,
      ],
      ['allowDynamicPlanIterations', { allowDynamicPlanIterations: true }, true],
    ] as const)('creates a checkout page with %s configured', async (field, override, expected) => {
      const { data } = await createCheckoutPage(override);

      expectPageFlag(data as Record<string, unknown>, field, expected);
    });

    it('creates a checkout page with locale slug and tracking codes', async () => {
      const { data } = await createCheckoutPage({
        locale: 'fr-FR',
        slug: `/sdk-checkout-${uniqueSuffix()}`,
        trackingCodes: '<script>window.sdkCheckoutTest=true;</script>',
      });

      expect(data.locale).toBe('fr-FR');
      expect(normalizeSlug(data.slug)).toContain('sdk-checkout-');
      expect(data.trackingCodes).toContain('sdkCheckoutTest');
    });

    it('rejects an uppercase slug on create', async () => {
      await expect(
        createCheckoutPage({
          slug: `/SDK-Checkout-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('creates a checkout page with invoice settings checkout abandonment and tax', async () => {
      const { data } = await createCheckoutPage({
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
        checkoutAbandonment: {
          disableEmails: true,
          showStoreLogo: false,
          showStoreName: true,
        },
        tax: {
          enabled: true,
        },
      });

      expect(data.invoiceSettings?.bankDetails).toBe('Account 123456');
      expect(data.invoiceSettings?.additionalInformation?.title).toBe('Payment terms');
      expect(data.invoiceSettings?.dueDays?.days).toBe(30);
      expect(data.checkoutAbandonment?.disableEmails).toBe(true);
      expect(data.checkoutAbandonment?.showStoreLogo).toBe(false);
      expect(data.tax?.enabled).toBe(true);
    });

    it('creates an invoice-only checkout page with the full default payment option set', async () => {
      const { data } = await createCheckoutPage({
        slug: `sdk-invoice-only-${uniqueSuffix()}`,
        paymentOptions: [
          {
            type: 'manual',
            enabled: true,
            name: 'Pay by invoice',
            description: 'We will send an invoice after checkout.',
            instructions: 'Please pay within 30 days.',
            showPaymentButton: false,
            manualType: 'invoice',
          },
        ],
        invoiceSettings: {
          bankDetails: 'Account 123456',
          dueDays: {
            enabled: true,
            days: 30,
          },
          additionalInformation: {
            enabled: true,
            title: 'Payment terms',
            message: 'Payment is due within 30 days of invoice receipt.',
          },
        },
      });
      expect(data.paymentOptions).toHaveLength(4);
      expect(data.paymentOptions?.[0]).toMatchObject({
        type: 'full',
        enabled: false,
        name: 'Pay in full',
        showPaymentButton: true,
      });
      expect(data.paymentOptions?.[1]).toMatchObject({
        type: 'manual',
        enabled: true,
        name: 'Pay by invoice',
        showPaymentButton: true,
        manualType: 'invoice',
      });
      expect(data.paymentOptions?.[2]).toMatchObject({
        type: 'partial',
        enabled: false,
        name: 'Pay a deposit',
        partialAmount: 5000,
        showPaymentButton: true,
      });
      expect(data.paymentOptions?.[3]).toMatchObject({
        type: 'manual',
        enabled: false,
        name: 'Cash on delivery',
        showPaymentButton: true,
        manualType: 'cash_on_delivery',
      });
      expect(data.invoiceSettings?.bankDetails).toBe('Account 123456');
      expect(data.invoiceSettings?.dueDays).toMatchObject({
        enabled: true,
        days: 30,
      });
      expect(data.invoiceSettings?.additionalInformation).toMatchObject({
        enabled: true,
        title: 'Payment terms',
      });

      // Stripe defaults remain present until callers explicitly disable them.
      expect(data.paymentMethods?.stripe?.card?.enabled).toBe(true);
      expect(data.paymentMethods?.stripe?.agpay?.enabled).toBe(true);
    });

    it('creates a checkout page with checkout abandonment email reminders', async () => {
      const { data } = await createCheckoutPage({
        checkoutAbandonment: {
          disableEmails: false,
          emailReminders: {
            reminder1: {
              customizeEmail: true,
              subject: 'Did you forget something?',
              body: '<p>You left items in your cart.</p>',
              buttonText: 'Complete your purchase',
            },
            reminder2: {
              customizeEmail: true,
              subject: 'Your cart is waiting',
              body: '<p>Come back and finish your order.</p>',
              buttonText: 'Return to cart',
            },
            reminder3: {
              customizeEmail: false,
            },
          },
        },
      });

      expect(data.checkoutAbandonment?.disableEmails).toBe(false);
      expect(data.checkoutAbandonment?.emailReminders?.reminder1?.customizeEmail).toBe(true);
      expect(data.checkoutAbandonment?.emailReminders?.reminder1?.subject).toBe(
        'Did you forget something?'
      );
      expect(data.checkoutAbandonment?.emailReminders?.reminder1?.buttonText).toBe(
        'Complete your purchase'
      );
      expect(data.checkoutAbandonment?.emailReminders?.reminder2?.customizeEmail).toBe(true);
      expect(data.checkoutAbandonment?.emailReminders?.reminder2?.subject).toBe(
        'Your cart is waiting'
      );
      expect(data.checkoutAbandonment?.emailReminders?.reminder3?.customizeEmail).toBe(false);
    });

    it('creates a checkout page with payment methods payment options and fees', async () => {
      const { data } = await createCheckoutPage({
        paymentMethods: {
          stripe: {
            card: { enabled: true },
            agpay: { enabled: true, mode: 'express' },
            multiple: { enabled: true },
          },
        },
        paymentOptions: [
          {
            type: 'full',
            enabled: true,
            name: 'Pay in full',
            description: 'Pay everything now',
            showPaymentButton: true,
          },
          {
            type: 'partial',
            enabled: true,
            name: 'Pay deposit',
            description: 'Pay part now',
            partialAmount: 1500,
            instructions: 'Pay the rest later.',
            showPaymentButton: true,
          },
          {
            type: 'manual',
            enabled: true,
            name: 'Invoice me',
            description: 'Pay offline',
            instructions: 'We will send an invoice.',
            showPaymentButton: false,
            manualType: 'invoice',
          },
        ],
        fees: [
          {
            name: 'Processing fee',
            amount: 125,
            multiplyByQuantity: true,
            applyToSpecificPaymentMethods: true,
            paymentMethods: ['card'],
          },
          {
            name: 'Percentage processing fee',
            percentage: 1,
            multiplyByQuantity: false,
            applyToSpecificPaymentMethods: false,
          },
        ],
      });

      expect(data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(data.paymentMethods?.stripe?.multiple?.enabled).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'manual')).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'partial')).toBe(true);
      expect(data.fees?.[0]?.name).toBe('Processing fee');
      expect(data.fees?.[0]?.amount).toBe(125);

      expect(data.fees?.[1]?.name).toBe('Percentage processing fee');
      expect(data.fees?.[1]?.percentage).toBe(1);
    });

    it('creates a large page with many options, fields, variants etc', async () => {
      const suffix = uniqueSuffix();
      const slug = `t013b-qa-scenario-slice-${suffix}`;

      const { data } = await createCheckoutPage({
        name: `T013b_QA_scenario_slice_${suffix}`,
        slug,
        status: 'published',
        locale: 'en-US',
        googleIndex: false,
        closePopupOnClickOutside: true,
        trackingCodes:
          "<!-- GTM stub --><script>(function(w,d,s,l,i){w[l]=w[l]||[];})(window,document,'script','dataLayer','GTM-XXXXXX');</script>",
        tax: { enabled: true },
        notifyEmail: 'team@example.com,sales@example.com',
        sendEmailConfirmation: true,
        sendPaymentNotification: true,
        savePaymentMethod: true,
        showCouponCodeField: true,
        showCouponCodeFieldType: 'field',
        allowDynamicDescription: true,
        allowDynamicPrice: true,
        allowDynamicTitle: true,
        allowDynamicDiscountedFromPrice: true,
        allowDynamicRedirectUrl: true,
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/thank-you',
        redirectUrlInsideEmbed: true,
        redirectUrlPath: [{ identifier: 'orderId', key: 'orderId' }],
        redirectUrlQuery: [
          { identifier: 'orderId', key: 'orderId' },
          { fieldKey: 'email-field', key: 'fields', parameter: 'email' },
        ],
        redirect: { enabled: false, url: 'https://example.com/redirected' },
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: 'Your teapot is on its way',
        confirmationCheckoutMessage:
          "<p>Thanks for your order. We'll send tracking when it ships.</p>",
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Your artisan teapot order is confirmed',
        confirmationEmailMessage:
          "<h2>Thanks for ordering</h2><p>Here's what's <strong>included</strong>:</p><ul><li>The teapot</li><li>Care instructions</li><li>Optional bonuses</li></ul>",
        confirmationEmailShowLogo: true,
        confirmationEmailShowStoreName: true,
        checkoutAbandonment: {
          disableEmails: false,
          showStoreLogo: true,
          showStoreName: true,
          emailReminders: {
            reminder1: {
              customizeEmail: true,
              subject: 'Only a few teapots left',
              body: '<p>Stock is limited — secure yours.</p>',
              buttonText: 'Complete order',
            },
            reminder2: {
              customizeEmail: true,
              subject: 'Bonuses included with your teapot',
              body: '<p>Your purchase includes:</p><ul><li>Care guide</li><li>Tea sampler</li></ul>',
              buttonText: 'Pick up where you left off',
            },
            reminder3: {
              customizeEmail: true,
              subject: 'Last chance — your cart expires soon',
              body: '<p>This cart expires shortly.</p>',
              buttonText: 'Finish checkout',
            },
          },
        },
        paymentMethods: {
          stripe: {
            card: { enabled: true },
            agpay: { enabled: true, mode: 'express' },
            multiple: { enabled: true },
          },
        },
        paymentOptions: [
          {
            type: 'full',
            name: 'Pay in full',
            description: 'Pay the full amount today.',
            enabled: true,
            showPaymentButton: true,
            instructions: '',
          },
          {
            type: 'partial',
            name: 'Pay deposit',
            description: 'Pay 50% now.',
            enabled: true,
            partialAmount: 4500,
            showPaymentButton: true,
            instructions: 'Balance invoice will follow.',
          },
          {
            type: 'manual',
            manualType: 'invoice',
            name: 'Pay via invoice',
            description: 'Receive an invoice.',
            enabled: true,
            showPaymentButton: false,
            instructions: 'Bank details on the invoice.',
          },
          {
            type: 'manual',
            manualType: 'cash_on_delivery',
            name: 'Cash on delivery',
            description: 'Pay on receipt.',
            enabled: true,
            showPaymentButton: false,
            instructions: 'Have payment ready at delivery.',
          },
        ],
        invoiceSettings: {
          bankDetails: 'Account: 12345678\nSort code: 00-00-00\nBank: Example Bank Plc',
          dueDays: { enabled: true, days: 30 },
          additionalInformation: {
            enabled: true,
            title: 'Payment terms',
            message: 'Payment is due within 30 days of invoice date.',
          },
        },
        fees: [
          {
            name: 'Card processing',
            amount: 200,
            applyToSpecificPaymentMethods: true,
            paymentMethods: ['card', 'link'],
            multiplyByQuantity: false,
            multiplyByTickets: false,
          },
          {
            name: 'Service fee',
            percentage: 2.5,
            applyToSpecificPaymentMethods: false,
            multiplyByQuantity: true,
            multiplyByTickets: false,
          },
        ],
        funnelSteps: [
          {
            type: 'upsell',
            order: 1,
            enabled: true,
            config: { action: 'checkout', pageId: config.testCheckoutPageId },
          },
          {
            type: 'upsell',
            order: 2,
            enabled: true,
            config: {
              action: 'redirect',
              redirect: {
                url: 'https://offers.example.com/post-purchase',
                path: [{ identifier: 'orderId', key: 'orderId' }],
                query: [
                  { identifier: 'orderId', key: 'orderId' },
                  { fieldKey: 'email-field', key: 'fields', parameter: 'email' },
                ],
              },
            },
          },
          {
            type: 'confirmation',
            order: 3,
            enabled: true,
            config: {
              action: 'confirmation',
              customizeCheckoutConfirmation: true,
              confirmationCheckoutTitle: 'Funnel-scoped confirmation',
              confirmationCheckoutMessage: '<p>Funnel-step confirmation copy</p>',
            },
          },
        ],
        fields: [
          {
            label: 'Email',
            element: 'email',
            type: 'email',
            required: true,
            order: 0,
            description: 'Your email',
            placeholder: 'you@example.com',
            reference: 'customer_email',
            key: 'email-field',
          },
          {
            label: 'Name',
            element: 'text',
            type: 'name',
            required: true,
            order: 1,
            description: 'Full name',
          },
          {
            label: 'Phone',
            element: 'phone',
            type: 'phone',
            required: false,
            order: 2,
            description: 'Phone',
            showSelectedDialCode: true,
            key: 'phone-field',
          },
          {
            label: 'Alt Contact',
            element: 'text',
            required: false,
            order: 3,
            description: 'Alternate contact',
          },
          {
            label: 'Buyer Type',
            element: 'select',
            required: true,
            order: 4,
            description: 'Are you buying as an individual or business?',
            key: 'buyer-type',
            options: [
              { label: 'Individual', value: 'individual', key: 'ind' },
              { label: 'Business', value: 'business', key: 'biz' },
            ],
          },
          {
            label: 'Company',
            element: 'text',
            type: 'company-name',
            required: true,
            order: 5,
            description: 'Company name',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementId: 'buyer-type', elementType: 'field' },
              value: 'biz',
            },
          },
          {
            label: 'Tax ID',
            element: 'tax-id',
            required: false,
            order: 6,
            description: 'Tax/VAT',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementId: 'buyer-type', elementType: 'field' },
              value: 'biz',
            },
          },
          {
            label: 'PO Number',
            element: 'po-number',
            required: false,
            order: 7,
            description: 'PO',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementId: 'buyer-type', elementType: 'field' },
              value: 'biz',
            },
          },
          {
            label: 'Country',
            element: 'country',
            type: 'address-country',
            required: true,
            order: 8,
            description: 'Shipping country',
            limitAllowedCountries: {
              enabled: true,
              countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
            },
          },
          {
            label: 'Recipient',
            element: 'text',
            type: 'shipping-name',
            required: true,
            order: 9,
            description: 'Recipient name',
          },
          {
            label: 'Address 1',
            element: 'text',
            type: 'shipping-address-line1',
            required: true,
            order: 10,
            description: 'Address line 1',
          },
          {
            label: 'Address 2',
            element: 'text',
            type: 'shipping-address-line2',
            required: false,
            order: 11,
            description: 'Address line 2',
          },
          {
            label: 'City',
            element: 'text',
            type: 'shipping-address-city',
            required: true,
            order: 12,
            description: 'City',
          },
          {
            label: 'State',
            element: 'text',
            type: 'shipping-address-state',
            required: false,
            order: 13,
            description: 'State',
          },
          {
            label: 'Postal Code',
            element: 'text',
            type: 'shipping-address-postal_code',
            required: true,
            order: 14,
            description: 'Postal code',
          },
          {
            label: 'Gift Wrap',
            element: 'checkbox',
            required: false,
            order: 15,
            description: 'Gift wrap',
          },
          {
            label: 'Gift Message',
            element: 'textarea',
            required: false,
            order: 16,
            description: 'Gift message',
          },
          {
            label: 'Delivery Date',
            element: 'date',
            required: false,
            order: 17,
            description: 'Preferred delivery date',
          },
          {
            label: 'Delivery Time',
            element: 'time',
            required: false,
            order: 18,
            description: 'Preferred time',
          },
          {
            label: 'Source',
            element: 'multiple-choice',
            required: false,
            order: 19,
            description: 'How did you hear about us?',
            key: 'source-mc',
            options: [
              { label: 'Search', value: 'search', key: 'src-search' },
              { label: 'Social', value: 'social', key: 'src-social' },
              { label: 'Referral', value: 'referral', key: 'src-referral' },
              { label: 'Conference', value: 'conference', key: 'src-conf' },
              { label: 'Other', value: 'other', key: 'src-other' },
            ],
          },
          {
            label: 'Q&A Time',
            element: 'date-time',
            required: false,
            order: 20,
            description: 'Best time for Q&A',
            showHideLogic: {
              enabled: true,
              comparison: 'is',
              element: { elementId: 'source-mc', elementType: 'field' },
              value: 'src-referral',
            },
          },
          {
            label: 'Member Code',
            element: 'number',
            required: false,
            order: 21,
            description: 'Loyalty member code',
            minValue: { enabled: true, value: '1000' },
            maxValue: { enabled: true, value: '9999' },
          },
          {
            label: 'Bonus Quantity',
            element: 'quantity',
            required: false,
            order: 22,
            description: 'Bonus units',
          },
          {
            label: 'Discovery Notes',
            element: 'text',
            required: false,
            order: 23,
            description: 'Anything we should know',
            defaultValue: { enabled: true, value: 'From newsletter' },
            reference: 'discovery_source',
          },
          {
            label: 'UTM Source',
            element: 'text',
            required: false,
            order: 24,
            description: 'UTM tracking',
            hidden: true,
            reference: 'utm_source',
          },
          {
            label: 'Terms',
            element: 'checkbox',
            required: true,
            order: 25,
            description: 'Accept terms',
          },
        ],
        productData: {
          title: 'Artisan Ceramic Teapot',
          description:
            '<h2 id="Artisan-Teapot">Hand-thrown Stoneware Teapot</h2><p>A <strong>limited-edition</strong> teapot by independent ceramicists. Each piece is unique. <a href="https://example.com">Read the maker story</a>.</p><ul><li>Food-safe glaze</li><li>Microwave and dishwasher safe</li><li>Holds approx. 750ml</li></ul>',
          sku: 'TEAPOT-T013B-MAIN',
          stock: 200,
          hasUnlimitedStock: false,
          generateLicenseKeys: true,
          taxBehavior: 'exclusive',
          taxCode: 'txcd_99999999',
          variantsRequired: true,
          price: {
            amount: 9900,
            currency: 'usd',
            discountedFromPrice: 14900,
            setupFee: 1000,
            setupFeeMultipliesWithQuantity: true,
            pricingType: 'single',
          },
          discounts: [
            { quantityCondition: 'checkout_quantity', minQuantity: 3, percentOff: 5 },
            { quantityCondition: 'checkout_quantity', minQuantity: 10, percentOff: 15 },
            {
              quantityCondition: 'variant_option_quantity',
              variantOptionIds: [{ key: 'mp-1' }, { key: 'mp-3' }, { key: 'mp-6' }],
              minQuantity: 2,
              percentOff: 10,
            },
          ],
          variants: [
            {
              name: 'Size',
              key: 'size-v',
              order: 0,
              required: true,
              status: 'enabled',
              selectionType: 'single',
              reference: '550e8400-e29b-41d4-a716-446655440000',
              preselect: { enabled: true, optionId: 'size-m', quantity: 1 },
              layout: {
                variantOptionLayout: 'grid',
                variantOptionColumns: 3,
                imageSize: 'medium',
                spacing: 'comfortable',
                textAlign: 'left',
                showVariantName: true,
                showVariantOptionNames: true,
                showVariantOptionPrices: true,
                showVariantOptionPriceSign: true,
                collapseVariantOptions: false,
              },
              options: [
                {
                  name: 'Small',
                  key: 'size-s',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  description: 'Personal size',
                },
                {
                  name: 'Medium',
                  key: 'size-m',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 500,
                  discountedFromPrice: 1500,
                  description: 'Family size',
                },
                {
                  name: 'Large',
                  key: 'size-l',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 1000,
                  description: 'Sharing size',
                },
              ],
            },
            {
              name: 'Glaze',
              key: 'glaze-v',
              order: 1,
              required: false,
              status: 'enabled',
              selectionType: 'single',
              preselect: { enabled: true, optionId: 'gl-none', quantity: 1 },
              layout: {
                variantOptionLayout: 'list',
                spacing: 'compact',
                imageSize: 'small',
                textAlign: 'left',
                showVariantName: true,
                showVariantOptionNames: true,
                showVariantOptionPrices: true,
              },
              options: [
                {
                  name: 'None',
                  key: 'gl-none',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  description: 'No glaze',
                },
                {
                  name: 'Matte',
                  key: 'gl-matte',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  description: 'Matte finish',
                },
                {
                  name: 'Glossy',
                  key: 'gl-glossy',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 300,
                  description: 'Glossy finish',
                },
                {
                  name: 'Speckled',
                  key: 'gl-speckled',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 200,
                  description: 'Speckled finish',
                },
              ],
            },
            {
              name: 'Liner Colour',
              key: 'liner-v',
              order: 2,
              required: false,
              status: 'enabled',
              selectionType: 'single',
              showHideLogic: {
                enabled: true,
                comparison: 'is_not',
                element: { elementId: 'glaze-v' },
                value: 'gl-none',
              },
              layout: { variantOptionLayout: 'list', spacing: 'compact' },
              options: [
                {
                  name: 'Cream',
                  key: 'liner-cream',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  description: 'Cream',
                },
                {
                  name: 'Sand',
                  key: 'liner-sand',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 50,
                  description: 'Sand',
                },
                {
                  name: 'Charcoal',
                  key: 'liner-char',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 50,
                  description: 'Charcoal',
                },
              ],
            },
            {
              name: 'Add-ons',
              key: 'addons-v',
              order: 3,
              required: false,
              status: 'enabled',
              selectionType: 'multiple',
              useVariantOptionSkus: true,
              layout: { variantOptionLayout: 'list', spacing: 'compact' },
              options: [
                {
                  name: 'Storage Tin',
                  key: 'add-tin',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 200,
                  sku: 'TEAPOT-TIN',
                  description: 'Tin',
                },
                {
                  name: 'Strainer',
                  key: 'add-strainer',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 300,
                  sku: 'TEAPOT-STR',
                  description: 'Strainer',
                },
                {
                  name: 'Cosy',
                  key: 'add-cosy',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 500,
                  sku: 'TEAPOT-COS',
                  description: 'Wool cosy',
                },
                {
                  name: 'Certificate',
                  key: 'add-cert',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  sku: 'TEAPOT-CERT',
                  description: 'Certificate of authenticity',
                },
              ],
            },
            {
              name: 'Engraving',
              key: 'engr-v',
              order: 4,
              required: false,
              status: 'enabled',
              selectionType: 'single',
              layout: { variantOptionLayout: 'list', spacing: 'comfortable' },
              options: [
                {
                  name: 'None',
                  key: 'engr-none',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  description: 'No engraving',
                },
                {
                  name: 'Custom',
                  key: 'engr-custom',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 1000,
                  description: 'Custom engraving',
                },
              ],
            },
            {
              name: 'Multipack',
              key: 'multi-v',
              required: false,
              status: 'enabled',
              selectionType: 'quantity',
              increasesWithQuantity: false,
              manageVariantOptionStock: true,
              useVariantOptionSkus: true,
              layout: { variantOptionLayout: 'list', spacing: 'compact' },
              options: [
                {
                  name: 'Single',
                  key: 'mp-1',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 0,
                  stock: 100,
                  sku: 'TEAPOT-1PK',
                  description: '1 piece',
                },
                {
                  name: 'Triple',
                  key: 'mp-3',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 1500,
                  stock: 50,
                  sku: 'TEAPOT-3PK',
                  description: '3 pieces',
                },
                {
                  name: 'Six-pack',
                  key: 'mp-6',
                  type: 'one_time',
                  status: 'enabled',
                  additionalChargeAmount: 2500,
                  stock: 20,
                  sku: 'TEAPOT-6PK',
                  description: '6 pieces',
                },
              ],
            },
          ],
        },
      });

      expect(data.slug).toBe(slug);
      expect(data.locale).toBe('en-US');
      expect(data.googleIndex).toBe(false);
      expect(data.redirectUrlInsideEmbed).toBe(true);
      expect(data.notifyEmail).toBe('team@example.com,sales@example.com');
      expect(data.trackingCodes).toContain('GTM-XXXXXX');
      expect(data.invoiceSettings?.dueDays?.days).toBe(30);
      expect(data.checkoutAbandonment?.emailReminders?.reminder3?.subject).toBe(
        'Last chance — your cart expires soon'
      );
      expect(data.paymentMethods?.stripe?.multiple?.enabled).toBe(true);
      expect(data.paymentOptions).toHaveLength(4);
      expect(data.paymentOptions?.find((option) => option.type === 'partial')).toMatchObject({
        enabled: true,
        partialAmount: 4500,
      });
      expect(
        data.paymentOptions?.find(
          (option) => option.type === 'manual' && option.manualType === 'invoice'
        )
      ).toMatchObject({
        enabled: true,
        showPaymentButton: true,
        instructions: 'Bank details on the invoice.',
      });
      expect(
        data.paymentOptions?.find(
          (option) => option.type === 'manual' && option.manualType === 'cash_on_delivery'
        )
      ).toMatchObject({
        enabled: true,
        showPaymentButton: true,
      });
      expect(data.fees).toHaveLength(2);
      expect(data.fees?.[0]).toMatchObject({
        name: 'Card processing',
        amount: 200,
        applyToSpecificPaymentMethods: true,
      });
      expect(data.funnelSteps).toHaveLength(3);
      expect(data.funnelSteps?.[0]).toMatchObject({
        type: 'upsell',
        order: 1,
        config: { action: 'checkout', pageId: config.testCheckoutPageId },
      });
      expect(data.funnelSteps?.[1]).toMatchObject({
        type: 'upsell',
        order: 2,
        config: {
          action: 'redirect',
          redirect: { url: 'https://offers.example.com/post-purchase' },
        },
      });
      expect(data.funnelSteps?.[2]).toMatchObject({
        type: 'confirmation',
        order: 3,
        config: {
          action: 'confirmation',
          confirmationCheckoutTitle: 'Funnel-scoped confirmation',
        },
      });

      const emailField = data.fields?.find((field) => field.reference === 'customer_email');
      const buyerTypeField = data.fields?.find((field) => field.label === 'Buyer Type');
      const sourceField = data.fields?.find((field) => field.label === 'Source');
      const companyField = data.fields?.find((field) => field.label === 'Company');
      const qaTimeField = data.fields?.find((field) => field.label === 'Q&A Time');
      const memberCodeField = data.fields?.find((field) => field.label === 'Member Code');
      const hiddenUtmField = data.fields?.find((field) => field.reference === 'utm_source');

      expect(emailField?.id).toMatch(/^[0-9a-f]{24}$/);
      expect(data.redirectUrlPath).toEqual([{ identifier: 'orderId', key: 'orderId' }]);
      expect(data.redirectUrlQuery).toEqual([
        { identifier: 'orderId', key: 'orderId' },
        { identifier: emailField?.id, key: 'fields', parameter: 'email' },
      ]);
      // @ts-ignore
      expect(data.funnelSteps?.[1]?.config?.redirect?.query).toEqual([
        { identifier: 'orderId', key: 'orderId' },
        { identifier: emailField?.id, key: 'fields', parameter: 'email' },
      ]);
      expect(companyField?.showHideLogic).toMatchObject({
        enabled: true,
        comparison: 'is',
        element: { elementId: buyerTypeField?.id, elementType: 'field' },
      });
      expect(qaTimeField?.showHideLogic).toMatchObject({
        enabled: true,
        comparison: 'is',
        element: { elementId: sourceField?.id, elementType: 'field' },
      });
      expect(companyField?.showHideLogic?.value).toMatch(/^[0-9a-f]{24}$/);
      expect(qaTimeField?.showHideLogic?.value).toMatch(/^[0-9a-f]{24}$/);
      expect(memberCodeField?.minValue).toMatchObject({ enabled: true, value: '1000' });
      expect(memberCodeField?.maxValue).toMatchObject({ enabled: true, value: '9999' });
      expect(hiddenUtmField?.hidden).toBe(true);

      expect(data.product?.title).toBe('Artisan Ceramic Teapot');
      expect(data.product?.sku).toBe('TEAPOT-T013B-MAIN');
      expect(data.product?.stock).toBe(200);
      expect(data.product?.generateLicenseKeys).toBe(true);
      expect(data.product?.taxBehavior).toBe('exclusive');
      expect(data.product?.taxCode).toBe('txcd_99999999');
      expect(data.product?.variantsRequired).toBe(true);
      expect(data.product?.price).toMatchObject({
        amount: 9900,
        currency: 'usd',
        discountedFromPrice: 14900,
        setupFee: 1000,
        setupFeeMultipliesWithQuantity: true,
      });
      expect(data.product?.discounts).toHaveLength(3);
      expect(
        data.product?.discounts?.find(
          (discount) => discount.quantityCondition === 'variant_option_quantity'
        )?.variantOptionIds
      ).toHaveLength(3);

      const sizeVariant = data.product?.variants?.find((variant) => variant.name === 'Size');
      const glazeVariant = data.product?.variants?.find((variant) => variant.name === 'Glaze');
      const linerVariant = data.product?.variants?.find(
        (variant) => variant.name === 'Liner Colour'
      );
      const multipackVariant = data.product?.variants?.find(
        (variant) => variant.name === 'Multipack'
      );

      expect(data.product?.variants).toHaveLength(6);
      expect(sizeVariant?.preselect?.enabled).toBe(true);
      expect(sizeVariant?.preselect?.optionId).toBe(
        sizeVariant?.options?.find((option) => option.name === 'Medium')?.id
      );
      expect(glazeVariant?.preselect?.optionId).toBe(
        glazeVariant?.options?.find((option) => option.name === 'None')?.id
      );
      expect(linerVariant?.showHideLogic?.comparison).toBe('is_not');
      expect(linerVariant?.showHideLogic?.element?.elementId).toBe(glazeVariant?.id);
      expect(linerVariant?.showHideLogic?.value).toBe(
        glazeVariant?.options?.find((option) => option.name === 'None')?.id
      );
      expect(multipackVariant?.selectionType).toBe('quantity');
      expect(multipackVariant?.manageVariantOptionStock).toBe(true);
      expect(multipackVariant?.useVariantOptionSkus).toBe(true);
      expect(
        data.product?.discounts?.find(
          (discount) => discount.quantityCondition === 'variant_option_quantity'
        )?.variantOptionIds
      ).toEqual(multipackVariant?.options?.map((option) => option.id));

      const fetched = await client.checkoutPages.get(data.id);
      expect(fetched.data.id).toBe(data.id);
      expect(fetched.data.paymentOptions).toHaveLength(4);
      expect(fetched.data.fields).toHaveLength(26);
      expect(fetched.data.funnelSteps).toHaveLength(3);
      expect(fetched.data.product?.variants).toHaveLength(6);
      expect(fetched.data.redirectUrlQuery).toEqual(data.redirectUrlQuery);
    }, 30000);

    it('creates a checkout page with funnel steps', async () => {
      const { data } = await createCheckoutPage({
        funnelSteps: [
          {
            type: 'checkout' as const,
            order: 0,
            enabled: true,
            config: {
              pageId: config.testCheckoutPageId,
            },
          },
        ],
      });

      expect(data.funnelSteps?.length).toBe(1);
      expect(data.funnelSteps?.[0]?.type).toBe('checkout');
    });

    it('rejects an unknown redirectPageId on create', async () => {
      await expect(
        createCheckoutPage({
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('rejects an unknown funnel page reference on create', async () => {
      await expect(
        createCheckoutPage({
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

    it('creates a checkout page with subscription-specific settings', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Subscription Settings ${uniqueSuffix()}`,
          price: {
            amount: 3900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
            },
          },
        },
        limitSubscriptions: {
          enabled: true,
        },
        enableFileAccessForInactiveSubscriptions: true,
        allowDynamicPlanIterations: true,
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.limitSubscriptions?.enabled).toBe(true);
      expect(data.enableFileAccessForInactiveSubscriptions).toBe(true);
      expect(data.allowDynamicPlanIterations).toBe(true);
    });

    it('creates a checkout page with productData.description and returns it in the response', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Description Test ${uniqueSuffix()}`,
          description: '<p>My product description</p>',
          price: {
            amount: 4900,
            currency: 'usd',
          },
        },
      });

      expect(data.product?.description).toBeDefined();
      expect(data.product?.description).not.toBeNull();
    });

    it('creates a checkout page with productData.price.setupFee and returns it in the response', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Setup Fee Test ${uniqueSuffix()}`,
          price: {
            amount: 4900,
            currency: 'usd',
            setupFee: 999,
          },
        },
      });

      expect(data.product?.price.setupFee).toBe(999);
    });

    it('creates a checkout page with productData.price.setupFeeMultipliesWithQuantity and returns it in the response', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Setup Fee Qty Test ${uniqueSuffix()}`,
          price: {
            amount: 4900,
            currency: 'usd',
            setupFee: 500,
            setupFeeMultipliesWithQuantity: true,
          },
          description: '<p>My Description</p>',
        },
      });

      expect(data.product?.price.setupFee).toBe(500);
      expect(data.product?.price.setupFeeMultipliesWithQuantity).toBe(true);
      expect(data.product?.description).toEqual('<p>My Description</p>');
    });

    it('creates a checkout page with stripe-based subscription limiting', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Stripe Limit ${uniqueSuffix()}`,
          price: {
            amount: 3900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
            },
          },
        },
        limitSubscriptionsStripe: {
          enabled: true,
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.limitSubscriptionsStripe?.enabled).toBe(true);
    });

    it('creates a checkout page with a custom redirectUrl resolving field keys to field IDs', async () => {
      const { data } = await createCheckoutPage({
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

      expect(data.product?.type).toBe('charge');
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

    it('fails to create a checkout page when redirectUrlPath has an identifier that is not within fields', async () => {
      await expect(
        createCheckoutPage({
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
              identifier: 'missing',
              key: 'fields',
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails to create a checkout page when redirectUrlQuery has an identifier that is not within fields', async () => {
      await expect(
        createCheckoutPage({
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
          redirectUrlQuery: [{ key: 'fields', fieldKey: 'missing', parameter: 'URLPathParam' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails when recurring and payment plan price modes are combined', async () => {
      await expect(
        client.checkoutPages.create({
          name: `Invalid Checkout ${uniqueSuffix()}`,
          productData: {
            title: `Invalid Product ${uniqueSuffix()}`,
            price: {
              amount: 4900,
              currency: 'usd',
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              paymentPlan: {
                interval: 'month',
                intervalCount: 1,
                planIterations: 3,
              },
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails when imageIds reference a missing file', async () => {
      await expect(
        client.checkoutPages.create({
          name: `Missing image ${uniqueSuffix()}`,
          imageIds: [fakeObjectId('missingimage')],
          productData: {
            title: `Missing image product ${uniqueSuffix()}`,
            price: {
              amount: 4900,
              currency: 'usd',
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails when product fileIds reference a missing file', async () => {
      await expect(
        client.checkoutPages.create({
          name: `Missing product file ${uniqueSuffix()}`,
          productData: {
            title: `Missing product file ${uniqueSuffix()}`,
            price: {
              amount: 4900,
              currency: 'usd',
            },
            fileIds: [fakeObjectId('missingfile')],
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails when product imageIds reference a missing file', async () => {
      await expect(
        client.checkoutPages.create({
          name: `Missing product image ${uniqueSuffix()}`,
          productData: {
            title: `Missing product image ${uniqueSuffix()}`,
            price: {
              amount: 4900,
              currency: 'usd',
            },
            imageIds: [fakeObjectId('missingimage')],
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    describe('variants', () => {
      it('creates a checkout page with a simple variant group and options', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Variant Product ${uniqueSuffix()}`,
            price: { amount: 1000, currency: 'usd' },
            variants: [
              {
                name: 'Plan',
                required: true,
                options: [
                  {
                    name: 'Basic',
                    additionalChargeAmount: 100,
                    payWhatYouWant: true,
                    pwywSuggestedPrice: 500,
                  },
                  { name: 'Pro', additionalChargeAmount: 5000 },
                ],
              },
            ],
          },
        });

        expect(data.product?.variants).toHaveLength(1);
        const variant = data.product?.variants?.[0];
        expect(variant?.name).toBe('Plan');
        expect(variant?.required).toBe(true);
        expect(variant?.status).toBe('enabled');
        expect(variant?.id).toMatch(/^[0-9a-f]{24}$/);
        expect(variant?.selectionType).toBe('single');
        expect(variant?.hidden).toBe(false);
        expect(variant?.increasesWithQuantity).toBe(false);
        expect(variant?.manageVariantOptionStock).toBe(false);
        expect(variant?.useVariantOptionSkus).toBe(false);
        expect(variant?.reference).toBeTypeOf('string');
        expect(variant?.options).toHaveLength(2);

        const basic = variant?.options?.find((o) => o.name === 'Basic');
        expect(basic?.id).toMatch(/^[0-9a-f]{24}$/);
        expect(basic?.status).toBe('enabled');
        expect(basic?.additionalChargeAmount).toBe(100);
        expect(basic?.payWhatYouWant).toBe(true);
        expect(basic?.pwywSuggestedPrice).toBe(500);
        expect(basic?.type).toBe('pay_what_you_want');

        const pro = variant?.options?.find((o) => o.name === 'Pro');
        expect(pro?.additionalChargeAmount).toBe(5000);
        expect(pro?.type).toBe('one_time');
      });

      it('persists variantsRequired on the product', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Required Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variantsRequired: true,
            variants: [
              {
                name: 'Size',
                options: [{ name: 'Small' }, { name: 'Large' }],
              },
            ],
          },
        });

        expect(data.product?.variantsRequired).toBe(true);
      });

      it('creates a checkout page with multiple variant groups preserving order', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Multi-Variant ${uniqueSuffix()}`,
            price: { amount: 3000, currency: 'usd' },
            variants: [
              {
                name: 'Color',
                order: 0,
                options: [{ name: 'Blue' }, { name: 'Red' }],
              },
              {
                name: 'Size',
                order: 1,
                options: [{ name: 'Small' }, { name: 'Medium' }, { name: 'Large' }],
              },
            ],
          },
        });

        expect(data.product?.variants).toHaveLength(2);
        const colorVariant = data.product?.variants?.find((v) => v.name === 'Color');
        const sizeVariant = data.product?.variants?.find((v) => v.name === 'Size');
        expect(colorVariant?.options).toHaveLength(2);
        expect(colorVariant?.order).toBe(0);
        expect(colorVariant?.reference).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(sizeVariant?.options).toHaveLength(3);
        expect(sizeVariant?.order).toBe(1);
      });

      it('creates variants with multiple selection type and increasesWithQuantity', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Multiple Selection ${uniqueSuffix()}`,
            price: { amount: 500, currency: 'usd' },
            variants: [
              {
                name: 'Add-ons',
                selectionType: 'multiple',
                increasesWithQuantity: true,
                options: [
                  { name: 'Extra support', additionalChargeAmount: 2000 },
                  { name: 'Priority access', additionalChargeAmount: 3000 },
                ],
              },
            ],
          },
        });

        const variant = data.product?.variants?.[0];
        expect(variant?.selectionType).toBe('multiple');
        expect(variant?.increasesWithQuantity).toBe(true);
        expect(variant?.options).toHaveLength(2);
      });

      it('creates variants with quantity selection type', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Quantity Selection ${uniqueSuffix()}`,
            price: { amount: 1000, currency: 'usd' },
            variants: [
              {
                name: 'Tickets',
                selectionType: 'quantity',
                options: [
                  { name: 'Adult', additionalChargeAmount: 0 },
                  { name: 'Child', additionalChargeAmount: 0 },
                ],
              },
            ],
          },
        });

        expect(data.product?.variants?.[0]?.selectionType).toBe('quantity');
      });

      it('creates a variant option with a description, sku, and type', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Option Details ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Package',
                useVariantOptionSkus: true,
                options: [
                  {
                    name: 'Starter',
                    type: 'one_time',
                    description: '<p>The starter package</p>',
                    sku: 'PKG-STARTER',
                    additionalChargeAmount: 0,
                  },
                ],
              },
            ],
          },
        });

        const variant = data.product?.variants?.[0];
        expect(variant?.useVariantOptionSkus).toBe(true);

        const option = variant?.options?.[0];
        expect(option?.name).toBe('Starter');
        expect(option?.type).toBe('one_time');
        expect(option?.description).toContain('starter package');
        expect(option?.sku).toBe('PKG-STARTER');
        expect(option?.status).toBe('enabled');
      });

      it('creates a variant option with stock management', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Stock Variant ${uniqueSuffix()}`,
            price: { amount: 5000, currency: 'usd' },
            variants: [
              {
                name: 'Edition',
                manageVariantOptionStock: true,
                options: [
                  { name: 'Limited Edition', additionalChargeAmount: 0, stock: 50 },
                  { name: 'Standard', additionalChargeAmount: 0, stock: 500 },
                ],
              },
            ],
          },
        });

        const variant = data.product?.variants?.[0];
        expect(variant?.manageVariantOptionStock).toBe(true);

        const options = variant?.options;
        expect(options?.find((o) => o.name === 'Limited Edition')?.stock).toBe(50);
        expect(options?.find((o) => o.name === 'Standard')?.stock).toBe(500);
      });

      it('creates a variant option with an image', async () => {
        const imageId = await uploadImage();
        const { data } = await createCheckoutPage({
          productData: {
            title: `Image Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Style',
                options: [{ name: 'Classic', imageId, additionalChargeAmount: 0 }],
              },
            ],
          },
        });

        const image = data.product?.variants?.[0]?.options?.[0]?.image;
        expect(image?.fileId).toBe(imageId);
        expect(image?.url).toBeTypeOf('string');
        expect(image?.name).toBeTypeOf('string');
        expect(image?.width).toBeTypeOf('number');
        expect(image?.height).toBeTypeOf('number');
        expect(image?.size).toBeTypeOf('number');
      });

      it('creates a variant option with attached files', async () => {
        const fileId = await uploadFile();
        const { data } = await createCheckoutPage({
          productData: {
            title: `File Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Edition',
                options: [{ name: 'Digital', additionalChargeAmount: 0, fileIds: [fileId] }],
              },
            ],
          },
        });

        const option = data.product?.variants?.[0]?.options?.[0];
        expect(option?.fileIds).toContain(fileId);
      });

      it('creates a hidden variant', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Hidden Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Source',
                hidden: true,
                options: [{ name: 'Option A', additionalChargeAmount: 0 }],
              },
            ],
          },
        });

        expect(data.product?.variants?.[0]?.hidden).toBe(true);
      });

      it('creates a checkout page with multiple pricing type variants', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Multiple Pricing ${uniqueSuffix()}`,
            price: { amount: 0, currency: 'usd', pricingType: 'multiple' },
            variantsRequired: true,
            variants: [
              {
                name: 'Tier',
                required: true,
                options: [
                  { name: 'Basic', additionalChargeAmount: 2900, type: 'one_time' },
                  { name: 'Pro', additionalChargeAmount: 7900, type: 'one_time' },
                  { name: 'Enterprise', additionalChargeAmount: 19900, type: 'one_time' },
                ],
              },
            ],
          },
        });

        expect(data.product?.price.amount).toBe(0);
        expect(data.product?.variantsRequired).toBe(true);
        expect(data.product?.variants).toHaveLength(1);
        const variant = data.product?.variants?.[0];
        expect(variant?.required).toBe(true);
        expect(variant?.options).toHaveLength(3);

        const pro = variant?.options?.find((o) => o.name === 'Pro');
        expect(pro?.additionalChargeAmount).toBe(7900);
        expect(pro?.type).toBe('one_time');
      });

      it.each([['is'], ['is_not'], ['is_empty'], ['is_not_empty'], ['contains']] as const)(
        'persists %s variant showHideLogic comparison correctly on create and get',
        async (comparison) => {
          const sourceVariantName = comparison === 'contains' ? 'Add-ons' : 'Select tier';
          const sourceOptionName = comparison === 'contains' ? 'Training session' : 'Pro';
          const dependentVariantName =
            comparison === 'contains' ? 'Implementation package' : 'Onboarding call';

          const { data } = await createCheckoutPage({
            productData: {
              title: `Conditional Variant ${comparison} ${uniqueSuffix()}`,
              price: { amount: 5000, currency: 'usd' },
              variants: [
                {
                  key: 'source',
                  name: sourceVariantName,
                  required: true,
                  selectionType: comparison === 'contains' ? 'multiple' : 'single',
                  options: [
                    {
                      key: 'standard',
                      name: comparison === 'contains' ? 'Priority support' : 'Standard',
                    },
                    { key: 'pro', name: sourceOptionName },
                  ],
                },
                {
                  name: dependentVariantName,
                  showHideLogic: {
                    enabled: true,
                    comparison,
                    value: 'pro',
                    element: { elementId: 'source' },
                  },
                  options: [
                    { name: 'No call', additionalChargeAmount: 0 },
                    { name: 'Include call', additionalChargeAmount: 15000 },
                  ],
                },
                {
                  name: 'Donation',
                  options: [
                    {
                      name: 'Donation',
                      description: '<b>Please donate!</b>',
                      payWhatYouWant: true,
                      additionalChargeAmount: 100,
                    },
                  ],
                },
              ],
            },
          });

          expect(data.product?.variants).toHaveLength(3);
          const sourceVariant = data.product?.variants?.find((v) => v.name === sourceVariantName);
          const dependentVariant = data.product?.variants?.find(
            (v) => v.name === dependentVariantName
          );
          const donationVariant = data.product?.variants?.find((v) => v.name === 'Donation');
          expect(sourceVariant?.options).toHaveLength(2);
          expect(dependentVariant?.options).toHaveLength(2);
          expect(donationVariant?.options).toHaveLength(1);

          const sourceOptionId = sourceVariant?.options?.find(
            (o) => o.name === sourceOptionName
          )?.id;
          expect(sourceOptionId).toMatch(/^[0-9a-f]{24}$/);
          expect(dependentVariant?.showHideLogic?.enabled).toBe(true);
          expect(dependentVariant?.showHideLogic?.comparison).toBe(comparison);
          expect(dependentVariant?.showHideLogic?.element?.elementId).toBe(sourceVariant?.id);
          expect(dependentVariant?.showHideLogic?.value).toBe(sourceOptionId);

          const fetched = await client.checkoutPages.get(data.id);
          const fetchedSourceVariant = fetched.data.product?.variants?.find(
            (v) => v.name === sourceVariantName
          );
          const fetchedDependentVariant = fetched.data.product?.variants?.find(
            (v) => v.name === dependentVariantName
          );
          const fetchedSourceOptionId = fetchedSourceVariant?.options?.find(
            (o) => o.name === sourceOptionName
          )?.id;

          expect(fetchedSourceOptionId).toMatch(/^[0-9a-f]{24}$/);
          expect(fetchedDependentVariant?.showHideLogic?.comparison).toBe(comparison);
          expect(fetchedDependentVariant?.showHideLogic?.element?.elementId).toBe(
            fetchedSourceVariant?.id
          );
          expect(fetchedDependentVariant?.showHideLogic?.value).toBe(fetchedSourceOptionId);
        }
      );

      it('creates a variant with a preselected option and resolves the key to an ObjectId in the response', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Preselect Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Plan',
                options: [
                  { key: 'basic', name: 'Basic', additionalChargeAmount: 0 },
                  { key: 'pro', name: 'Pro', additionalChargeAmount: 5000 },
                ],
                preselect: { enabled: true, optionId: 'pro' },
              },
            ],
          },
        });

        const variant = data.product?.variants?.[0];
        expect(variant?.options).toHaveLength(2);

        // preselect.optionId is resolved from the key to the persisted option ObjectId
        const proOptionId = variant?.options?.find((o) => o.name === 'Pro')?.id;
        expect(proOptionId).toMatch(/^[0-9a-f]{24}$/);
        expect(variant?.preselect?.enabled).toBe(true);
        expect(variant?.preselect?.optionId).toBe(proOptionId);
      });

      it('creates a variant with grid layout configuration', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Grid Variant ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            variants: [
              {
                name: 'Color',
                layout: {
                  variantOptionLayout: 'grid',
                  variantOptionColumns: 3,
                  collapseVariantOptions: false,
                  showVariantName: true,
                  showVariantOptionNames: true,
                  showVariantOptionPrices: false,
                  showVariantOptionPriceSign: false,
                  spacing: 'compact',
                  imageSize: 'medium',
                },
                options: [{ name: 'Red' }, { name: 'Blue' }, { name: 'Green' }],
              },
            ],
          },
        });

        const layout = data.product?.variants?.[0]?.layout;
        expect(layout?.variantOptionLayout).toBe('grid');
        expect(layout?.variantOptionColumns).toBe(3);
        expect(layout?.collapseVariantOptions).toBe(false);
        expect(layout?.showVariantName).toBe(true);
        expect(layout?.showVariantOptionNames).toBe(true);
        expect(layout?.showVariantOptionPrices).toBe(false);
        expect(layout?.showVariantOptionPriceSign).toBe(false);
        expect(layout?.spacing).toBe('compact');
        expect(layout?.imageSize).toBe('medium');
      });

      it('fails when a variant showHideLogic references a non-existent variant key', async () => {
        await expect(
          createCheckoutPage({
            productData: {
              title: `Invalid Logic ${uniqueSuffix()}`,
              price: { amount: 5000, currency: 'usd' },
              variants: [
                {
                  name: 'Addon',
                  showHideLogic: {
                    enabled: true,
                    comparison: 'is',
                    value: 'pro',
                    element: { elementId: 'nonexistent-key' },
                  },
                  options: [{ name: 'Option A' }],
                },
              ],
            },
          })
        ).rejects.toThrow(ValidationError);
      });

      it.each(['is_empty', 'is_not_empty'] as const)(
        'allows %s variant showHideLogic without sending a value',
        async (comparison) => {
          const sourceVariantName = `Plan ${uniqueSuffix()}`;
          const dependentVariantName = `Conditional Notes ${uniqueSuffix()}`;

          const { data } = await createCheckoutPage({
            productData: {
              title: `Variant Logic Empty Comparison ${uniqueSuffix()}`,
              price: { amount: 5000, currency: 'usd' },
              variants: [
                {
                  key: 'plan',
                  name: sourceVariantName,
                  options: [
                    { key: 'basic', name: 'Basic' },
                    { key: 'pro', name: 'Pro' },
                  ],
                },
                {
                  name: dependentVariantName,
                  showHideLogic: {
                    enabled: true,
                    comparison,
                    element: { elementId: 'plan' },
                  },
                  options: [{ name: 'Option A' }],
                },
              ],
            },
          });

          const sourceVariant = data.product?.variants?.find((v) => v.name === sourceVariantName);
          const dependentVariant = data.product?.variants?.find(
            (v) => v.name === dependentVariantName
          );

          expect(sourceVariant?.id).toMatch(/^[0-9a-f]{24}$/);
          expect(dependentVariant?.showHideLogic?.enabled).toBe(true);
          expect(dependentVariant?.showHideLogic?.comparison).toBe(comparison);
          expect(dependentVariant?.showHideLogic?.element?.elementId).toBe(sourceVariant?.id);
          expect(dependentVariant?.showHideLogic?.value).toBeFalsy();

          const fetched = await client.checkoutPages.get(data.id);
          const fetchedSourceVariant = fetched.data.product?.variants?.find(
            (v) => v.name === sourceVariantName
          );
          const fetchedDependentVariant = fetched.data.product?.variants?.find(
            (v) => v.name === dependentVariantName
          );

          expect(fetchedDependentVariant?.showHideLogic?.comparison).toBe(comparison);
          expect(fetchedDependentVariant?.showHideLogic?.element?.elementId).toBe(
            fetchedSourceVariant?.id
          );
          expect(fetchedDependentVariant?.showHideLogic?.value).toBeFalsy();
        }
      );

      it('fails when a variant preselect references a non-existent option key', async () => {
        await expect(
          createCheckoutPage({
            productData: {
              title: `Invalid Preselect ${uniqueSuffix()}`,
              price: { amount: 2000, currency: 'usd' },
              variants: [
                {
                  name: 'Plan',
                  options: [{ key: 'basic', name: 'Basic' }],
                  preselect: { enabled: true, optionId: 'nonexistent-option-key' },
                },
              ],
            },
          })
        ).rejects.toThrow(ValidationError);
      });
    });

    it('returns product.type as charge for a one-time payment page', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `One Time Type ${uniqueSuffix()}`,
          price: {
            amount: 4900,
            currency: 'usd',
          },
        },
      });

      expect(data.product?.type).toBe('charge');
    });

    it('returns discountedFromPrice in the product response for one-time pages', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Discounted ${uniqueSuffix()}`,
          price: {
            amount: 6500,
            currency: 'usd',
            discountedFromPrice: 8000,
          },
        },
      });

      expect(data.product?.price.discountedFromPrice).toBe(8000);
    });

    it('creates a checkout page with cash on delivery manual payment option', async () => {
      const { data } = await createCheckoutPage({
        paymentOptions: [
          {
            type: 'manual',
            enabled: true,
            name: 'Cash on delivery',
            description: 'Pay when delivered',
            instructions: 'Pay the driver on arrival.',
            showPaymentButton: true,
            manualType: 'cash_on_delivery',
          },
          {
            type: 'full',
            enabled: true,
            name: 'Pay now',
            description: 'Pay now description',
            instructions: 'Pay via card etc',
            showPaymentButton: true,
          },
          {
            type: 'partial',
            name: 'Partial',
            description: 'Partial payment',
            enabled: true,
            instructions: 'Partially pay things',
            manualType: 'invoice',
            partialAmount: 300,
            showPaymentButton: true,
          },
        ],
      });

      expect(
        data.paymentOptions?.some(
          (option) => option.type === 'manual' && option.manualType === 'cash_on_delivery'
        )
      ).toBe(true);
    });

    it('creates a payment plan checkout page with trialPeriodDays', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Plan Trial ${uniqueSuffix()}`,
          price: {
            amount: 9900,
            currency: 'usd',
            paymentPlan: {
              interval: 'month',
              intervalCount: 1,
              planIterations: 3,
              trialPeriodDays: 7,
            },
            discountedFromPrice: 10000,
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.price.paymentPlan?.planIterations).toBe(3);
      expect(data.product?.price.paymentPlan?.trialPeriodDays).toBe(7);
      expect(data.product?.price.discountedFromPrice).toBe(10000);
    });

    it('creates a subscription checkout page with a future startDate', async () => {
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await createCheckoutPage({
        productData: {
          title: `Start Date Sub ${uniqueSuffix()}`,
          price: {
            amount: 2900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
              startDate,
            },
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.price.recurring?.interval).toBe('month');
      expect(data.product?.price.recurring?.startDate).toBeTypeOf('string');
    });

    it('creates a subscription checkout page with billingCycleAnchorConfig', async () => {
      const startDate = new Date().toISOString();
      const { data } = await createCheckoutPage({
        productData: {
          title: `Anchor Config ${uniqueSuffix()}`,
          price: {
            amount: 2900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
              startDate,
              billingCycleAnchorConfig: {
                enabled: true,
                dayOfMonth: 1,
              },
            },
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.price.recurring?.interval).toBe('month');
      expect(data.product?.price.recurring?.startDate).toEqual(startDate);
      expect(data.product?.price.recurring?.billingCycleAnchorConfig?.enabled).toBe(true);
      expect(data.product?.price.recurring?.billingCycleAnchorConfig?.dayOfMonth).toBe(1);
    });

    it('creates a checkout page with custom email confirmation', async () => {
      const { data } = await createCheckoutPage({
        sendEmailConfirmation: true,
        confirmationEmailShowLogo: true,
        confirmationEmailShowStoreName: true,
        customizeEmailConfirmation: true,
        customizeCheckoutConfirmation: true,
        confirmationEmailMessage: '<p>My email message</p>',
        confirmationEmailSubject: 'My test',
        confirmationCheckoutMessage: '<p>My confirmation page message</p>',
        confirmationCheckoutTitle: 'My confirmation page title',
        productData: {
          title: `Anchor Config ${uniqueSuffix()}`,
          price: {
            amount: 2900,
            currency: 'usd',
          },
        },
      });

      expect(data.product?.type).toBe('charge');
    });

    it('creates a checkout page with top-level checkout confirmation settings', async () => {
      const confirmationCheckoutTitle = `Top-level confirmation ${uniqueSuffix()}`;
      const confirmationCheckoutMessage = `<p>Top-level confirmation body ${uniqueSuffix()}</p>`;

      const { data } = await createCheckoutPage({
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle,
        confirmationCheckoutMessage,
      });

      expect(data.customizeCheckoutConfirmation).toBe(true);
      expect(data.confirmationCheckoutTitle).toBe(confirmationCheckoutTitle);
      expect(data.confirmationCheckoutMessage).toBe(confirmationCheckoutMessage);
      expect(data.funnelSteps).toEqual([]);
    });

    it('creates a checkout page with confirmation funnel step settings without setting top-level confirmation', async () => {
      const confirmationCheckoutTitle = `Funnel confirmation ${uniqueSuffix()}`;
      const confirmationCheckoutMessage = `<p>Funnel confirmation body ${uniqueSuffix()}</p>`;

      const { data } = await createCheckoutPage({
        funnelSteps: [
          {
            type: 'confirmation',
            order: 0,
            enabled: true,
            config: {
              action: 'confirmation',
              customizeCheckoutConfirmation: true,
              confirmationCheckoutTitle,
              confirmationCheckoutMessage,
            },
          },
        ],
      });

      expect(data.customizeCheckoutConfirmation ?? false).toBe(false);
      expect(data.confirmationCheckoutTitle ?? null).toBeNull();
      expect(data.confirmationCheckoutMessage ?? null).toBeNull();
      expect(data.funnelSteps).toHaveLength(1);
      expect(data.funnelSteps?.[0]).toMatchObject({
        type: 'confirmation',
        order: 0,
        enabled: true,
        config: {
          action: 'confirmation',
          customizeCheckoutConfirmation: true,
          confirmationCheckoutTitle,
          confirmationCheckoutMessage,
        },
      });
    });

    describe('discounts', () => {
      it('creates a checkout page with a percent-off bulk discount based on checkout quantity', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Percent Discount ${uniqueSuffix()}`,
            price: { amount: 1000, currency: 'usd' },
            discounts: [
              {
                quantityCondition: 'checkout_quantity',
                minQuantity: 5,
                maxQuantity: 10,
                percentOff: 10,
              },
            ],
          },
        });

        expect(data.product?.price.amount).toBe(1000);
        expect(data.product?.price.currency).toBe('usd');
        expect(data.product?.discounts).toHaveLength(1);
        const discount = data.product?.discounts?.[0];
        expect(discount?.quantityCondition).toBe('checkout_quantity');
        expect(discount?.minQuantity).toBe(5);
        expect(discount?.maxQuantity).toBe(10);
        expect(discount?.percentOff).toBe(10);
        expect(discount?.amountOff).toBeFalsy();
      });

      it('creates a checkout page with an amount-off bulk discount based on checkout quantity', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Amount Discount ${uniqueSuffix()}`,
            price: { amount: 2000, currency: 'usd' },
            discounts: [
              {
                quantityCondition: 'checkout_quantity',
                minQuantity: 3,
                amountOff: 500,
              },
            ],
          },
        });

        expect(data.product?.price.amount).toBe(2000);
        expect(data.product?.price.currency).toBe('usd');
        expect(data.product?.discounts).toHaveLength(1);
        const discount = data.product?.discounts?.[0];
        expect(discount?.quantityCondition).toBe('checkout_quantity');
        expect(discount?.minQuantity).toBe(3);
        expect(discount?.maxQuantity).toBeFalsy();
        expect(discount?.amountOff).toBe(500);
        expect(discount?.percentOff).toBeFalsy();
      });

      it('creates a checkout page with multiple discount tiers', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Tiered Discounts ${uniqueSuffix()}`,
            price: { amount: 1000, currency: 'usd' },
            discounts: [
              {
                quantityCondition: 'checkout_quantity',
                minQuantity: 5,
                maxQuantity: 9,
                percentOff: 10,
              },
              {
                quantityCondition: 'checkout_quantity',
                minQuantity: 10,
                percentOff: 20,
              },
            ],
          },
        });

        expect(data.product?.price.amount).toBe(1000);
        expect(data.product?.price.currency).toBe('usd');
        expect(data.product?.discounts).toHaveLength(2);
        const tier1 = data.product?.discounts?.find((d) => d.minQuantity === 5);
        const tier2 = data.product?.discounts?.find((d) => d.minQuantity === 10);
        expect(tier1?.maxQuantity).toBe(9);
        expect(tier1?.percentOff).toBe(10);
        expect(tier2?.percentOff).toBe(20);
        expect(tier2?.maxQuantity).toBeFalsy();
      });

      it('creates a checkout page with a discount applying to specific variant option quantities', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Variant Discount ${uniqueSuffix()}`,
            price: { amount: 1000, currency: 'usd' },
            variants: [
              {
                name: 'Size',
                selectionType: 'quantity',
                options: [{ name: 'Small', key: 'small' }, { name: 'Large' }],
              },
            ],
            discounts: [
              {
                quantityCondition: 'variant_option_quantity',
                variantOptionIds: [
                  {
                    key: 'small',
                  },
                ],
                minQuantity: 3,
                percentOff: 15,
              },
            ],
          },
        });

        expect(data.product?.price.amount).toBe(1000);
        expect(data.product?.price.currency).toBe('usd');
        expect(data.product?.discounts).toHaveLength(1);
        const discount = data.product?.discounts?.[0];
        expect(discount?.quantityCondition).toBe('variant_option_quantity');
        expect(discount?.minQuantity).toBe(3);
        expect(discount?.percentOff).toBe(15);
        expect(discount?.variantOptionIds).toHaveLength(1);
        expect(discount?.variantOptionIds?.[0]).toMatch(/^[0-9a-f]{24}$/);
        expect(discount?.variantOptionIds?.[0]).toEqual(
          data?.product?.variants?.[0].options?.[0].id
        );
      });

      it('throws a validation error when a discount variantOptionIds key does not match any variant option', async () => {
        await expect(
          createCheckoutPage({
            productData: {
              title: `Variant Discount ${uniqueSuffix()}`,
              price: { amount: 1000, currency: 'usd' },
              variants: [
                {
                  name: 'Size',
                  selectionType: 'quantity',
                  options: [{ name: 'Small', key: 'small' }, { name: 'Large' }],
                },
              ],
              discounts: [
                {
                  quantityCondition: 'variant_option_quantity',
                  variantOptionIds: [{ key: 'nonexistent-key' }],
                  minQuantity: 3,
                  percentOff: 15,
                },
              ],
            },
          })
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('get', () => {
    it('gets an existing checkout page by id', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.get(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.type).toBe('checkout');
    });

    it('returns the uploaded imageIds in the response', async () => {
      const imageId = await uploadImage();
      const created = await createCheckoutPage({ imageIds: [imageId] });
      const result = await client.checkoutPages.get(created.data.id);

      expect(pageIncludesImage(result.data, imageId)).toBe(true);
    });

    it('returns configured productData fields', async () => {
      const productImageId = await uploadImage();
      const productFileId = await uploadFile();
      const created = await createCheckoutPage({
        productData: {
          title: `Configured Product ${uniqueSuffix()}`,
          description: 'Configured product description',
          price: {
            amount: 7500,
            currency: 'usd',
          },
          sku: `sku-${uniqueSuffix()}`,
          stock: 12,
          imageIds: [productImageId],
          fileIds: [productFileId],
        },
      });
      const result = await client.checkoutPages.get(created.data.id);

      expect(result.data.product?.title).toContain('Configured Product');
      expect(result.data.product?.sku).toContain('sku-');
      expect(result.data.product?.stock).toBe(12);
      expect(result.data.product?.price.amount).toBe(7500);
      expect(result.data.product?.price.currency).toBe('usd');
      expect(result.data.product?.description).toEqual('<p>Configured product description</p>');
      expect(productIncludesImage(result.data, productImageId)).toBe(true);
      expect(productIncludesFile(result.data, productFileId)).toBe(true);
    }, 15000);

    it('returns checkout page response metadata fields', async () => {
      const created = await createCheckoutPage({
        sendPaymentNotification: false,
        showCouponCodeField: true,
        tax: { enabled: true },
      });
      const result = await client.checkoutPages.get(created.data.id);

      expect(result.data.sellerId).toBe(config.testSellerId);
      expect(result.data.url).toContain('checkoutpage');
      expect(typeof result.data.visitCount).toBe('number');
      expect(result.data.sendPaymentNotification).toBe(false);
      expect(result.data.showCouponCodeField).toBe(true);
      expect(result.data.tax?.enabled).toBe(true);
      expect(Array.isArray(result.data.fields)).toBe(true);
    });

    it('returns top-level and funnel confirmation settings independently', async () => {
      const topLevelTitle = `Top-level title ${uniqueSuffix()}`;
      const topLevelMessage = `<p>Top-level message ${uniqueSuffix()}</p>`;
      const funnelTitle = `Funnel title ${uniqueSuffix()}`;
      const funnelMessage = `<p>Funnel message ${uniqueSuffix()}</p>`;

      const created = await createCheckoutPage({
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: topLevelTitle,
        confirmationCheckoutMessage: topLevelMessage,
        funnelSteps: [
          {
            type: 'confirmation',
            order: 0,
            enabled: true,
            config: {
              action: 'confirmation',
              customizeCheckoutConfirmation: true,
              confirmationCheckoutTitle: funnelTitle,
              confirmationCheckoutMessage: funnelMessage,
            },
          },
        ],
      });
      const result = await client.checkoutPages.get(created.data.id);

      expect(result.data.customizeCheckoutConfirmation).toBe(true);
      expect(result.data.confirmationCheckoutTitle).toBe(topLevelTitle);
      expect(result.data.confirmationCheckoutMessage).toBe(topLevelMessage);
      expect(result.data.funnelSteps).toHaveLength(1);
      expect(result.data.funnelSteps?.[0]).toMatchObject({
        type: 'confirmation',
        config: {
          action: 'confirmation',
          customizeCheckoutConfirmation: true,
          confirmationCheckoutTitle: funnelTitle,
          confirmationCheckoutMessage: funnelMessage,
        },
      });
    });

    it('fails for an unknown checkout page id', async () => {
      await expect(client.checkoutPages.get(fakeObjectId('missingpage'))).rejects.toThrow(
        NotFoundError
      );
    });

    it('fails for a malformed checkout page id', async () => {
      await expect(client.checkoutPages.get('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('updates checkout page metadata', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        name: `Updated ${uniqueSuffix()}`,
        slug: `/updated-${uniqueSuffix()}`,
      });

      expect(result.data.name).toContain('Updated');
      expect(normalizeSlug(result.data.slug)).toContain('updated-');
    });

    it('rejects an uppercase slug on update', async () => {
      const created = await createCheckoutPage();

      await expect(
        client.checkoutPages.update(created.data.id, {
          slug: `/Updated-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('updates checkout page status', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        status: 'draft',
      });

      expect(result.data.status).toBe('draft');
    });

    it('updates checkout page images with newly uploaded files', async () => {
      const created = await createCheckoutPage();
      const imageId = await uploadImage();
      const result = await client.checkoutPages.update(created.data.id, {
        imageIds: [imageId],
      });

      expect(pageIncludesImage(result.data, imageId)).toBe(true);
    });

    it('updates redirect settings', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/redirected',
        redirectUrlInsideEmbed: true,
      });

      expect(result.data.afterPaymentAction).toBe('redirect');
      expect(result.data.redirectUrl).toBe('https://example.com/redirected');
      expect(result.data.redirectUrlInsideEmbed).toBe(true);
    });

    it('resolves redirect path and query identifiers on update across field and built-in keys', async () => {
      const created = await createCheckoutPage({
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

      const updated = await client.checkoutPages.update(created.data.id, {
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/checkout-pages/updated',
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
      expect(updated.data.redirectUrl).toBe('https://example.com/checkout-pages/updated');
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

    it('updates checkout redirect settings', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        afterPaymentAction: 'checkout',
        redirectPageId: config.testCheckoutPageId,
      });

      expect(result.data.afterPaymentAction).toBe('checkout');
      expect(result.data.redirectPageId).toBe(config.testCheckoutPageId);
    });

    it('rejects an unknown redirectPageId on update', async () => {
      const created = await createCheckoutPage();

      await expect(
        client.checkoutPages.update(created.data.id, {
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it.each([
      ['sendEmailConfirmation', { sendEmailConfirmation: true }, true],
      ['customizeEmailConfirmation', { customizeEmailConfirmation: true }, true],
      ['googleIndex', { googleIndex: false }, false],
      ['showCouponCodeField', { showCouponCodeField: true }, true],
      ['allowDynamicTitle', { allowDynamicTitle: true }, true],
      ['allowDynamicDescription', { allowDynamicDescription: true }, true],
      ['allowDynamicPrice', { allowDynamicPrice: true }, true],
      ['allowDynamicDiscountedFromPrice', { allowDynamicDiscountedFromPrice: true }, true],
      ['allowDynamicRedirectUrl', { allowDynamicRedirectUrl: true }, true],
      ['allowDynamicPlanIterations', { allowDynamicPlanIterations: true }, true],
      ['savePaymentMethod', { savePaymentMethod: true }, true],
      ['closePopupOnClickOutside', { closePopupOnClickOutside: true }, true],
      ['sendPaymentNotification', { sendPaymentNotification: false }, false],
      [
        'enableFileAccessForInactiveSubscriptions',
        { enableFileAccessForInactiveSubscriptions: true },
        true,
      ],
      [
        'sendCanceledSubscriptionNotifications',
        { sendCanceledSubscriptionNotifications: false },
        false,
      ],
      [
        'sendRecurringPaymentFailedNotifications',
        { sendRecurringPaymentFailedNotifications: false },
        false,
      ],
      [
        'sendRecurringPaymentSucceededNotifications',
        { sendRecurringPaymentSucceededNotifications: false },
        false,
      ],
    ] as const)('updates %s', async (field, payload, expected) => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, payload);

      expectPageFlag(result.data as Record<string, unknown>, field, expected);
    });

    it('updates confirmation email settings', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Updated confirmation',
        confirmationEmailMessage: '<p>Updated email content.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
      });

      expect(result.data.sendEmailConfirmation).toBe(true);
      expect(result.data.customizeEmailConfirmation).toBe(true);
      expect(result.data.confirmationEmailSubject).toBe('Updated confirmation');
      expect(result.data.confirmationEmailShowLogo).toBe(false);
      expect(result.data.confirmationEmailShowStoreName).toBe(false);
    });

    it('updates payment configuration fields', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        paymentMethods: {
          stripe: {
            card: { enabled: true },
            agpay: { enabled: true, mode: 'express' },
            multiple: { enabled: true },
          },
        },
        paymentOptions: [
          {
            type: 'manual',
            enabled: true,
            name: 'Invoice',
            description: 'Pay later',
            instructions: 'We will invoice you.',
            showPaymentButton: false,
            manualType: 'invoice',
          },
        ],
        fees: [
          {
            name: 'Handling',
            amount: 200,
            applyToSpecificPaymentMethods: false,
          },
        ],
      });

      expect(result.data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(result.data.paymentOptions?.[0]?.type).toBe('manual');
      expect(result.data.fees?.[0]?.name).toBe('Handling');
    });

    it('updates funnel steps', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        funnelSteps: [
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'redirect',
              redirectUrl: 'https://example.com/post-purchase',
            },
          },
        ],
      });

      expect(result.data.funnelSteps?.length).toBe(1);
      expect(result.data.funnelSteps?.[0]?.type).toBe('confirmation');
    });

    it('rejects an unknown funnel page reference on update', async () => {
      const created = await createCheckoutPage();

      await expect(
        client.checkoutPages.update(created.data.id, {
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

    it('updates invoice settings checkout abandonment and tax', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        invoiceSettings: {
          bankDetails: 'Updated bank details',
          dueDays: {
            enabled: true,
            days: 14,
          },
        },
        checkoutAbandonment: {
          disableEmails: false,
          showStoreLogo: true,
          showStoreName: false,
        },
        tax: {
          enabled: true,
        },
      });

      expect(result.data.invoiceSettings?.bankDetails).toBe('Updated bank details');
      expect(result.data.invoiceSettings?.dueDays?.days).toBe(14);
      expect(result.data.checkoutAbandonment?.showStoreName).toBe(false);
      expect(result.data.tax?.enabled).toBe(true);
    });

    it('updates checkout abandonment email reminders', async () => {
      const created = await createCheckoutPage({
        checkoutAbandonment: {
          disableEmails: false,
        },
      });
      const result = await client.checkoutPages.update(created.data.id, {
        checkoutAbandonment: {
          emailReminders: {
            reminder1: {
              customizeEmail: true,
              subject: 'Updated reminder subject',
              body: '<p>Updated reminder body.</p>',
              buttonText: 'Updated button',
            },
            reminder2: null,
            reminder3: null,
          },
        },
      });

      expect(result.data.checkoutAbandonment?.emailReminders?.reminder1?.customizeEmail).toBe(true);
      expect(result.data.checkoutAbandonment?.emailReminders?.reminder1?.subject).toBe(
        'Updated reminder subject'
      );
      expect(result.data.checkoutAbandonment?.emailReminders?.reminder1?.buttonText).toBe(
        'Updated button'
      );
      expect(result.data.checkoutAbandonment?.emailReminders?.reminder2).toBeUndefined();
      expect(result.data.checkoutAbandonment?.emailReminders?.reminder3).toBeUndefined();
    });

    it('clears nullable settings when null is provided', async () => {
      const created = await createCheckoutPage({
        redirectUrl: 'https://example.com/initial',
        notifyEmail: 'owner@example.com',
      });
      const result = await client.checkoutPages.update(created.data.id, {
        redirectUrl: null,
        notifyEmail: null,
      });

      expect(result.data.redirectUrl).toBeNull();
      expect(result.data.notifyEmail).toBeNull();
    });

    it.each([
      ['redirectUrl', 'https://example.com/clear-me'],
      ['notifyEmail', 'owner@example.com'],
      ['confirmationCheckoutTitle', 'Clear this title'],
      ['confirmationCheckoutMessage', '<p>Clear this message</p>'],
      ['trackingCodes', '<script>window.clearMe=true;</script>'],
      ['slug', `/clear-${uniqueSuffix()}`],
    ] as const)('clears %s when null is provided', async (field, initialValue) => {
      const created = await createCheckoutPage({
        [field]: initialValue,
      });
      const result = await client.checkoutPages.update(created.data.id, {
        [field]: null,
      });

      if (field === 'slug') {
        expect(normalizeSlug(result.data.slug)).toBe(normalizeSlug(created.data.slug));
        return;
      }

      expectPageFlag(result.data as Record<string, unknown>, field, null);
    });

    it('clears customized confirmation email settings together', async () => {
      const created = await createCheckoutPage({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Initial custom subject',
        confirmationEmailMessage: '<p>Initial custom body</p>',
      });
      const result = await client.checkoutPages.update(created.data.id, {
        customizeEmailConfirmation: false,
        confirmationEmailSubject: null,
        confirmationEmailMessage: null,
      });

      expect(result.data.customizeEmailConfirmation).toBe(false);
      expect(result.data.confirmationEmailSubject).toBeNull();
      expect(result.data.confirmationEmailMessage).toBeNull();
    });

    it('updates top-level checkout confirmation settings without changing confirmation funnel steps', async () => {
      const initialFunnelTitle = `Initial funnel title ${uniqueSuffix()}`;
      const initialFunnelMessage = `<p>Initial funnel message ${uniqueSuffix()}</p>`;
      const created = await createCheckoutPage({
        funnelSteps: [
          {
            type: 'confirmation',
            order: 0,
            enabled: true,
            config: {
              action: 'confirmation',
              customizeCheckoutConfirmation: true,
              confirmationCheckoutTitle: initialFunnelTitle,
              confirmationCheckoutMessage: initialFunnelMessage,
            },
          },
        ],
      });

      const updatedTitle = `Updated top-level title ${uniqueSuffix()}`;
      const updatedMessage = `<p>Updated top-level message ${uniqueSuffix()}</p>`;
      const result = await client.checkoutPages.update(created.data.id, {
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: updatedTitle,
        confirmationCheckoutMessage: updatedMessage,
      });

      expect(result.data.customizeCheckoutConfirmation).toBe(true);
      expect(result.data.confirmationCheckoutTitle).toBe(updatedTitle);
      expect(result.data.confirmationCheckoutMessage).toBe(updatedMessage);
      expect(result.data.funnelSteps).toHaveLength(1);
      expect(result.data.funnelSteps?.[0]).toMatchObject({
        type: 'confirmation',
        config: {
          action: 'confirmation',
          customizeCheckoutConfirmation: true,
          confirmationCheckoutTitle: initialFunnelTitle,
          confirmationCheckoutMessage: initialFunnelMessage,
        },
      });
    });

    it('fails for an unknown checkout page id', async () => {
      await expect(
        client.checkoutPages.update(fakeObjectId('missingpage'), { name: 'Missing page' })
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed checkout page id', async () => {
      await expect(
        client.checkoutPages.update('not-a-valid-id', { name: 'Missing page' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('archives an existing checkout page', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('fails for an unknown checkout page id', async () => {
      await expect(client.checkoutPages.delete(fakeObjectId('missingpage'))).rejects.toThrow(
        NotFoundError
      );
    });

    it('fails for a malformed checkout page id', async () => {
      await expect(client.checkoutPages.delete('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('rich text fields return HTML', () => {
    it('returns confirmationCheckoutMessage as HTML, not slate JSON', async () => {
      const { data } = await createCheckoutPage({
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: 'Order confirmed',
        confirmationCheckoutMessage: '<p>Thanks for your purchase.</p>',
      });
      expect(data.customizeCheckoutConfirmation).toBe(true);
      expect(data.confirmationCheckoutMessage).toBeTypeOf('string');
      expect(data.confirmationCheckoutMessage).toContain('<p>');
      expect(data.confirmationCheckoutMessage).not.toContain('"children"');
    });

    it('returns confirmationEmailMessage as HTML, not slate JSON', async () => {
      const { data } = await createCheckoutPage({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Thank you!',
        confirmationEmailMessage: '<p>Your order is confirmed.</p>',
      });

      expect(data.confirmationEmailMessage).toBeTypeOf('string');
      expect(data.confirmationEmailMessage).toContain('<p>');
      expect(data.confirmationEmailMessage).not.toContain('"children"');
    });

    it('returns product description as HTML, not lexical JSON', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `HTML Desc Product ${uniqueSuffix()}`,
          description: '<p>This is the <strong>product</strong> description.</p>',
          price: { amount: 1000, currency: 'usd' },
        },
      });

      expect(data.product?.description).toBeTypeOf('string');
      expect(data.product?.description).toContain('<p>');
      expect(data.product?.description).not.toContain('"root"');
    });
  });
});
