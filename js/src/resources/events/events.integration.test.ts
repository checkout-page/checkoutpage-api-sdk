import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateEventParams, Event, Schemas } from '../../types';
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

  const normalizeSlug = (slug: string | null | undefined) => slug?.replace(/^\/+/, '') ?? slug;

  const expectErrorEnvelope = (payload: unknown, expectedMessage: string) => {
    expect(payload).toEqual({
      status: 'error',
      type: 'error',
      message: expectedMessage,
    });
  };

  const requestRaw = async (path: string, init?: RequestInit) => {
    return fetch(new URL(path, config.baseUrl), {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  };

  const expectBaseEventResponse = (event: Event, expectedName?: string) => {
    expect(event.id).toBeTypeOf('string');
    expect(event.sellerId).toBe(config.testSellerId);
    expect(event.type).toBe('event');
    expect(event.status).toMatch(/^(published|draft|archived)$/);
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
    const { eventDetails: overrideEventDetails, ...restOverrides } = overrides;
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
        ...overrideEventDetails,
      },
      ...restOverrides,
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
      const token = `sdk-event-pagination-${uniqueSuffix()}`;
      await createEvent({ name: `${token}-a`, title: `${token}-a` });
      await createEvent({ name: `${token}-b`, title: `${token}-b` });
      const seed = await client.events.list({ limit: 2, search: token });

      expect(seed.data.length).toBeGreaterThanOrEqual(2);

      const nextPage = await client.events.list({
        limit: 1,
        search: token,
        starting_after: seed.data[0].id,
      });

      expect(nextPage.data).toHaveLength(1);
      expect(nextPage.data[0]?.id).not.toBe(seed.data[0].id);
      expect([seed.data[0].id, seed.data[1].id]).toContain(nextPage.data[0]?.id);
    });

    it('supports ending_before pagination', async () => {
      const token = `sdk-event-pagination-${uniqueSuffix()}`;
      await createEvent({ name: `${token}-a`, title: `${token}-a` });
      await createEvent({ name: `${token}-b`, title: `${token}-b` });
      const seed = await client.events.list({ limit: 2, search: token });

      expect(seed.data.length).toBeGreaterThanOrEqual(2);

      const prevPage = await client.events.list({
        limit: 1,
        search: token,
        ending_before: seed.data[1].id,
      });

      expect(prevPage.data).toHaveLength(1);
      expect(prevPage.data[0]?.id).not.toBe(seed.data[1].id);
      expect([seed.data[0].id, seed.data[1].id]).toContain(prevPage.data[0]?.id);
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
      const token = `sdk-event-list-combo-${uniqueSuffix()}`;

      const published = await createEvent({
        name: `${token}-published`,
        title: `${token}-published`,
        status: 'published',
      });
      const draft = await createEvent({
        name: `${token}-draft`,
        title: `${token}-draft`,
        status: 'draft',
      });

      const result = await client.events.list(params(token));
      const matchingEvents = result.data.filter(
        (event) => event.id === published.data.id || event.id === draft.data.id
      );

      expect(matchingEvents).not.toHaveLength(0);
      expect(matchingEvents.map((event) => event.status).sort()).toEqual(expectedStatuses.sort());
      expect(
        matchingEvents.every(
          (event) => event.name?.includes(token) || event.title?.includes(token) || false
        )
      ).toBe(true);
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
            key: 'customer_email',
          },
          {
            label: `Company ${uniqueSuffix()}`,
            element: 'text',
            required: true,
            key: 'orderId',
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
            fieldKey: 'customer_email',
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
            enabled: false,
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
      expect(normalizeSlug(data.slug)).toBe(normalizeSlug(slug));
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
      expect(data.paymentOptions?.find((option) => option.type === 'full')).toMatchObject({
        enabled: true,
      });
      expect(data.paymentOptions?.find((option) => option.type === 'partial')).toMatchObject({
        enabled: true,
        partialAmount: 1500,
      });
      expect(
        data.paymentOptions?.find(
          (option) => option.type === 'manual' && option.manualType === 'invoice'
        )
      ).toMatchObject({
        enabled: false,
        name: 'Invoice me',
      });
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

    it('rejects an uppercase slug on create', async () => {
      await expect(
        createEvent({
          slug: `/SDK-Event-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('rejects an unknown redirectPageId on create', async () => {
      await expect(
        createEvent({
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('rejects an unknown funnel page reference on create', async () => {
      await expect(
        createEvent({
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

    it('creates an event with a custom redirectUrl resolving field keys to field IDs', async () => {
      const { data } = await createEvent({
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

    it('fails when imageIds reference a missing file', async () => {
      await expect(
        client.events.create({
          name: `Missing image event ${uniqueSuffix()}`,
          title: `Missing image title ${uniqueSuffix()}`,
          eventDetails: {
            type: 'in_person',
            currency: 'usd',
            startDate: '2026-09-01T09:00:00Z',
            endDate: '2026-09-01T17:00:00Z',
            timezone: 'UTC',
            location: 'SDK Event Venue',
          },
          imageIds: [fakeObjectId('missingimage')],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('ignores unknown field', async () => {
      const created = await client.events.create({
        name: 'Invalid type field set',
        // @ts-expect-error unknown field
        type: 'removed',
        // @ts-expect-error unknown field
        more_unknown_fields: 'value',
      });

      expect(created.data.type).toBe('event');
      // @ts-expect-error unknown field
      expect(created.data.more_unknown_fields).toBeUndefined();
    });

    it('rejects unsupported enabled payment option combinations', async () => {
      await expect(
        createEvent({
          name: `SDK Invalid Event ${uniqueSuffix()}`,
          title: `SDK Invalid Event ${uniqueSuffix()}`,
          paymentOptions: [
            {
              type: 'full',
              enabled: true,
              name: 'Pay in full',
            },
            {
              type: 'manual',
              enabled: true,
              name: 'Pay by invoice',
              manualType: 'invoice',
            },
            {
              type: 'partial',
              enabled: true,
              name: 'Pay a deposit',
              partialAmount: 5000,
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    describe('tax', () => {
      it('creates an event with stripe tax mode', async () => {
        const { data } = await createEvent({
          tax: {
            enabled: true,
            mode: 'stripe',
          },
        });

        expect(data.tax?.enabled).toBe(true);
        expect(data.tax?.mode).toBe('stripe');
      });

      it('creates an event with fixed tax and explicit fixedTaxRateIds', async () => {
        const taxRate = await client.taxRates.create({
          displayName: `VAT ${uniqueSuffix()}`,
          inclusive: false,
          percentage: 20,
        });

        const { data } = await createEvent({
          tax: {
            enabled: true,
            mode: 'fixed',
          },
          eventDetails: { fixedTaxRateIds: [taxRate.data.id] },
        });

        expect(data.tax?.enabled).toBe(true);
        expect(data.tax?.mode).toBe('fixed');
        expect(data.eventDetails?.fixedTaxRateIds).toContain(taxRate.data.id);
      });

      it('creates with fixed mode and no fixedTaxRateIds — auto-resolves the account default rate', async () => {
        const defaultRate = await client.taxRates.create({
          displayName: `Default VAT ${uniqueSuffix()}`,
          inclusive: false,
          percentage: 20,
          default: true,
        });

        const { data } = await createEvent({
          tax: {
            enabled: true,
            mode: 'fixed',
          },
        });

        expect(data.tax?.enabled).toBe(true);
        expect(data.tax?.mode).toBe('fixed');
        expect(data.eventDetails?.fixedTaxRateIds).toContain(defaultRate.data.id);
      });

      it('creates an event with tax disabled', async () => {
        const { data } = await createEvent({
          tax: {
            enabled: false,
            mode: 'none',
          },
        });

        expect(data.tax?.enabled).toBe(false);
        expect(data.tax?.mode).toBe('none');
      });

      it('clears eventDetails.fixedTaxRateIds when set to []', async () => {
        const { data } = await createEvent({
          tax: { enabled: true, mode: 'fixed' },
          eventDetails: { fixedTaxRateIds: [] },
        });

        const { data: updateData } = await client.events.update(data.id, {
          eventDetails: { fixedTaxRateIds: [] },
        });

        expect(updateData.tax?.enabled).toBe(true);
        expect(updateData.tax?.mode).toBe('fixed');
        expect(updateData.eventDetails?.fixedTaxRateIds).toEqual([]);
      });
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

    it('returns the JSON error envelope for an unknown event id', async () => {
      const eventId = fakeObjectId('missingevent');
      const response = await requestRaw(`/v1/events/${eventId}`);
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
      expectErrorEnvelope(payload, `Event ${eventId} not found`);
    });

    it('returns eventDetails.fixedTaxRateIds in the get response', async () => {
      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });
      const created = await createEvent({
        tax: { enabled: true, mode: 'fixed' },
        eventDetails: { fixedTaxRateIds: [taxRate.data.id] },
      });
      const result = await client.events.get(created.data.id);

      expect(result.data.eventDetails?.fixedTaxRateIds).toContain(taxRate.data.id);
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
            fieldId: created.data.fields?.find(
              (field) => field.reference === 'email' || field.type === 'email'
            )?.id,
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
      expect(normalizeSlug(result.data.slug)).toBe(normalizeSlug(updatedSlug));
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
      const confirmationStep = result.data.funnelSteps?.[0] as
        | Schemas['FunnelStepConfirmationInput']
        | undefined;
      expect(confirmationStep?.config?.action).toBe('redirect');
      expect(result.data.savePaymentMethod).toBe(true);
      expect(result.data.paymentMethods?.stripe?.agpay?.mode).toBe('express');
      expect(result.data.paymentOptions).toHaveLength(4);
      expect(result.data.paymentOptions?.[0]).toMatchObject({
        type: 'full',
        enabled: false,
      });
      expect(result.data.paymentOptions?.[1]).toMatchObject({
        type: 'manual',
        manualType: 'invoice',
        enabled: true,
        showPaymentButton: true,
      });
      expect(result.data.paymentOptions?.[2]).toMatchObject({
        type: 'partial',
        enabled: false,
      });
      expect(result.data.paymentOptions?.[3]).toMatchObject({
        type: 'manual',
        manualType: 'cash_on_delivery',
        enabled: false,
      });
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

    it('rejects unsupported enabled payment option combinations on update', async () => {
      const created = await createEvent();

      await expect(
        client.events.update(created.data.id, {
          paymentOptions: [
            {
              type: 'full',
              enabled: true,
              name: 'Pay in full',
            },
            {
              type: 'manual',
              enabled: true,
              name: 'Pay by invoice',
              manualType: 'invoice',
            },
            {
              type: 'partial',
              enabled: true,
              name: 'Pay a deposit',
              partialAmount: 5000,
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects an uppercase slug on update', async () => {
      const created = await createEvent();

      await expect(
        client.events.update(created.data.id, {
          slug: `/Updated-Event-${uniqueSuffix()}`,
        })
      ).rejects.toThrow(/slug needs to be lowercase/i);
    });

    it('rejects an unknown redirectPageId on update', async () => {
      const created = await createEvent();

      await expect(
        client.events.update(created.data.id, {
          afterPaymentAction: 'checkout',
          redirectPageId: fakeObjectId('missingredirect'),
        })
      ).rejects.toThrow('One or more page IDs not found or not owned by your account');
    });

    it('rejects an unknown funnel page reference on update', async () => {
      const created = await createEvent();

      await expect(
        client.events.update(created.data.id, {
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

    it('preserves slug while clearing other nullable settings when null is provided', async () => {
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

      expect(normalizeSlug(result.data.slug)).toBe(normalizeSlug(created.data.slug));
      expect(result.data.redirectUrl).toBeNull();
      expect(result.data.notifyEmail).toBeNull();
      expect(result.data.confirmationCheckoutTitle).toBeNull();
      expect(result.data.confirmationCheckoutMessage).toBeNull();
      expect(result.data.confirmationEmailSubject).toBeNull();
      expect(result.data.confirmationEmailMessage).toBeNull();
      expect(result.data.trackingCodes).toBeNull();
    });

    it('preserves images when imageIds is omitted and clears them when an empty array is provided', async () => {
      const originalImageId = await uploadImage('event-preserve-original-image');
      const replacementImageId = await uploadImage('event-preserve-replacement-image');
      const created = await createEvent({
        imageIds: [originalImageId],
      });

      const metadataOnlyUpdate = await client.events.update(created.data.id, {
        name: `Metadata only ${uniqueSuffix()}`,
      });

      expect(pageIncludesImage(metadataOnlyUpdate.data, originalImageId)).toBe(true);

      const replacementUpdate = await client.events.update(created.data.id, {
        imageIds: [replacementImageId],
      });

      expect(pageIncludesImage(replacementUpdate.data, replacementImageId)).toBe(true);
      expect(pageIncludesImage(replacementUpdate.data, originalImageId)).toBe(false);

      const clearedUpdate = await client.events.update(created.data.id, {
        imageIds: [],
      });

      expect(clearedUpdate.data.images ?? []).toEqual([]);
    }, 15000);

    it('resolves redirect path and query identifiers on update across field and built-in keys', async () => {
      const created = await createEvent({
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

      const updated = await client.events.update(created.data.id, {
        afterPaymentAction: 'redirect',
        redirectUrl: 'https://example.com/events/updated',
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
      expect(updated.data.redirectUrl).toBe('https://example.com/events/updated');
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

    it('fails for an unknown event id', async () => {
      await expect(
        client.events.update(fakeObjectId('missingevent'), { name: 'Missing event' })
      ).rejects.toThrow(NotFoundError);
    });

    it('ignores an unknown type field', async () => {
      const created = await createEvent();

      const updated = await client.events.update(created.data.id, {
        name: 'updated',
        // @ts-expect-error unknown field
        type: 'unknown field',
        // @ts-expect-error unknown field
        more_unknown_fields: 'value',
      });

      // @ts-expect-error unknown field
      expect(created.data.more_unknown_fields).toBeUndefined();
      expect(updated.data.name).toBe('updated');
      expect(updated.data.type).toBe('event');
    });

    it('fails for a malformed event id', async () => {
      await expect(
        client.events.update('not-a-valid-id', { name: 'Malformed update' })
      ).rejects.toThrow(ValidationError);
    });

    it('updates eventDetails.fixedTaxRateIds on an existing event', async () => {
      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });
      const created = await createEvent({
        tax: { enabled: true, mode: 'fixed' },
      });

      const result = await client.events.update(created.data.id, {
        eventDetails: { fixedTaxRateIds: [taxRate.data.id] },
      });

      expect(result.data.eventDetails?.fixedTaxRateIds).toContain(taxRate.data.id);
    });

    it('clears eventDetails.fixedTaxRateIds by passing []', async () => {
      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });
      const created = await createEvent({
        tax: { enabled: true, mode: 'fixed' },
        eventDetails: { fixedTaxRateIds: [taxRate.data.id] },
      });

      const result = await client.events.update(created.data.id, {
        eventDetails: { fixedTaxRateIds: [] },
      });

      expect(result.data.eventDetails?.fixedTaxRateIds).toEqual([]);
    });

    it('omitting eventDetails.fixedTaxRateIds preserves existing rate', async () => {
      const taxRate = await client.taxRates.create({
        displayName: `VAT ${uniqueSuffix()}`,
        inclusive: false,
        percentage: 20,
      });
      const created = await createEvent({
        tax: { enabled: true, mode: 'fixed' },
        eventDetails: { fixedTaxRateIds: [taxRate.data.id] },
      });

      const result = await client.events.update(created.data.id, {
        name: `Updated Name ${uniqueSuffix()}`,
      });

      expect(result.data.eventDetails?.fixedTaxRateIds).toContain(taxRate.data.id);
    });
  });

  describe('delete', () => {
    it('archives an existing event', async () => {
      const created = await createEvent();
      const result = await client.events.delete(created.data.id);
      forgetPage(created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
      expect(result.data.type).toBe('event');
      expect(result.data.eventDetails).toBeDefined();
      expectBaseEventResponse(result.data);
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

  describe('availabilityBehavior', () => {
    describe('ticket group via event create', () => {
      it('always_available returns null dates and null triggerTicketGroupId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Always Available Group',
              availabilityBehavior: 'always_available',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1000 }],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Always Available Group');
        expect(group.availabilityBehavior).toBe('always_available');
        expect(group.saleStartOn ?? null).toBeNull();
        expect(group.saleEndOn ?? null).toBeNull();
        expect(group.triggerTicketGroupId ?? null).toBeNull();
      });

      it('date_time_based with both saleStartOn and saleEndOn returns ISO strings', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Date Ranged Group',
              availabilityBehavior: 'date_time_based',
              saleStartOn: '2026-08-01T09:00:00Z',
              saleEndOn: '2026-09-30T23:59:59Z',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1000 }],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Date Ranged Group');
        expect(group.availabilityBehavior).toBe('date_time_based');
        expect(group.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
        expect(group.saleEndOn).toBe('2026-09-30T23:59:59.000Z');
        expect(group.triggerTicketGroupId ?? null).toBeNull();
      });

      it('date_time_based with only saleStartOn has null saleEndOn', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Start Only Group',
              availabilityBehavior: 'date_time_based',
              saleStartOn: '2026-08-01T09:00:00Z',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1000 }],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Start Only Group');
        expect(group.availabilityBehavior).toBe('date_time_based');
        expect(group.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
        expect(group.saleEndOn ?? null).toBeNull();
      });

      it('date_time_based with only saleEndOn has null saleStartOn', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'End Only Group',
              availabilityBehavior: 'date_time_based',
              saleEndOn: '2026-09-30T23:59:59Z',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1000 }],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'End Only Group');
        expect(group.availabilityBehavior).toBe('date_time_based');
        expect(group.saleStartOn ?? null).toBeNull();
        expect(group.saleEndOn).toBe('2026-09-30T23:59:59.000Z');
      });

      it('until_event_starts returns null dates and null triggerTicketGroupId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Until Event Starts Group',
              availabilityBehavior: 'until_event_starts',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1000 }],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Until Event Starts Group');
        expect(group.availabilityBehavior).toBe('until_event_starts');
        expect(group.saleStartOn ?? null).toBeNull();
        expect(group.saleEndOn ?? null).toBeNull();
        expect(group.triggerTicketGroupId ?? null).toBeNull();
      });

      it('after_ticket_sale_ends using inline key reference resolves triggerTicketGroupId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              key: 'early-bird',
              name: 'Early Bird Group',
              availabilityBehavior: 'date_time_based',
              saleStartOn: '2026-08-01T09:00:00Z',
              saleEndOn: '2026-08-31T23:59:59Z',
              ticketTypes: [{ name: 'Early Bird', pricing: 'paid', price: 2000 }],
            },
            {
              name: 'Standard Group',
              availabilityBehavior: 'after_ticket_sale_ends',
              triggerTicketGroupId: 'early-bird',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 1500 }],
            },
          ],
        });

        const triggerGroup = getTicketGroupByName(data, 'Early Bird Group');
        const dependentGroup = getTicketGroupByName(data, 'Standard Group');
        expect(dependentGroup.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(dependentGroup.triggerTicketGroupId ?? null).toBe(triggerGroup.id);
      });

      it('after_ticket_sold_out using inline key reference resolves triggerTicketGroupId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              key: 'vip',
              name: 'VIP Group',
              availabilityBehavior: 'always_available',
              capacity: 10,
              ticketTypes: [{ name: 'VIP', pricing: 'paid', price: 5000 }],
            },
            {
              name: 'Waitlist Group',
              availabilityBehavior: 'after_ticket_sold_out',
              triggerTicketGroupId: 'vip',
              ticketTypes: [{ name: 'Waitlist', pricing: 'free', price: 0 }],
            },
          ],
        });

        const triggerGroup = getTicketGroupByName(data, 'VIP Group');
        const dependentGroup = getTicketGroupByName(data, 'Waitlist Group');
        expect(dependentGroup.availabilityBehavior).toBe('after_ticket_sold_out');
        expect(dependentGroup.triggerTicketGroupId ?? null).toBe(triggerGroup.id);
      });

      it('after_ticket_ends_or_sold_out using inline key reference resolves triggerTicketGroupId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              key: 'phase-one',
              name: 'Phase One Group',
              availabilityBehavior: 'date_time_based',
              saleStartOn: '2026-08-01T09:00:00Z',
              saleEndOn: '2026-08-31T23:59:59Z',
              ticketTypes: [{ name: 'Phase One', pricing: 'paid', price: 3000 }],
            },
            {
              name: 'Phase Two Group',
              availabilityBehavior: 'after_ticket_ends_or_sold_out',
              triggerTicketGroupId: 'phase-one',
              ticketTypes: [{ name: 'Phase Two', pricing: 'paid', price: 3500 }],
            },
          ],
        });

        const triggerGroup = getTicketGroupByName(data, 'Phase One Group');
        const dependentGroup = getTicketGroupByName(data, 'Phase Two Group');
        expect(dependentGroup.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
        expect(dependentGroup.triggerTicketGroupId ?? null).toBe(triggerGroup.id);
      });
    });

    describe('ticket type via event create', () => {
      it('always_available returns null dates and null triggerTicketTypeId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  name: 'Always Available Ticket',
                  pricing: 'paid',
                  price: 1000,
                  availabilityBehavior: 'always_available',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const ticket = getTicketTypeByName(group, 'Always Available Ticket');
        expect(ticket.availabilityBehavior).toBe('always_available');
        expect(ticket.saleStartOn ?? null).toBeNull();
        expect(ticket.saleEndOn ?? null).toBeNull();
        expect(ticket.triggerTicketTypeId ?? null).toBeNull();
      });

      it('date_time_based with both saleStartOn and saleEndOn returns ISO strings', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  name: 'Date Ranged Ticket',
                  pricing: 'paid',
                  price: 2000,
                  availabilityBehavior: 'date_time_based',
                  saleStartOn: '2026-08-01T09:00:00Z',
                  saleEndOn: '2026-09-15T23:59:59Z',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const ticket = getTicketTypeByName(group, 'Date Ranged Ticket');
        expect(ticket.availabilityBehavior).toBe('date_time_based');
        expect(ticket.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
        expect(ticket.saleEndOn).toBe('2026-09-15T23:59:59.000Z');
        expect(ticket.triggerTicketTypeId ?? null).toBeNull();
      });

      it('date_time_based with only saleStartOn has null saleEndOn', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  name: 'Start Only Ticket',
                  pricing: 'paid',
                  price: 1500,
                  availabilityBehavior: 'date_time_based',
                  saleStartOn: '2026-08-01T09:00:00Z',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const ticket = getTicketTypeByName(group, 'Start Only Ticket');
        expect(ticket.availabilityBehavior).toBe('date_time_based');
        expect(ticket.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
        expect(ticket.saleEndOn ?? null).toBeNull();
      });

      it('date_time_based with only saleEndOn has null saleStartOn', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  name: 'End Only Ticket',
                  pricing: 'paid',
                  price: 1500,
                  availabilityBehavior: 'date_time_based',
                  saleEndOn: '2026-09-30T23:59:59Z',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const ticket = getTicketTypeByName(group, 'End Only Ticket');
        expect(ticket.availabilityBehavior).toBe('date_time_based');
        expect(ticket.saleStartOn ?? null).toBeNull();
        expect(ticket.saleEndOn).toBe('2026-09-30T23:59:59.000Z');
      });

      it('until_event_starts returns null dates and null triggerTicketTypeId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  name: 'Until Event Ticket',
                  pricing: 'paid',
                  price: 1000,
                  availabilityBehavior: 'until_event_starts',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const ticket = getTicketTypeByName(group, 'Until Event Ticket');
        expect(ticket.availabilityBehavior).toBe('until_event_starts');
        expect(ticket.saleStartOn ?? null).toBeNull();
        expect(ticket.saleEndOn ?? null).toBeNull();
        expect(ticket.triggerTicketTypeId ?? null).toBeNull();
      });

      it('after_ticket_sale_ends using inline key reference resolves triggerTicketTypeId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  key: 'early-bird-ticket',
                  name: 'Early Bird',
                  pricing: 'paid',
                  price: 2000,
                  availabilityBehavior: 'date_time_based',
                  saleStartOn: '2026-08-01T09:00:00Z',
                  saleEndOn: '2026-08-31T23:59:59Z',
                },
                {
                  name: 'Standard Ticket',
                  pricing: 'paid',
                  price: 1500,
                  availabilityBehavior: 'after_ticket_sale_ends',
                  triggerTicketTypeId: 'early-bird-ticket',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const triggerTicket = getTicketTypeByName(group, 'Early Bird');
        const dependentTicket = getTicketTypeByName(group, 'Standard Ticket');
        expect(dependentTicket.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(dependentTicket.triggerTicketTypeId ?? null).toBe(triggerTicket.id);
      });

      it('after_ticket_sold_out using inline key reference resolves triggerTicketTypeId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  key: 'vip-ticket',
                  name: 'VIP Ticket',
                  pricing: 'paid',
                  price: 5000,
                  availabilityBehavior: 'always_available',
                  capacity: 5,
                },
                {
                  name: 'Waitlist Ticket',
                  pricing: 'free',
                  price: 0,
                  availabilityBehavior: 'after_ticket_sold_out',
                  triggerTicketTypeId: 'vip-ticket',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const triggerTicket = getTicketTypeByName(group, 'VIP Ticket');
        const dependentTicket = getTicketTypeByName(group, 'Waitlist Ticket');
        expect(dependentTicket.availabilityBehavior).toBe('after_ticket_sold_out');
        expect(dependentTicket.triggerTicketTypeId ?? null).toBe(triggerTicket.id);
      });

      it('after_ticket_ends_or_sold_out using inline key reference resolves triggerTicketTypeId', async () => {
        const { data } = await createEvent({
          ticketGroups: [
            {
              name: 'Group',
              ticketTypes: [
                {
                  key: 'phase-one-ticket',
                  name: 'Phase One Ticket',
                  pricing: 'paid',
                  price: 3000,
                  availabilityBehavior: 'date_time_based',
                  saleStartOn: '2026-08-01T09:00:00Z',
                  saleEndOn: '2026-08-31T23:59:59Z',
                },
                {
                  name: 'Phase Two Ticket',
                  pricing: 'paid',
                  price: 3500,
                  availabilityBehavior: 'after_ticket_ends_or_sold_out',
                  triggerTicketTypeId: 'phase-one-ticket',
                },
              ],
            },
          ],
        });

        const group = getTicketGroupByName(data, 'Group');
        const triggerTicket = getTicketTypeByName(group, 'Phase One Ticket');
        const dependentTicket = getTicketTypeByName(group, 'Phase Two Ticket');
        expect(dependentTicket.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
        expect(dependentTicket.triggerTicketTypeId ?? null).toBe(triggerTicket.id);
      });
    });

    describe('trigger-based behaviors via sub-resources with real IDs', () => {
      it('sets after_ticket_sale_ends on a ticket group and persists through event get', async () => {
        const event = await createEvent();
        const triggerGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `Trigger Group ${uniqueSuffix()}`,
          availabilityBehavior: 'date_time_based',
          saleStartOn: '2026-08-01T09:00:00Z',
          saleEndOn: '2026-08-31T23:59:59Z',
        });
        const dependentGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `After Sale Ends Group ${uniqueSuffix()}`,
          availabilityBehavior: 'after_ticket_sale_ends',
          triggerTicketGroupId: triggerGroup.data.id,
        });

        expect(dependentGroup.data.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(dependentGroup.data.triggerTicketGroupId ?? null).toBe(triggerGroup.data.id);

        const result = await client.events.get(event.data.id);
        const saved = result.data.ticketGroups?.find((g) => g.id === dependentGroup.data.id);
        expect(saved?.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(saved?.triggerTicketGroupId ?? null).toBe(triggerGroup.data.id);
      });

      it('sets after_ticket_sold_out on a ticket group with a trigger group', async () => {
        const event = await createEvent();
        const triggerGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `Trigger Group ${uniqueSuffix()}`,
          availabilityBehavior: 'always_available',
          capacity: 10,
        });
        const dependentGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `After Sold Out Group ${uniqueSuffix()}`,
          availabilityBehavior: 'after_ticket_sold_out',
          triggerTicketGroupId: triggerGroup.data.id,
        });

        expect(dependentGroup.data.availabilityBehavior).toBe('after_ticket_sold_out');
        expect(dependentGroup.data.triggerTicketGroupId ?? null).toBe(triggerGroup.data.id);
      });

      it('sets after_ticket_ends_or_sold_out on a ticket group with a trigger group', async () => {
        const event = await createEvent();
        const triggerGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `Trigger Group ${uniqueSuffix()}`,
          availabilityBehavior: 'date_time_based',
          saleStartOn: '2026-08-01T09:00:00Z',
          saleEndOn: '2026-08-31T23:59:59Z',
        });
        const dependentGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `After Ends Or Sold Out Group ${uniqueSuffix()}`,
          availabilityBehavior: 'after_ticket_ends_or_sold_out',
          triggerTicketGroupId: triggerGroup.data.id,
        });

        expect(dependentGroup.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
        expect(dependentGroup.data.triggerTicketGroupId ?? null).toBe(triggerGroup.data.id);
      });

      it('sets after_ticket_sale_ends on a ticket type and persists through event get', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const triggerTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Trigger Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 2000,
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-08-01T09:00:00Z',
            saleEndOn: '2026-08-31T23:59:59Z',
          }
        );
        const dependentTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `After Sale Ends Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'after_ticket_sale_ends',
            triggerTicketTypeId: triggerTicket.data.id,
          }
        );

        expect(dependentTicket.data.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(dependentTicket.data.triggerTicketTypeId ?? null).toBe(triggerTicket.data.id);

        const result = await client.events.get(event.data.id);
        const savedGroup = result.data.ticketGroups?.find((g) => g.id === group.data.id);
        const savedTicket = savedGroup?.ticketTypes?.find((t) => t.id === dependentTicket.data.id);
        expect(savedTicket?.availabilityBehavior).toBe('after_ticket_sale_ends');
        expect(savedTicket?.triggerTicketTypeId ?? null).toBe(triggerTicket.data.id);
      });

      it('sets after_ticket_sold_out on a ticket type with a trigger ticket type', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const triggerTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Trigger Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 2000,
            capacity: 5,
            availabilityBehavior: 'always_available',
          }
        );
        const dependentTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `After Sold Out Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'after_ticket_sold_out',
            triggerTicketTypeId: triggerTicket.data.id,
          }
        );

        expect(dependentTicket.data.availabilityBehavior).toBe('after_ticket_sold_out');
        expect(dependentTicket.data.triggerTicketTypeId ?? null).toBe(triggerTicket.data.id);
      });

      it('sets after_ticket_ends_or_sold_out on a ticket type with a trigger ticket type', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const triggerTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Trigger Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 2000,
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-08-01T09:00:00Z',
            saleEndOn: '2026-08-31T23:59:59Z',
          }
        );
        const dependentTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `After Ends Or Sold Out Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'after_ticket_ends_or_sold_out',
            triggerTicketTypeId: triggerTicket.data.id,
          }
        );

        expect(dependentTicket.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
        expect(dependentTicket.data.triggerTicketTypeId ?? null).toBe(triggerTicket.data.id);
      });
    });

    describe('switching availability behaviors', () => {
      it('switches ticket group from date_time_based to always_available and clears dates', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Switch Group ${uniqueSuffix()}`,
          availabilityBehavior: 'date_time_based',
          saleStartOn: '2026-08-01T09:00:00Z',
          saleEndOn: '2026-08-31T23:59:59Z',
        });

        expect(group.data.availabilityBehavior).toBe('date_time_based');

        const updated = await client.events.ticketGroups.update(event.data.id, group.data.id, {
          availabilityBehavior: 'always_available',
          saleStartOn: null,
          saleEndOn: null,
        });

        expect(updated.data.availabilityBehavior).toBe('always_available');
        expect(updated.data.saleStartOn).toBeNull();
        expect(updated.data.saleEndOn).toBeNull();
      });

      it('switches ticket group from always_available to date_time_based with dates', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Switch Group ${uniqueSuffix()}`,
          availabilityBehavior: 'always_available',
        });

        const updated = await client.events.ticketGroups.update(event.data.id, group.data.id, {
          availabilityBehavior: 'date_time_based',
          saleStartOn: '2026-08-15T09:00:00Z',
          saleEndOn: '2026-09-15T23:59:59Z',
        });

        expect(updated.data.availabilityBehavior).toBe('date_time_based');
        expect(updated.data.saleStartOn).toBe('2026-08-15T09:00:00.000Z');
        expect(updated.data.saleEndOn).toBe('2026-09-15T23:59:59.000Z');
      });

      it('switches ticket group from date_time_based to until_event_starts and clears dates', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Switch Group ${uniqueSuffix()}`,
          availabilityBehavior: 'date_time_based',
          saleStartOn: '2026-08-01T09:00:00Z',
          saleEndOn: '2026-08-31T23:59:59Z',
        });

        const updated = await client.events.ticketGroups.update(event.data.id, group.data.id, {
          availabilityBehavior: 'until_event_starts',
          saleStartOn: null,
          saleEndOn: null,
        });

        expect(updated.data.availabilityBehavior).toBe('until_event_starts');
        expect(updated.data.saleStartOn).toBeNull();
        expect(updated.data.saleEndOn).toBeNull();
      });

      it('switches ticket type from date_time_based to always_available and clears dates', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const ticketType = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Switch Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-08-01T09:00:00Z',
            saleEndOn: '2026-08-31T23:59:59Z',
          }
        );

        expect(ticketType.data.availabilityBehavior).toBe('date_time_based');

        const updated = await client.events.ticketGroups.ticketTypes.update(
          event.data.id,
          group.data.id,
          ticketType.data.id,
          {
            availabilityBehavior: 'always_available',
            saleStartOn: null,
            saleEndOn: null,
          }
        );

        expect(updated.data.availabilityBehavior).toBe('always_available');
        expect(updated.data.saleStartOn).toBeNull();
        expect(updated.data.saleEndOn).toBeNull();
      });

      it('switches ticket type from always_available to until_event_starts', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const ticketType = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Switch Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'always_available',
          }
        );

        const updated = await client.events.ticketGroups.ticketTypes.update(
          event.data.id,
          group.data.id,
          ticketType.data.id,
          { availabilityBehavior: 'until_event_starts' }
        );

        expect(updated.data.availabilityBehavior).toBe('until_event_starts');
        expect(updated.data.saleStartOn ?? null).toBeNull();
        expect(updated.data.saleEndOn ?? null).toBeNull();
      });

      it('moves a ticket type to another ticket group by updating ticketGroupId', async () => {
        const event = await createEvent();
        const sourceGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `Source Group ${uniqueSuffix()}`,
        });
        const destinationGroup = await client.events.ticketGroups.create(event.data.id, {
          name: `Destination Group ${uniqueSuffix()}`,
        });
        const ticketType = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          sourceGroup.data.id,
          {
            name: `Move Ticket ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
          }
        );

        const updated = await client.events.ticketGroups.ticketTypes.update(
          event.data.id,
          sourceGroup.data.id,
          ticketType.data.id,
          {
            ticketGroupId: destinationGroup.data.id,
            name: `Moved Ticket ${uniqueSuffix()}`,
          }
        );

        expect(updated.data.ticketGroupId).toBe(destinationGroup.data.id);
        expect(updated.data.name).toContain('Moved Ticket');

        const destinationGroupRead = await client.events.ticketGroups.get(
          event.data.id,
          destinationGroup.data.id
        );
        expect(destinationGroupRead.data.ticketTypeIds).toContain(ticketType.data.id);

        const eventRead = await client.events.get(event.data.id);
        const sourceGroupInEvent = eventRead.data.ticketGroups?.find(
          (group) => group.id === sourceGroup.data.id
        );
        const destinationGroupInEvent = eventRead.data.ticketGroups?.find(
          (group) => group.id === destinationGroup.data.id
        );

        expect(
          sourceGroupInEvent?.ticketTypes?.some((ticket) => ticket.id === ticketType.data.id) ??
            false
        ).toBe(false);
        expect(
          destinationGroupInEvent?.ticketTypes?.some((ticket) => ticket.id === ticketType.data.id)
        ).toBe(true);
      });

      it('switches ticket type from trigger-based to date_time_based', async () => {
        const event = await createEvent();
        const group = await client.events.ticketGroups.create(event.data.id, {
          name: `Group ${uniqueSuffix()}`,
        });
        const triggerTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Trigger ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 2000,
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-08-01T09:00:00Z',
            saleEndOn: '2026-08-31T23:59:59Z',
          }
        );
        const dependentTicket = await client.events.ticketGroups.ticketTypes.create(
          event.data.id,
          group.data.id,
          {
            name: `Dependent ${uniqueSuffix()}`,
            pricing: 'paid',
            price: 1500,
            availabilityBehavior: 'after_ticket_sale_ends',
            triggerTicketTypeId: triggerTicket.data.id,
          }
        );

        expect(dependentTicket.data.availabilityBehavior).toBe('after_ticket_sale_ends');

        const updated = await client.events.ticketGroups.ticketTypes.update(
          event.data.id,
          group.data.id,
          dependentTicket.data.id,
          {
            availabilityBehavior: 'date_time_based',
            saleStartOn: '2026-09-01T09:00:00Z',
            saleEndOn: '2026-09-30T23:59:59Z',
          }
        );

        expect(updated.data.availabilityBehavior).toBe('date_time_based');
        expect(updated.data.saleStartOn).toBe('2026-09-01T09:00:00.000Z');
        expect(updated.data.saleEndOn).toBe('2026-09-30T23:59:59.000Z');
      });
    });
  });

  describe('eventDetails.discounts key linking', () => {
    it('total_quantity discounts are stored with empty ticketTypeIds array', async () => {
      const { data } = await client.events.create({
        name: `SDK Event ${uniqueSuffix()}`,
        eventDetails: {
          type: 'in_person',
          currency: 'usd',
          startDate: '2026-09-01T09:00:00Z',
          endDate: '2026-09-01T17:00:00Z',
          timezone: 'UTC',
          location: 'Test Venue',
          discounts: [
            {
              quantityCondition: 'total_quantity',
              minQuantity: 2,
              maxQuantity: 5,
              percentOff: 10,
            },
          ],
        } as any,
        ticketGroups: [
          {
            name: 'General Admission',
            ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 2000 }],
          },
        ],
      } as any);

      rememberPage(data.id);

      const eventDetails = (data as any).eventDetails;
      expect(eventDetails.discounts).toHaveLength(1);
      expect(eventDetails.discounts[0].quantityCondition).toBe('total_quantity');
      expect(eventDetails.discounts[0].ticketTypeIds).toEqual([]);
      expect(eventDetails.discounts[0].minQuantity).toBe(2);
      expect(eventDetails.discounts[0].maxQuantity).toBe(5);
      expect(eventDetails.discounts[0].percentOff).toBe(10);
    });

    it('ticket_type_quantity discounts resolve ticket type keys to ObjectIds', async () => {
      const { data } = await client.events.create({
        name: `SDK Event - 2 ${uniqueSuffix()}`,
        eventDetails: {
          type: 'in_person',
          currency: 'usd',
          startDate: '2026-09-01T09:00:00Z',
          endDate: '2026-09-01T17:00:00Z',
          timezone: 'UTC',
          location: 'Test Venue',
          discounts: [
            {
              quantityCondition: 'ticket_type_quantity',
              ticketTypeIds: [{ key: 'vip' }],
              minQuantity: 2,
              percentOff: 15,
            },
          ],
        } as any,
        ticketGroups: [
          {
            name: 'VIP',
            ticketTypes: [
              { key: 'vip', name: 'VIP Ticket', pricing: 'paid', price: 5000 },
              { name: 'General admission', price: 1000 },
            ],
          },
        ],
      } as any);

      rememberPage(data.id);

      const group = getTicketGroupByName(data, 'VIP');
      const ticketType = getTicketTypeByName(group, 'VIP Ticket');

      const eventDetails = (data as any).eventDetails;
      expect(eventDetails.discounts).toHaveLength(1);
      const discount = eventDetails.discounts[0];
      expect(discount.quantityCondition).toBe('ticket_type_quantity');
      expect(discount.ticketTypeIds).toHaveLength(1);
      expect(discount.ticketTypeIds[0]).toBe(ticketType.id);
      expect(discount.minQuantity).toBe(2);
      expect(discount.percentOff).toBe(15);
    });

    it('resolves multiple ticket type keys across groups', async () => {
      const { data } = await client.events.create({
        name: `SDK Event ${uniqueSuffix()}`,
        eventDetails: {
          type: 'in_person',
          currency: 'usd',
          startDate: '2026-09-01T09:00:00Z',
          endDate: '2026-09-01T17:00:00Z',
          timezone: 'UTC',
          location: 'Test Venue',
          discounts: [
            {
              quantityCondition: 'ticket_type_quantity',
              ticketTypeIds: [{ key: 'early-bird' }, { key: 'standard' }],
              minQuantity: 3,
              amountOff: 500,
            },
          ],
        } as any,
        ticketGroups: [
          {
            name: 'General',
            ticketTypes: [
              { key: 'early-bird', name: 'Early Bird', pricing: 'paid', price: 1500 },
              { key: 'standard', name: 'Standard', pricing: 'paid', price: 2000 },
            ],
          },
        ],
      } as any);

      rememberPage(data.id);

      const group = getTicketGroupByName(data, 'General');
      const earlyBird = getTicketTypeByName(group, 'Early Bird');
      const standard = getTicketTypeByName(group, 'Standard');

      const eventDetails = (data as any).eventDetails;
      const discount = eventDetails.discounts[0];
      expect(discount.ticketTypeIds).toHaveLength(2);
      expect(discount.ticketTypeIds).toContain(earlyBird.id);
      expect(discount.ticketTypeIds).toContain(standard.id);
      expect(discount.amountOff).toBe(500);
    });

    it('returns 400 when a discount references an unknown ticket type key', async () => {
      await expect(
        client.events.create({
          name: `SDK Event ${uniqueSuffix()}`,
          eventDetails: {
            type: 'in_person',
            currency: 'usd',
            startDate: '2026-09-01T09:00:00Z',
            endDate: '2026-09-01T17:00:00Z',
            timezone: 'UTC',
            location: 'Test Venue',
            discounts: [
              {
                quantityCondition: 'ticket_type_quantity',
                ticketTypeIds: [{ key: 'nonexistent-key' }],
                minQuantity: 2,
                percentOff: 10,
              },
            ],
          } as any,
          ticketGroups: [
            {
              name: 'General',
              ticketTypes: [{ name: 'Standard', pricing: 'paid', price: 2000 }],
            },
          ],
        } as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('eventDetails.discounts update', () => {
    it('adds a total_quantity discount to an existing event', async () => {
      const { data: created } = await createEvent();

      const updated = await client.events.update(created.id, {
        eventDetails: {
          discounts: [
            {
              quantityCondition: 'total_quantity',
              minQuantity: 2,
              maxQuantity: 4,
              percentOff: 10,
            } as any,
          ],
        } as any,
      } as any);

      const eventDetails = (updated.data as any).eventDetails;
      expect(eventDetails.discounts).toHaveLength(1);
      expect(eventDetails.discounts[0].quantityCondition).toBe('total_quantity');
      expect(eventDetails.discounts[0].ticketTypeIds).toEqual([]);
      expect(eventDetails.discounts[0].minQuantity).toBe(2);
      expect(eventDetails.discounts[0].maxQuantity).toBe(4);
      expect(eventDetails.discounts[0].percentOff).toBe(10);
    });

    it('adds a ticket_type_quantity discount referencing ticket types by { id }', async () => {
      const { data: created } = await createEvent({
        ticketGroups: [
          {
            name: 'General',
            ticketTypes: [{ key: 'ga', name: 'General Admission', pricing: 'paid', price: 2000 }],
          },
        ],
      });

      const group = getTicketGroupByName(created, 'General');
      const ticketType = getTicketTypeByName(group, 'General Admission');

      const updated = await client.events.update(created.id, {
        eventDetails: {
          discounts: [
            {
              quantityCondition: 'ticket_type_quantity',
              ticketTypeIds: [{ id: ticketType.id }],
              minQuantity: 3,
              percentOff: 15,
            } as any,
          ],
        } as any,
      } as any);

      const eventDetails = (updated.data as any).eventDetails;
      expect(eventDetails.discounts).toHaveLength(1);
      const discount = eventDetails.discounts[0];
      expect(discount.quantityCondition).toBe('ticket_type_quantity');
      expect(discount.ticketTypeIds).toHaveLength(1);
      expect(discount.ticketTypeIds[0]).toBe(ticketType.id);
      expect(discount.minQuantity).toBe(3);
      expect(discount.percentOff).toBe(15);
    });

    it('replaces existing discounts when updated', async () => {
      const { data: created } = await createEvent({
        eventDetails: {
          discounts: [{ quantityCondition: 'total_quantity', minQuantity: 2, percentOff: 10 }],
        } as any,
      });

      const updated = await client.events.update(created.id, {
        eventDetails: {
          discounts: [
            { quantityCondition: 'total_quantity', minQuantity: 5, percentOff: 20 } as any,
          ],
        } as any,
      } as any);

      const eventDetails = (updated.data as any).eventDetails;
      expect(eventDetails.discounts).toHaveLength(1);
      expect(eventDetails.discounts[0].minQuantity).toBe(5);
      expect(eventDetails.discounts[0].percentOff).toBe(20);
    });

    it('clears discounts when null is provided', async () => {
      const { data: created } = await createEvent({
        eventDetails: {
          discounts: [{ quantityCondition: 'total_quantity', minQuantity: 2, percentOff: 10 }],
        } as any,
      });

      const updated = await client.events.update(created.id, {
        eventDetails: {
          discounts: null,
        } as any,
      } as any);

      const eventDetails = (updated.data as any).eventDetails;
      expect(eventDetails.discounts ?? null).toBeNull();
    });

    it('returns 400 when a ticket_type_quantity discount references an invalid id', async () => {
      const { data: created } = await createEvent();

      await expect(
        client.events.update(created.id, {
          eventDetails: {
            discounts: [
              {
                quantityCondition: 'ticket_type_quantity',
                ticketTypeIds: [{ id: 'not-a-valid-objectid' }],
                minQuantity: 2,
                percentOff: 10,
              } as any,
            ],
          } as any,
        } as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('rich text fields return HTML', () => {
    it('returns description as HTML, not lexical JSON', async () => {
      const { data } = await createEvent({
        description: '<p>This is the <strong>event</strong> description.</p>',
      });

      expect(data.description).toBeTypeOf('string');
      expect(data.description).toContain('<p>');
      expect(data.description).not.toContain('"root"');
    });

    it('returns confirmationCheckoutMessage as HTML, not slate JSON', async () => {
      const { data } = await createEvent({
        customizeCheckoutConfirmation: true,
        confirmationCheckoutTitle: 'Booking confirmed',
        confirmationCheckoutMessage: '<p>See you at the event.</p>',
      });

      expect(data.confirmationCheckoutMessage).toBeTypeOf('string');
      expect(data.confirmationCheckoutMessage).toContain('<p>');
      expect(data.confirmationCheckoutMessage).not.toContain('"children"');
    });

    it('returns confirmationEmailMessage as HTML, not slate JSON', async () => {
      const { data } = await createEvent({
        sendEmailConfirmation: true,
        customizeEmailConfirmation: true,
        confirmationEmailSubject: 'Your booking',
        confirmationEmailMessage: '<p>Your booking is confirmed.</p>',
      });

      expect(data.confirmationEmailMessage).toBeTypeOf('string');
      expect(data.confirmationEmailMessage).toContain('<p>');
      expect(data.confirmationEmailMessage).not.toContain('"children"');
    });
  });
});
