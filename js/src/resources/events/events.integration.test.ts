import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateEventParams, Event } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { createImageFile, fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const forgetPage = (pageId: string) => {
    createdPageIds = createdPageIds.filter((id) => id !== pageId);
  };

  const uploadImage = async (namePrefix = 'event') => {
    const result = await client.files.upload({
      file: createImageFile(`${namePrefix}-${uniqueSuffix()}.png`),
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

  const expectIsoDate = (value: string | null | undefined) => {
    expect(typeof value).toBe('string');
    expect(Number.isNaN(new Date(value as string).getTime())).toBe(false);
  };

  const expectBaseEventResponse = (event: Event, expectedName?: string) => {
    expect(event.id).toBeTypeOf('string');
    expect(event.sellerId).toBe(config.testSellerId);
    expect(event.type).toBe('event');
    expect(event.status).toMatch(/published|draft|archived/);
    expect(event.name).toBeTypeOf('string');
    if (expectedName) {
      expect(event.name).toBe(expectedName);
    }
    expectIsoDate(event.createdAt);
    expectIsoDate(event.updatedAt);
    expect(typeof event.visitCount).toBe('number');
    expect(event.url).toContain('checkoutpage');
  };

  const getTicketGroupByName = (event: Event, groupName: string) => {
    const group = event.ticketGroups?.find((ticketGroup) => ticketGroup.name === groupName);
    expect(group).toBeDefined();
    return group!;
  };

  const getTicketTypeByName = (
    group: NonNullable<Event['ticketGroups']>[number],
    ticketTypeName: string
  ) => {
    const ticketType = group.ticketTypes?.find((item) => item.name === ticketTypeName);
    expect(ticketType).toBeDefined();
    return ticketType!;
  };

  const createEvent = async (overrides: Partial<CreateEventParams> = {}) => {
    const suffix = uniqueSuffix();
    const params: CreateEventParams = {
      name: `SDK Event ${suffix}`,
      title: `SDK Event Title ${suffix}`,
      eventDetails: {
        type: 'in_person',
        currency: 'usd',
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
        timezone: 'UTC',
        location: 'SDK Event Venue',
      },
      ...overrides,
    };

    const response = await client.events.create(params);
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
        await client.events.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }

    createdPageIds = [];
  });

  describe('list', () => {
    it('lists events', async () => {
      const result = await client.events.list();

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
    });

    it('respects the limit query parameter', async () => {
      const result = await client.events.list({ limit: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('supports starting_after pagination', async () => {
      const firstPage = await client.events.list({ limit: 1 });

      if (firstPage.data.length === 1 && firstPage.has_more) {
        const secondPage = await client.events.list({
          limit: 1,
          starting_after: firstPage.data[0].id,
        });

        expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0].id);
      }
    });

    it('supports ending_before pagination', async () => {
      const seedPage = await client.events.list({ limit: 3 });

      if (seedPage.data.length > 1) {
        const result = await client.events.list({
          limit: 1,
          ending_before: seedPage.data[1].id,
        });

        expect(result.data[0]?.id).not.toBe(seedPage.data[1].id);
      }
    });

    it('filters events by status', async () => {
      const created = await createEvent({ status: 'draft' });
      const result = await client.events.list({
        status: 'draft',
        search: created.data.name ?? 'unknown',
      });

      expect(result.data.some((event) => event.id === created.data.id)).toBe(true);
      expect(result.data.every((event) => event.status === 'draft')).toBe(true);
    });

    it('filters events by search', async () => {
      const token = `sdk-event-search-${uniqueSuffix()}`;
      const created = await createEvent({ name: token, title: token });
      const result = await client.events.list({ search: token });

      expect(result.data.some((event) => event.id === created.data.id)).toBe(true);
    });

    it('returns an empty list for an unmatched search', async () => {
      const result = await client.events.list({
        search: `sdk-event-unmatched-${uniqueSuffix()}`,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });
  });

  describe('create', () => {
    it('creates a minimal event', async () => {
      const { data } = await createEvent();

      expectBaseEventResponse(data);
      expect(data.type).toBe('event');
      expect(data.status).toBe('published');
      expect(data.title).toContain('SDK Event Title');
      expect(data.eventDetails?.type).toBe('in_person');
      expect(data.eventDetails?.currency?.toLowerCase()).toBe('usd');
      expect(data.eventDetails?.status).toBe('active');
      expect(data.ticketGroups?.length).toBeGreaterThan(0);
      expect(data.ticketGroups?.[0]?.ticketTypes?.length).toBeGreaterThan(0);
    });

    it('creates a draft event', async () => {
      const { data } = await createEvent({ status: 'draft' });

      expect(data.status).toBe('draft');
    });

    it('creates an event with exhaustive page event and ticket configuration', async () => {
      const pageImageId = await uploadImage('event-page');
      const ticketImageId = await uploadImage('event-ticket');
      const slug = `/sdk-event-${uniqueSuffix()}`;
      const eventName = `Full Event ${uniqueSuffix()}`;
      const title = `Full Event Title ${uniqueSuffix()}`;
      const redirectUrl = 'https://example.com/events/thanks';

      const { data } = await createEvent({
        name: eventName,
        title,
        slug,
        locale: 'en-US',
        fields: [
          {
            label: 'Email address',
            element: 'email',
            type: 'email',
            required: true,
          },
          {
            label: `Company ${uniqueSuffix()}`,
            element: 'text',
            required: true,
          },
        ],
        allowDynamicTitle: true,
        allowDynamicDescription: true,
        closePopupOnClickOutside: true,
        redirect: {
          enabled: true,
          url: 'https://example.com/pre-event',
        },
        afterPaymentAction: 'redirect',
        confirmationCheckoutTitle: 'Event booking confirmed',
        confirmationCheckoutMessage: '<p>See you at the event.</p>',
        redirectUrl,
        redirectUrlPath: [
          {
            key: 'order',
            identifier: 'orderId',
          },
        ],
        redirectUrlQuery: [
          {
            parameter: 'email',
            key: 'fields',
            identifier: 'customer_email',
          },
        ],
        redirectUrlInsideEmbed: true,
        sendPaymentNotification: false,
        notifyEmail: 'events@example.com',
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Your event booking',
        confirmationEmailMessage: '<p>Your event booking is confirmed.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
        googleIndex: false,
        trackingCodes: '<script>window.sdkEventTest=true;</script>',
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
        funnelSteps: [
          {
            type: 'checkout',
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
              confirmationCheckoutTitle: 'Event confirmed',
              confirmationCheckoutMessage: '<p>Bring your ticket.</p>',
            },
          },
        ],
        savePaymentMethod: true,
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
            name: 'Pay now',
            description: 'Pay the full amount now',
            showPaymentButton: true,
          },
          {
            type: 'partial',
            enabled: true,
            name: 'Pay deposit',
            description: 'Reserve your place with a deposit',
            instructions: 'Pay the rest later.',
            partialAmount: 1500,
            showPaymentButton: true,
          },
          {
            type: 'manual',
            enabled: true,
            name: 'Invoice me',
            description: 'Pay via invoice',
            instructions: 'We will send an invoice.',
            manualType: 'invoice',
            showPaymentButton: false,
          },
        ],
        fees: [
          {
            name: 'Booking fee',
            amount: 125,
            multiplyByQuantity: true,
            applyToSpecificPaymentMethods: true,
            paymentMethods: ['card'],
          },
        ],
        showCouponCodeField: true,
        showCouponCodeFieldType: 'field',
        allowDynamicPrice: true,
        allowDynamicDiscountedFromPrice: true,
        allowDynamicRedirectUrl: true,
        description: '<p>Full event description.</p>',
        tax: {
          enabled: true,
        },
        eventDetails: {
          type: 'hybrid',
          currency: 'usd',
          startDate: '2026-10-05T14:00:00Z',
          endDate: '2026-10-05T18:00:00Z',
          timezone: 'America/New_York',
          location: '123 Conference Way, New York, NY',
          meetingLink: 'https://zoom.us/j/123456789',
          capacity: 250,
          mapsLink: 'https://maps.google.com/?q=Conference+Center',
          platform: 'zoom',
          taxBehavior: 'exclusive',
          taxCode: 'txcd_10000000',
          pdfTicketsEnabled: true,
        },
        ticketGroups: [
          {
            name: 'VIP',
            description: 'VIP access',
            status: 'enabled',
            reference: `vip-${uniqueSuffix()}`,
            layout: {
              type: 'grid',
              columns: 2,
              collapse: false,
              alignment: 'center',
              spacing: 'compact',
              imageSize: 'medium',
              showTicketGroupName: true,
              showTicketTypeName: true,
              showTicketPrice: true,
              showTicketTotalPrice: true,
              showTicketSaleDateTimezone: true,
            },
            ticketSelectionType: 'quantity',
            capacity: 100,
            hidden: false,
            hideWhenSoldOut: true,
            hideWhenNotOnSale: true,
            hideWhenScheduled: false,
            hideWhenUnavailable: false,
            bulkDiscounts: [
              {
                minQuantity: 2,
                maxQuantity: 4,
                percentOff: 10,
              },
            ],
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-09-01T09:00:00Z',
            saleEndOn: '2026-10-01T23:59:59Z',
            ticketTypes: [
              {
                name: 'VIP Early Bird',
                description: 'Discounted VIP ticket',
                status: 'enabled',
                reference: `vip-early-${uniqueSuffix()}`,
                hidden: false,
                hideWhenSoldOut: true,
                hideWhenNotOnSale: false,
                hideWhenScheduled: true,
                hideWhenUnavailable: false,
                pricing: 'paid',
                price: 5000,
                discountedFromPrice: 6500,
                capacity: 25,
                minQuantity: 1,
                maxQuantity: 4,
                showAvailableQuantity: true,
                showTicketSaleDates: true,
                imageId: ticketImageId,
                availabilityBehavior: 'date_time_based',
                saleStartOn: '2026-09-01T09:00:00Z',
                saleEndOn: '2026-09-20T23:59:59Z',
              },
              {
                name: 'VIP Companion',
                status: 'disabled',
                pricing: 'free',
                price: 0,
              },
            ],
          },
          {
            name: 'General Admission',
            ticketSelectionType: 'multiple',
            availabilityBehavior: 'always_available',
            ticketTypes: [
              {
                name: 'General Admission',
                pricing: 'paid',
                price: 2500,
              },
            ],
          },
        ],
        showConfirmationEventName: true,
        showConfirmationEventDateTime: false,
        showConfirmationEventLocation: true,
        showConfirmationEventMeetingLink: false,
        showConfirmationEventTickets: true,
        imageIds: [pageImageId],
      });

      expectBaseEventResponse(data, eventName);
      expect(data.slug).toBe(slug);
      expect(data.locale).toBe('en-US');
      expect(data.title).toBe(title);
      expect(data.description).toBeDefined();
      expect(data.descriptionHtml).toContain('Full event description');
      expect(pageIncludesImage(data, pageImageId)).toBe(true);
      expect(data.fields?.some((field) => field.label?.includes('Company'))).toBe(true);
      expect(data.allowDynamicTitle).toBe(true);
      expect(data.allowDynamicDescription).toBe(true);
      expect(data.closePopupOnClickOutside).toBe(true);
      expect(data.redirect?.enabled).toBe(true);
      expect(data.redirect?.url).toBe('https://example.com/pre-event');
      expect(data.afterPaymentAction).toBe('redirect');
      expect(data.confirmationCheckoutTitle).toBe('Event booking confirmed');
      expect(data.confirmationCheckoutMessage).toBeDefined();
      expect(data.redirectUrl).toBe(redirectUrl);
      expect(data.redirectUrlPath?.[0]?.key).toBe('order');
      expect(data.redirectUrlQuery?.[0]?.parameter).toBe('email');
      expect(data.redirectUrlInsideEmbed).toBe(true);
      expect(data.sendPaymentNotification).toBe(false);
      expect(data.notifyEmail).toBe('events@example.com');
      expect(data.sendEmailConfirmation).toBe(true);
      expect(data.customizeEmailConfirmation).toBe(true);
      expect(data.confirmationEmailSubject).toBe('Your event booking');
      expect(data.confirmationEmailMessage).toBeDefined();
      expect(data.confirmationEmailShowLogo).toBe(false);
      expect(data.confirmationEmailShowStoreName).toBe(false);
      expect(data.googleIndex).toBe(false);
      expect(data.trackingCodes).toContain('sdkEventTest');
      expect(data.invoiceSettings?.bankDetails).toBe('Account 123456');
      expect(data.invoiceSettings?.additionalInformation?.title).toBe('Payment terms');
      expect(data.invoiceSettings?.dueDays?.days).toBe(30);
      expect(data.checkoutAbandonment?.disableEmails).toBe(true);
      expect(data.checkoutAbandonment?.showStoreLogo).toBe(false);
      expect(data.checkoutAbandonment?.showStoreName).toBe(true);
      expect(data.funnelSteps?.length).toBe(2);
      expect(data.funnelSteps?.[0]?.type).toBe('checkout');
      expect(data.funnelSteps?.[1]?.type).toBe('confirmation');
      expect(data.savePaymentMethod).toBe(true);
      expect(data.paymentMethods?.stripe?.card?.enabled).toBe(true);
      expect(data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(data.paymentMethods?.stripe?.multiple?.enabled).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'full')).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'partial')).toBe(true);
      expect(data.paymentOptions?.some((option) => option.type === 'manual')).toBe(true);
      expect(data.fees?.[0]?.name).toBe('Booking fee');
      expect(data.fees?.[0]?.amount).toBe(125);
      expect(data.showCouponCodeField).toBe(true);
      expect(data.showCouponCodeFieldType).toBe('field');
      expect(data.allowDynamicPrice).toBe(true);
      expect(data.allowDynamicDiscountedFromPrice).toBe(true);
      expect(data.allowDynamicRedirectUrl).toBe(true);
      expect(data.tax?.enabled).toBe(true);
      expect(data.eventDetails?.status).toBe('active');
      expect(data.eventDetails?.type).toBe('hybrid');
      expect(data.eventDetails?.currency?.toLowerCase()).toBe('usd');
      expect(data.eventDetails?.startDate).toBe('2026-10-05T14:00:00.000Z');
      expect(data.eventDetails?.endDate).toBe('2026-10-05T18:00:00.000Z');
      expect(data.eventDetails?.timezone).toBe('America/New_York');
      expect(data.eventDetails?.location).toContain('Conference Way');
      expect(data.eventDetails?.meetingLink).toContain('zoom.us');
      expect(data.eventDetails?.capacity).toBe(250);
      expect(data.eventDetails?.mapsLink).toContain('maps.google.com');
      expect(data.eventDetails?.platform).toBe('zoom');
      expect(data.eventDetails?.taxBehavior).toBe('exclusive');
      expect(data.eventDetails?.taxCode).toBe('txcd_10000000');
      expect(data.eventDetails?.pdfTicketsEnabled).toBe(true);
      expect(data.showConfirmationEventName).toBe(true);
      expect(data.showConfirmationEventDateTime).toBe(false);
      expect(data.showConfirmationEventLocation).toBe(true);
      expect(data.showConfirmationEventMeetingLink).toBe(false);
      expect(data.showConfirmationEventTickets).toBe(true);

      const vipGroup = getTicketGroupByName(data, 'VIP');
      expect(vipGroup.description).toBe('VIP access');
      expect(vipGroup.status).toBe('enabled');
      expect(vipGroup.reference).toContain('vip-');
      expect(vipGroup.layout?.type).toBe('grid');
      expect(vipGroup.layout?.columns).toBe(2);
      expect(vipGroup.layout?.alignment).toBe('center');
      expect(vipGroup.layout?.spacing).toBe('compact');
      expect(vipGroup.layout?.imageSize).toBe('medium');
      expect(vipGroup.layout?.showTicketGroupName).toBe(true);
      expect(vipGroup.layout?.showTicketTypeName).toBe(true);
      expect(vipGroup.layout?.showTicketPrice).toBe(true);
      expect(vipGroup.layout?.showTicketTotalPrice).toBe(true);
      expect(vipGroup.layout?.showTicketSaleDateTimezone).toBe(true);
      expect(vipGroup.ticketSelectionType).toBe('quantity');
      expect(vipGroup.capacity).toBe(100);
      expect(vipGroup.hidden).toBe(false);
      expect(vipGroup.hideWhenSoldOut).toBe(true);
      expect(vipGroup.hideWhenNotOnSale).toBe(true);
      expect(vipGroup.hideWhenScheduled).toBe(false);
      expect(vipGroup.hideWhenUnavailable).toBe(false);
      expect(vipGroup.bulkDiscounts?.[0]?.minQuantity).toBe(2);
      expect(vipGroup.bulkDiscounts?.[0]?.maxQuantity).toBe(4);
      expect(vipGroup.bulkDiscounts?.[0]?.percentOff).toBe(10);
      expect(vipGroup.availabilityBehavior).toBe('date_time_based');
      expect(vipGroup.saleStartOn).toBe('2026-09-01T09:00:00.000Z');
      expect(vipGroup.saleEndOn).toBe('2026-10-01T23:59:59.000Z');
      expect(vipGroup.ticketTypes?.length).toBe(2);

      const vipEarlyBird = getTicketTypeByName(vipGroup, 'VIP Early Bird');
      expect(vipEarlyBird.description).toBe('Discounted VIP ticket');
      expect(vipEarlyBird.status).toBe('enabled');
      expect(vipEarlyBird.reference).toContain('vip-early-');
      expect(vipEarlyBird.hidden).toBe(false);
      expect(vipEarlyBird.hideWhenSoldOut).toBe(true);
      expect(vipEarlyBird.hideWhenNotOnSale).toBe(false);
      expect(vipEarlyBird.hideWhenScheduled).toBe(true);
      expect(vipEarlyBird.hideWhenUnavailable).toBe(false);
      expect(vipEarlyBird.pricing).toBe('paid');
      expect(vipEarlyBird.price).toBe(5000);
      expect(vipEarlyBird.discountedFromPrice).toBe(6500);
      expect(vipEarlyBird.capacity).toBe(25);
      expect(vipEarlyBird.minQuantity).toBe(1);
      expect(vipEarlyBird.maxQuantity).toBe(4);
      expect(vipEarlyBird.showAvailableQuantity).toBe(true);
      expect(vipEarlyBird.showTicketSaleDates).toBe(true);
      expect(vipEarlyBird.image?.fileId).toBe(ticketImageId);
      expect(vipEarlyBird.availabilityBehavior).toBe('date_time_based');
      expect(vipEarlyBird.saleStartOn).toBe('2026-09-01T09:00:00.000Z');
      expect(vipEarlyBird.saleEndOn).toBe('2026-09-20T23:59:59.000Z');
      expect(vipEarlyBird.quantitySold).toBe(0);

      const vipCompanion = getTicketTypeByName(vipGroup, 'VIP Companion');
      expect(vipCompanion.status).toBe('disabled');
      expect(vipCompanion.pricing).toBe('free');
      expect(vipCompanion.price).toBe(0);

      const generalGroup = getTicketGroupByName(data, 'General Admission');
      expect(generalGroup.ticketSelectionType).toBe('multiple');
      expect(generalGroup.availabilityBehavior).toBe('always_available');
      expect(generalGroup.ticketTypes?.[0]?.name).toBe('General Admission');
      expect(generalGroup.ticketTypes?.[0]?.pricing).toBe('paid');
      expect(generalGroup.ticketTypes?.[0]?.price).toBe(2500);
    }, 15000);

    it('creates an event with checkout redirect configuration', async () => {
      const { data } = await createEvent({
        afterPaymentAction: 'checkout',
        redirectPageId: config.testCheckoutPageId,
      });

      expect(data.afterPaymentAction).toBe('checkout');
      expect(data.redirectPageId).toBe(config.testCheckoutPageId);
    });

    it('fails when imageIds reference a missing file', async () => {
      await expect(
        client.events.create({
          name: `Missing image event ${uniqueSuffix()}`,
          title: `Missing image title ${uniqueSuffix()}`,
          imageIds: [fakeObjectId('missingimage')],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get', () => {
    it('gets an existing event by id', async () => {
      const created = await createEvent();
      const result = await client.events.get(created.data.id);

      expectBaseEventResponse(result.data, created.data.name ?? undefined);
      expect(result.data.id).toBe(created.data.id);
      expect(result.data.type).toBe('event');
    });

    it('returns configured eventDetails ticket groups and response metadata', async () => {
      const pageImageId = await uploadImage('event-get-page');
      const created = await createEvent({
        imageIds: [pageImageId],
        sendPaymentNotification: false,
        showConfirmationEventTickets: true,
        tax: { enabled: true },
        ticketGroups: [
          {
            name: 'General Admission',
            ticketTypes: [
              {
                name: 'Standard',
                pricing: 'paid',
                price: 3500,
              },
            ],
          },
        ],
      });
      const result = await client.events.get(created.data.id);

      expect(result.data.sellerId).toBe(config.testSellerId);
      expect(result.data.url).toContain('checkoutpage');
      expect(typeof result.data.visitCount).toBe('number');
      expect(pageIncludesImage(result.data, pageImageId)).toBe(true);
      expect(result.data.sendPaymentNotification).toBe(false);
      expect(result.data.tax?.enabled).toBe(true);
      expect(result.data.eventDetails?.type).toBe('in_person');
      expect(result.data.ticketGroups?.[0]?.name).toBe('General Admission');
      expect(result.data.ticketGroups?.[0]?.ticketTypes?.[0]?.name).toBe('Standard');
      expect(result.data.showConfirmationEventTickets).toBe(true);
    });

    it('fails for an unknown event id', async () => {
      await expect(client.events.get(fakeObjectId('missingevent'))).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      await expect(client.events.get('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('updates exhaustive event configuration', async () => {
      const created = await createEvent({
        ticketGroups: [
          {
            name: 'General Admission',
            ticketTypes: [
              {
                name: 'Standard',
                pricing: 'paid',
                price: 2500,
              },
            ],
          },
        ],
      });
      const imageId = await uploadImage('event-update-page');
      const updatedSlug = `/updated-event-${uniqueSuffix()}`;

      const result = await client.events.update(created.data.id, {
        name: `Updated Event ${uniqueSuffix()}`,
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
        redirectUrlPath: [
          {
            key: 'order',
            identifier: 'orderId',
          },
        ],
        redirectUrlQuery: [
          {
            parameter: 'email',
            key: 'fields',
            identifier: 'customer_email',
          },
        ],
        redirectUrlInsideEmbed: true,
        redirectPageId: config.testCheckoutPageId,
        sendPaymentNotification: true,
        notifyEmail: 'updated-events@example.com',
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Updated email subject',
        confirmationEmailMessage: '<p>Updated email body.</p>',
        confirmationEmailShowLogo: false,
        confirmationEmailShowStoreName: false,
        googleIndex: false,
        trackingCodes: '<script>window.sdkEventUpdated=true;</script>',
        invoiceSettings: {
          bankDetails: 'Updated account',
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
        savePaymentMethod: true,
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
            name: 'Handling fee',
            amount: 200,
            applyToSpecificPaymentMethods: false,
          },
        ],
        showCouponCodeField: true,
        showCouponCodeFieldType: 'field',
        allowDynamicPrice: true,
        allowDynamicDiscountedFromPrice: true,
        allowDynamicRedirectUrl: true,
        title: `Updated Event Title ${uniqueSuffix()}`,
        description: '<p>Updated event description.</p>',
        tax: {
          enabled: true,
        },
        eventDetails: {
          type: 'virtual',
          currency: 'eur',
          startDate: '2026-11-10T10:00:00Z',
          endDate: '2026-11-10T12:00:00Z',
          timezone: 'Europe/Paris',
          location: null,
          meetingLink: 'https://meet.google.com/updated-room',
          capacity: 400,
          mapsLink: null,
          platform: 'google_meet',
          taxBehavior: 'inclusive',
          taxCode: 'txcd_20030000',
          pdfTicketsEnabled: false,
        },
        showConfirmationEventName: false,
        showConfirmationEventDateTime: true,
        showConfirmationEventLocation: false,
        showConfirmationEventMeetingLink: true,
        showConfirmationEventTickets: false,
        imageIds: [imageId],
      });

      expectBaseEventResponse(result.data);
      expect(result.data.status).toBe('draft');
      expect(result.data.slug).toBe(updatedSlug);
      expect(result.data.locale).toBe('fr-FR');
      expect(result.data.allowDynamicTitle).toBe(true);
      expect(result.data.allowDynamicDescription).toBe(true);
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
      expect(result.data.redirectPageId).toBe(config.testCheckoutPageId);
      expect(result.data.sendPaymentNotification).toBe(true);
      expect(result.data.notifyEmail).toBe('updated-events@example.com');
      expect(result.data.sendEmailConfirmation).toBe(true);
      expect(result.data.customizeEmailConfirmation).toBe(true);
      expect(result.data.confirmationEmailSubject).toBe('Updated email subject');
      expect(result.data.confirmationEmailMessage).toBeDefined();
      expect(result.data.confirmationEmailShowLogo).toBe(false);
      expect(result.data.confirmationEmailShowStoreName).toBe(false);
      expect(result.data.googleIndex).toBe(false);
      expect(result.data.trackingCodes).toContain('sdkEventUpdated');
      expect(result.data.invoiceSettings?.bankDetails).toBe('Updated account');
      expect(result.data.invoiceSettings?.dueDays?.days).toBe(14);
      expect(result.data.checkoutAbandonment?.disableEmails).toBe(false);
      expect(result.data.checkoutAbandonment?.showStoreLogo).toBe(true);
      expect(result.data.checkoutAbandonment?.showStoreName).toBe(false);
      expect(result.data.funnelSteps?.length).toBe(1);
      // @ts-ignore
      expect(result.data.funnelSteps?.[0]?.config?.action).toBe('redirect');
      expect(result.data.savePaymentMethod).toBe(true);
      expect(result.data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(result.data.paymentOptions?.[0]?.type).toBe('manual');
      expect(result.data.fees?.[0]?.name).toBe('Handling fee');
      expect(result.data.showCouponCodeField).toBe(true);
      expect(result.data.showCouponCodeFieldType).toBe('field');
      expect(result.data.allowDynamicPrice).toBe(true);
      expect(result.data.allowDynamicDiscountedFromPrice).toBe(true);
      expect(result.data.allowDynamicRedirectUrl).toBe(true);
      expect(result.data.title).toContain('Updated Event Title');
      expect(result.data.description).toBeDefined();
      expect(result.data.descriptionHtml).toContain('Updated event description');
      expect(result.data.tax?.enabled).toBe(true);
      expect(result.data.eventDetails?.type).toBe('virtual');
      expect(result.data.eventDetails?.currency?.toLowerCase()).toBe('eur');
      expect(result.data.eventDetails?.startDate).toBe('2026-11-10T10:00:00.000Z');
      expect(result.data.eventDetails?.endDate).toBe('2026-11-10T12:00:00.000Z');
      expect(result.data.eventDetails?.timezone).toBe('Europe/Paris');
      expect(result.data.eventDetails?.location).toBeNull();
      expect(result.data.eventDetails?.meetingLink).toContain('meet.google.com');
      expect(result.data.eventDetails?.capacity).toBe(400);
      expect(result.data.eventDetails?.mapsLink).toBeNull();
      expect(result.data.eventDetails?.platform).toBe('google_meet');
      expect(result.data.eventDetails?.taxBehavior).toBe('inclusive');
      expect(result.data.eventDetails?.taxCode).toBe('txcd_20030000');
      expect(result.data.eventDetails?.pdfTicketsEnabled).toBe(false);
      expect(result.data.showConfirmationEventName).toBe(false);
      expect(result.data.showConfirmationEventDateTime).toBe(true);
      expect(result.data.showConfirmationEventLocation).toBe(false);
      expect(result.data.showConfirmationEventMeetingLink).toBe(true);
      expect(result.data.showConfirmationEventTickets).toBe(false);
      expect(pageIncludesImage(result.data, imageId)).toBe(true);
      expect(result.data.ticketGroups?.[0]?.name).toBe('General Admission');
      expect(result.data.ticketGroups?.[0]?.ticketTypes?.[0]?.name).toBe('Standard');
    });

    it('clears nullable settings when null is provided', async () => {
      const created = await createEvent({
        slug: `/clear-event-${uniqueSuffix()}`,
        redirectUrl: 'https://example.com/original',
        notifyEmail: 'owner@example.com',
        confirmationCheckoutTitle: 'Original confirmation title',
        confirmationCheckoutMessage: '<p>Original confirmation message.</p>',
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Original subject',
        confirmationEmailMessage: '<p>Original email body.</p>',
        trackingCodes: '<script>window.clearEvent=true;</script>',
      });

      const result = await client.events.update(created.data.id, {
        slug: null,
        redirectUrl: null,
        notifyEmail: null,
        confirmationCheckoutTitle: null,
        confirmationCheckoutMessage: null,
        confirmationEmailSubject: null,
        confirmationEmailMessage: null,
        trackingCodes: null,
      });

      expect(result.data.slug).toBeNull();
      expect(result.data.redirectUrl).toBeNull();
      expect(result.data.notifyEmail).toBeNull();
      expect(result.data.confirmationCheckoutTitle).toBeNull();
      expect(result.data.confirmationCheckoutMessage).toBeNull();
      expect(result.data.confirmationEmailSubject).toBeNull();
      expect(result.data.confirmationEmailMessage).toBeNull();
      expect(result.data.trackingCodes).toBeNull();
    });

    it('fails for an unknown event id', async () => {
      await expect(
        client.events.update(fakeObjectId('missingevent'), { name: 'Missing event' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('archives an existing event', async () => {
      const created = await createEvent();
      const result = await client.events.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
      expectBaseEventResponse(result.data);
    });

    it('marks the event as archived in the response', async () => {
      const created = await createEvent();
      const result = await client.events.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.status).toBe('archived');
      expect(result.data.type).toBe('event');
      expect(result.data.eventDetails).toBeDefined();
    });

    it('fails for an unknown event id', async () => {
      await expect(client.events.delete(fakeObjectId('missingevent'))).rejects.toThrow(
        NotFoundError
      );
    });

    it('fails for a malformed event id', async () => {
      await expect(client.events.delete('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });
});
