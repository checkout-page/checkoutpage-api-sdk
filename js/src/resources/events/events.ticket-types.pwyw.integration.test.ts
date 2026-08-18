import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { ValidationError } from '../../errors';
import { EventsResource } from './events';
import type { CreateEventParams, CreateEventTicketTypeParams } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource ticket type pwyw pricing integration tests', () => {
  let apiClient: CheckoutPageApiClient;
  let events: EventsResource;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const defaultEventParams = (suffix: string): CreateEventParams => ({
    name: `SDK PWYW Event ${suffix}`,
    title: `SDK PWYW Event Title ${suffix}`,
    eventDetails: {
      type: 'in_person',
      currency: 'usd',
      startDate: '2026-09-01T09:00:00Z',
      endDate: '2026-09-01T17:00:00Z',
      timezone: 'UTC',
      location: 'SDK Event Venue',
    },
  });

  const createEvent = async (overrides: Partial<CreateEventParams> = {}) => {
    const suffix = uniqueSuffix();
    const response = await events.create({
      ...defaultEventParams(suffix),
      ...overrides,
    });
    rememberPage(response.data.id);
    return response;
  };

  const createTicketGroup = async (pageId: string) => {
    return events.ticketGroups.create(pageId, {
      name: `SDK PWYW Group ${uniqueSuffix()}`,
    });
  };

  const createPwywTicketType = async (
    pageId: string,
    ticketGroupId: string,
    overrides: Partial<CreateEventTicketTypeParams> = {}
  ) => {
    return events.ticketGroups.ticketTypes.create(pageId, ticketGroupId, {
      name: `PWYW Ticket ${uniqueSuffix()}`,
      pricing: 'pwyw',
      price: 1000,
      pwywSuggestedPrice: 2500,
      ...overrides,
    });
  };

  beforeAll(() => {
    config = loadIntegrationConfig();
    apiClient = new CheckoutPageApiClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    events = new EventsResource(apiClient);
  });

  afterEach(async () => {
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        await events.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdPageIds = [];
  });

  describe('create', () => {
    it('creates a pwyw ticket type with a minimum and suggested price', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createPwywTicketType(event.data.id, group.data.id);

      expect(result.data.pricing).toBe('pwyw');
      expect(result.data.price).toBe(1000);
      expect(result.data.pwywSuggestedPrice).toBe(2500);
    });

    it('defaults the suggested price to 0 when omitted', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createPwywTicketType(event.data.id, group.data.id, {
        pwywSuggestedPrice: undefined,
      });

      expect(result.data.pricing).toBe('pwyw');
      expect(result.data.pwywSuggestedPrice ?? 0).toBe(0);
    });

    it('allows a zero minimum so customers can pick any amount', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createPwywTicketType(event.data.id, group.data.id, {
        price: 0,
        pwywSuggestedPrice: 1500,
      });

      expect(result.data.pricing).toBe('pwyw');
      expect(result.data.price).toBe(0);
      expect(result.data.pwywSuggestedPrice).toBe(1500);
    });

    it('allows a suggested price of 0 (unset) alongside a nonzero minimum', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createPwywTicketType(event.data.id, group.data.id, {
        price: 1000,
        pwywSuggestedPrice: 0,
      });

      expect(result.data.price).toBe(1000);
      expect(result.data.pwywSuggestedPrice).toBe(0);
    });

    it('rejects a suggested price below the minimum', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        createPwywTicketType(event.data.id, group.data.id, {
          price: 2000,
          pwywSuggestedPrice: 500,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a negative suggested price', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        createPwywTicketType(event.data.id, group.data.id, {
          pwywSuggestedPrice: -1,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('ignores the suggested-price rule for paid ticket types', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await events.ticketGroups.ticketTypes.create(event.data.id, group.data.id, {
        name: `Paid Ticket ${uniqueSuffix()}`,
        pricing: 'paid',
        price: 2000,
        pwywSuggestedPrice: 500,
      });

      expect(result.data.pricing).toBe('paid');
      expect(result.data.price).toBe(2000);
    });
  });

  describe('update', () => {
    it('converts a paid ticket type to pwyw', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await events.ticketGroups.ticketTypes.create(event.data.id, group.data.id, {
        name: `Paid Ticket ${uniqueSuffix()}`,
        pricing: 'paid',
        price: 2500,
      });

      const updated = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          pricing: 'pwyw',
          pwywSuggestedPrice: 4000,
        }
      );

      expect(updated.data.pricing).toBe('pwyw');
      expect(updated.data.price).toBe(2500);
      expect(updated.data.pwywSuggestedPrice).toBe(4000);
    });

    it('updates the suggested price on a pwyw ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createPwywTicketType(event.data.id, group.data.id);

      const updated = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        { pwywSuggestedPrice: 3000 }
      );

      expect(updated.data.pricing).toBe('pwyw');
      expect(updated.data.pwywSuggestedPrice).toBe(3000);
    });

    it('validates the merged pricing when only the minimum changes', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createPwywTicketType(event.data.id, group.data.id, {
        price: 1000,
        pwywSuggestedPrice: 2000,
      });

      await expect(
        events.ticketGroups.ticketTypes.update(event.data.id, group.data.id, created.data.id, {
          price: 3000,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects lowering the suggested price below the stored minimum', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createPwywTicketType(event.data.id, group.data.id, {
        price: 1000,
        pwywSuggestedPrice: 2000,
      });

      await expect(
        events.ticketGroups.ticketTypes.update(event.data.id, group.data.id, created.data.id, {
          pwywSuggestedPrice: 500,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('read', () => {
    it('returns pwyw fields from get and list', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createPwywTicketType(event.data.id, group.data.id);

      const fetched = await events.ticketGroups.ticketTypes.get(
        event.data.id,
        group.data.id,
        created.data.id
      );
      expect(fetched.data.pricing).toBe('pwyw');
      expect(fetched.data.price).toBe(1000);
      expect(fetched.data.pwywSuggestedPrice).toBe(2500);

      const listed = await events.ticketGroups.ticketTypes.list(event.data.id, group.data.id);
      const listItem = listed.data.find((ticket) => ticket.id === created.data.id);
      expect(listItem?.pricing).toBe('pwyw');
      expect(listItem?.pwywSuggestedPrice).toBe(2500);
    });

    it('returns pwyw fields on ticket types nested in the event', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createPwywTicketType(event.data.id, group.data.id);

      const eventRead = await events.get(event.data.id);
      const nestedGroup = eventRead.data.ticketGroups?.find((item) => item.id === group.data.id);
      const nestedTicket = nestedGroup?.ticketTypes?.find((ticket) => ticket.id === created.data.id);

      expect(nestedTicket?.pricing).toBe('pwyw');
      expect(nestedTicket?.price).toBe(1000);
      expect(nestedTicket?.pwywSuggestedPrice).toBe(2500);
    });
  });

  describe('inline event create', () => {
    it('creates an event with an inline pwyw ticket type and placeholder layout', async () => {
      const suffix = uniqueSuffix();
      const response = await events.create({
        ...defaultEventParams(suffix),
        ticketGroups: [
          {
            name: `Inline PWYW Group ${suffix}`,
            layout: {
              showPwywPlaceholder: true,
            },
            ticketTypes: [
              {
                name: `Inline PWYW Ticket ${suffix}`,
                pricing: 'pwyw',
                price: 500,
                pwywSuggestedPrice: 1500,
              },
            ],
          },
        ],
      });
      rememberPage(response.data.id);

      const eventRead = await events.get(response.data.id);
      const group = eventRead.data.ticketGroups?.find(
        (item) => item.name === `Inline PWYW Group ${suffix}`
      );
      expect(group?.layout?.showPwywPlaceholder).toBe(true);

      const ticket = group?.ticketTypes?.find(
        (item) => item.name === `Inline PWYW Ticket ${suffix}`
      );
      expect(ticket?.pricing).toBe('pwyw');
      expect(ticket?.price).toBe(500);
      expect(ticket?.pwywSuggestedPrice).toBe(1500);
    });

    it('rejects an inline pwyw ticket type with a suggested price below the minimum', async () => {
      const suffix = uniqueSuffix();

      await expect(
        events.create({
          ...defaultEventParams(suffix),
          ticketGroups: [
            {
              name: `Inline Invalid Group ${suffix}`,
              ticketTypes: [
                {
                  name: `Inline Invalid Ticket ${suffix}`,
                  pricing: 'pwyw',
                  price: 2000,
                  pwywSuggestedPrice: 100,
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
