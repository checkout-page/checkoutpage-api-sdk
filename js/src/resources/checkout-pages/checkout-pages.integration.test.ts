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
    // for (const pageId of [...createdPageIds].reverse()) {
    //   try {
    //     await client.checkoutPages.delete(pageId);
    //   } catch {
    //     // Best-effort cleanup for integration tests.
    //   }
    // }
    // createdPageIds = [];
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

      expect(data.product?.price).toBe(6500);
      expect(data.product?.currency).toBe('usd');
      expect(data.product?.interval).toBeFalsy();
      expect(data.product?.planIterations).toBeFalsy();
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

      expect(data.product?.payWhatYouWant).toBe(true);
      expect(data.product?.interval).toBeFalsy();
      expect(data.product?.planIterations).toBeFalsy();
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
      expect(data.product?.interval).toBe('month');
      expect(data.product?.intervalCount).toBe(1);
      expect(data.product?.planIterations).toBe(3);
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
      expect(data.slug).toContain('/sdk-checkout-');
      expect(data.trackingCodes).toContain('sdkCheckoutTest');
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
        ],
      });

      expect(data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(data.paymentMethods?.stripe?.multiple?.enabled).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'manual')).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'partial')).toBe(true);
      expect(data.fees?.[0]?.name).toBe('Processing fee');
      expect(data.fees?.[0]?.amount).toBe(125);
    });

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
            identifier: 'url_path_key',
            key: 'fields',
          },
        ],
        redirectUrlQuery: [
          { key: 'fields', identifier: 'url_path_key', parameter: 'URLPathParam' },
        ],
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
          redirectUrlQuery: [{ key: 'fields', identifier: 'missing', parameter: 'URLPathParam' }],
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

        expect(data.product?.price).toBe(0);
        expect(data.product?.variantsRequired).toBe(true);
        expect(data.product?.variants).toHaveLength(1);
        const variant = data.product?.variants?.[0];
        expect(variant?.required).toBe(true);
        expect(variant?.options).toHaveLength(3);

        const pro = variant?.options?.find((o) => o.name === 'Pro');
        expect(pro?.additionalChargeAmount).toBe(7900);
        expect(pro?.type).toBe('one_time');
      });

      it('creates variants with conditional show/hide logic and resolves keys to ObjectIds in the response', async () => {
        const { data } = await createCheckoutPage({
          productData: {
            title: `Conditional Variant ${uniqueSuffix()}`,
            price: { amount: 5000, currency: 'usd' },
            variants: [
              {
                key: 'tier',
                name: 'Select tier',
                required: true,
                options: [
                  { key: 'standard', name: 'Standard' },
                  { key: 'pro', name: 'Pro' },
                ],
              },
              {
                name: 'Onboarding call',
                showHideLogic: {
                  enabled: true,
                  comparison: 'IS',
                  value: 'pro',
                  element: { elementId: 'tier' },
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
        const tierVariant = data.product?.variants?.find((v) => v.name === 'Select tier');
        const callVariant = data.product?.variants?.find((v) => v.name === 'Onboarding call');
        const donationVariant = data.product?.variants?.find((v) => v.name === 'Donation');
        expect(tierVariant?.options).toHaveLength(2);
        expect(callVariant?.options).toHaveLength(2);
        expect(donationVariant?.options).toHaveLength(1);

        // Keys are not persisted — the response resolves them to ObjectIds
        const proOptionId = tierVariant?.options?.find((o) => o.name === 'Pro')?.id;
        expect(proOptionId).toMatch(/^[0-9a-f]{24}$/);
        expect(callVariant?.showHideLogic?.enabled).toBe(true);
        expect(callVariant?.showHideLogic?.comparison).toBe('IS');
        expect(callVariant?.showHideLogic?.value).toBe(proOptionId);
        expect(callVariant?.showHideLogic?.element?.elementId).toBe(tierVariant?.id);
      });

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
                    comparison: 'IS',
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

      expect(data.product?.discountedFromPrice).toBe(8000);
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
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.planIterations).toBe(3);
      expect(data.product?.trialPeriodDays).toBe(7);
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
      expect(data.product?.interval).toBe('month');
    });

    it('creates a subscription checkout page with billingCycleAnchorConfig', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Anchor Config ${uniqueSuffix()}`,
          price: {
            amount: 2900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
              billingCycleAnchorConfig: {
                enabled: true,
                dayOfMonth: 1,
              },
            },
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.interval).toBe('month');
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
      expect(result.data.product?.price).toBe(7500);
      expect(result.data.product?.currency).toBe('usd');
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
      expect(result.data.slug).toContain('/updated-');
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

    it('updates checkout redirect settings', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.update(created.data.id, {
        afterPaymentAction: 'checkout',
        redirectPageId: config.testCheckoutPageId,
      });

      expect(result.data.afterPaymentAction).toBe('checkout');
      expect(result.data.redirectPageId).toBe(config.testCheckoutPageId);
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
});
