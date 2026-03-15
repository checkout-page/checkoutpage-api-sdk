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

  const uploadImage = async () => {
    const result = await client.files.upload({
      file: createImageFile(`checkout-page-${uniqueSuffix()}.png`),
      purpose: 'image',
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
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        await client.checkoutPages.delete(pageId);
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
      const firstPage = await client.checkoutPages.list({ limit: 1 });

      if (firstPage.data.length === 1 && firstPage.has_more) {
        const secondPage = await client.checkoutPages.list({
          limit: 1,
          starting_after: firstPage.data[0].id,
        });

        expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0].id);
      }
    });

    it('supports ending_before pagination', async () => {
      const seedPage = await client.checkoutPages.list({ limit: 3 });

      if (seedPage.data.length > 1) {
        const result = await client.checkoutPages.list({
          limit: 1,
          ending_before: seedPage.data[1].id,
        });

        expect(result.data[0]?.id).not.toBe(seedPage.data[1].id);
      }
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
            amount: 0,
            currency: 'usd',
            payWhatYouWant: true,
          },
        },
      });

      expect(data.product?.payWhatYouWant).toBe(true);
      expect(data.product?.interval).toBeFalsy();
      expect(data.product?.planIterations).toBeFalsy();
    });

    it('creates a recurring subscription checkout page', async () => {
      const { data } = await createCheckoutPage({
        productData: {
          title: `Recurring ${uniqueSuffix()}`,
          price: {
            amount: 2900,
            currency: 'usd',
            recurring: {
              interval: 'month',
              intervalCount: 1,
              trialPeriodDays: 7,
            },
          },
        },
      });

      expect(data.product?.type).toBe('subscription');
      expect(data.product?.interval).toBe('month');
      expect(data.product?.intervalCount).toBe(1);
      expect(data.product?.trialPeriodDays).toBe(7);
      expect(data.product?.planIterations).toBeFalsy();
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
          {
            type: 'confirmation',
            order: 1,
            enabled: true,
            config: {
              action: 'confirmation',
              customizeCheckoutConfirmation: true,
              confirmationCheckoutTitle: 'Order confirmed',
              confirmationCheckoutMessage: '<p>Thanks for your purchase.</p>',
            },
          },
        ],
      });

      expect(data.funnelSteps?.length).toBe(2);
      expect(data.funnelSteps?.[0]?.type).toBe('checkout');
      expect(data.funnelSteps?.[1]?.type).toBe('confirmation');
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
        },
      });
      const result = await client.checkoutPages.get(created.data.id);

      expect(result.data.product?.title).toContain('Configured Product');
      expect(result.data.product?.sku).toContain('sku-');
      expect(result.data.product?.stock).toBe(12);
      expect(result.data.product?.price).toBe(7500);
      expect(result.data.product?.currency).toBe('usd');
    });

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
      ['savePaymentMethod', { savePaymentMethod: true }, true],
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
  });

  describe('delete', () => {
    it('archives an existing checkout page', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('marks the checkout page as archived in the response', async () => {
      const created = await createCheckoutPage();
      const result = await client.checkoutPages.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.status).toBe('archived');
    });

    it('returns the archived checkout page when deleting the same checkout page twice', async () => {
      const created = await createCheckoutPage();
      await client.checkoutPages.delete(created.data.id);
      forgetPage(created.data.id);

      const result = await client.checkoutPages.delete(created.data.id);

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
