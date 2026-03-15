import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateEventParams, CreateEventTicketGroupParams, Event } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource ticketGroups integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const defaultEventParams = (suffix: string): CreateEventParams => ({
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
  });

  const createEvent = async (overrides: Partial<CreateEventParams> = {}) => {
    const suffix = uniqueSuffix();
    const response = await client.events.create({
      ...defaultEventParams(suffix),
      ...overrides,
    });

    rememberPage(response.data.id);
    return response;
  };

  const createTicketGroup = async (
    pageId: string,
    overrides: Partial<CreateEventTicketGroupParams> = {}
  ) => {
    const suffix = uniqueSuffix();
    return client.events.ticketGroups.create(pageId, {
      name: `SDK Ticket Group ${suffix}`,
      ...overrides,
    });
  };

  const getDefaultTicketTypeId = (event: Event) => {
    const ticketTypeId = event.ticketGroups?.[0]?.ticketTypes?.[0]?.id;
    expect(ticketTypeId).toBeDefined();
    return ticketTypeId as string;
  };

  const createTriggerGroup = async (pageId: string) => {
    const response = await createTicketGroup(pageId, {
      name: `Trigger Group ${uniqueSuffix()}`,
      availabilityBehavior: 'date_time_based',
      saleStartOn: '2026-08-01T09:00:00Z',
      saleEndOn: '2026-08-15T09:00:00Z',
    });

    return response.data;
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
    it('lists ticket groups for an event', async () => {
      const event = await createEvent();
      const result = await client.events.ticketGroups.list(event.data.id);

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(Array.isArray(result.data[0]?.ticketTypeIds)).toBe(true);
    });

    it('returns ticket groups in persisted order', async () => {
      const event = await createEvent();
      const first = await createTicketGroup(event.data.id, { name: `First ${uniqueSuffix()}` });
      const second = await createTicketGroup(event.data.id, { name: `Second ${uniqueSuffix()}` });

      const result = await client.events.ticketGroups.list(event.data.id);
      const firstIndex = result.data.findIndex((group) => group.id === first.data.id);
      const secondIndex = result.data.findIndex((group) => group.id === second.data.id);

      expect(firstIndex).toBeGreaterThan(-1);
      expect(secondIndex).toBeGreaterThan(-1);
      expect(firstIndex).toBeLessThan(secondIndex);
    });

    it('fails for an unknown event id', async () => {
      await expect(client.events.ticketGroups.list(fakeObjectId('missingevent'))).rejects.toThrow(
        NotFoundError
      );
    });

    it('fails for a malformed event id', async () => {
      await expect(client.events.ticketGroups.list('not-a-valid-id')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('create', () => {
    it('creates a minimal ticket group', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        name: `Minimal ${uniqueSuffix()}`,
      });

      expect(result.data.id).toBeTypeOf('string');
      expect(result.data.name).toContain('Minimal');
      expect(Array.isArray(result.data.ticketTypeIds)).toBe(true);
    });

    it('creates a ticket group with layout configuration', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        layout: {
          type: 'grid',
          columns: 2,
          alignment: 'center',
          spacing: 'compact',
          imageSize: 'medium',
          showTicketGroupName: true,
          showTicketTypeName: true,
          showTicketPrice: true,
          showTicketTotalPrice: true,
          showTicketSaleDateTimezone: true,
        },
      });

      expect(result.data.layout?.type).toBe('grid');
      expect(result.data.layout?.columns).toBe(2);
      expect(result.data.layout?.alignment).toBe('center');
      expect(result.data.layout?.showTicketSaleDateTimezone).toBe(true);
    });

    it('creates a ticket group with preselection configuration', async () => {
      const event = await createEvent();
      const defaultTicketTypeId = getDefaultTicketTypeId(event.data);

      const result = await createTicketGroup(event.data.id, {
        ticketSelectionType: 'quantity',
        preselect: {
          enabled: true,
          ticketTypeId: defaultTicketTypeId,
          quantity: 2,
        },
      });

      expect(result.data.ticketSelectionType).toBe('quantity');
      expect(result.data.preselect?.enabled).toBe(true);
      expect(result.data.preselect?.quantity).toBe(2);
    });

    it('creates a ticket group with capacity and visibility flags', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        capacity: 50,
        hidden: true,
        hideWhenSoldOut: true,
        hideWhenNotOnSale: true,
        hideWhenScheduled: true,
        hideWhenUnavailable: true,
      });

      expect(result.data.capacity).toBe(50);
      expect(result.data.hidden).toBe(true);
      expect(result.data.hideWhenSoldOut).toBe(true);
      expect(result.data.hideWhenNotOnSale).toBe(true);
      expect(result.data.hideWhenScheduled).toBe(true);
      expect(result.data.hideWhenUnavailable).toBe(true);
    });

    it('creates a ticket group with bulk discounts', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        bulkDiscounts: [
          {
            minQuantity: 2,
            maxQuantity: 4,
            percentOff: 10,
          },
        ],
      });

      expect(result.data.bulkDiscounts?.[0]?.minQuantity).toBe(2);
      expect(result.data.bulkDiscounts?.[0]?.maxQuantity).toBe(4);
      expect(result.data.bulkDiscounts?.[0]?.percentOff).toBe(10);
    });

    it('creates a ticket group with date_time_based availability', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'date_time_based',
        saleStartOn: '2026-08-01T09:00:00Z',
        saleEndOn: '2026-08-15T09:00:00Z',
      });

      expect(result.data.availabilityBehavior).toBe('date_time_based');
      expect(result.data.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
      expect(result.data.saleEndOn).toBe('2026-08-15T09:00:00.000Z');
    });

    it('creates a ticket group with after_ticket_sale_ends availability', async () => {
      const event = await createEvent();
      const triggerGroup = await createTriggerGroup(event.data.id);
      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'after_ticket_sale_ends',
        triggerTicketGroupId: triggerGroup.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_sale_ends');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('creates a ticket group with after_ticket_sold_out availability', async () => {
      const event = await createEvent();
      const triggerGroup = await createTriggerGroup(event.data.id);
      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'after_ticket_sold_out',
        triggerTicketGroupId: triggerGroup.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_sold_out');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('creates a ticket group with after_ticket_ends_or_sold_out availability', async () => {
      const event = await createEvent();
      const triggerGroup = await createTriggerGroup(event.data.id);
      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'after_ticket_ends_or_sold_out',
        triggerTicketGroupId: triggerGroup.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('creates a ticket group with until_event_starts availability', async () => {
      const event = await createEvent();
      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'until_event_starts',
      });

      expect(result.data.availabilityBehavior).toBe('until_event_starts');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('accepts triggerTicketGroupId that references a missing ticket group', async () => {
      const event = await createEvent();

      const result = await createTicketGroup(event.data.id, {
        availabilityBehavior: 'after_ticket_sold_out',
        triggerTicketGroupId: fakeObjectId('missinggroup'),
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_sold_out');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('fails for a malformed event id', async () => {
      await expect(
        client.events.ticketGroups.create('not-a-valid-id', { name: 'Malformed Event' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get', () => {
    it('gets an existing ticket group', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const result = await client.events.ticketGroups.get(event.data.id, created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.name).toBe(created.data.name);
    });

    it('returns layout and availability configuration', async () => {
      const event = await createEvent();
      const triggerGroup = await createTriggerGroup(event.data.id);
      const created = await createTicketGroup(event.data.id, {
        layout: {
          type: 'accordion',
          collapse: true,
          alignment: 'stack',
        },
        availabilityBehavior: 'after_ticket_sale_ends',
        triggerTicketGroupId: triggerGroup.id,
      });
      const result = await client.events.ticketGroups.get(event.data.id, created.data.id);

      expect(result.data.layout?.type).toBe('accordion');
      expect(result.data.layout?.collapse).toBe(true);
      expect(result.data.layout?.alignment).toBe('stack');
      expect(result.data.availabilityBehavior).toBe('after_ticket_sale_ends');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('fails for an unknown ticket group id', async () => {
      const event = await createEvent();

      await expect(
        client.events.ticketGroups.get(event.data.id, fakeObjectId('missinggroup'))
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a ticket group that does not belong to the event', async () => {
      const firstEvent = await createEvent();
      const secondEvent = await createEvent();
      const secondGroup = await createTicketGroup(secondEvent.data.id);

      await expect(
        client.events.ticketGroups.get(firstEvent.data.id, secondGroup.data.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(client.events.ticketGroups.get('not-a-valid-id', group.data.id)).rejects.toThrow(
        ValidationError
      );
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();

      await expect(client.events.ticketGroups.get(event.data.id, 'not-a-valid-id')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('update', () => {
    it('updates ticket group metadata', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const result = await client.events.ticketGroups.update(event.data.id, created.data.id, {
        name: `Updated ${uniqueSuffix()}`,
        description: 'Updated description',
        reference: `ref-${uniqueSuffix()}`,
        status: 'disabled',
      });

      expect(result.data.name).toContain('Updated');
      expect(result.data.description).toBe('Updated description');
      expect(result.data.reference).toContain('ref-');
      expect(result.data.status).toBe('disabled');
    });

    it('updates ticket group layout', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const result = await client.events.ticketGroups.update(event.data.id, created.data.id, {
        layout: {
          type: 'grid',
          columns: 3,
          imageSize: 'large',
          showTicketPrice: true,
        },
      });

      expect(result.data.layout?.type).toBe('grid');
      expect(result.data.layout?.columns).toBe(3);
      expect(result.data.layout?.imageSize).toBe('large');
      expect(result.data.layout?.showTicketPrice).toBe(true);
    });

    it('updates ticket group preselection configuration', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const ticketTypeId = getDefaultTicketTypeId(event.data);
      const result = await client.events.ticketGroups.update(event.data.id, created.data.id, {
        ticketSelectionType: 'quantity',
        preselect: {
          enabled: true,
          ticketTypeId,
          quantity: 3,
        },
      });

      expect(result.data.ticketSelectionType).toBe('quantity');
      expect(result.data.preselect?.enabled).toBe(true);
      expect(result.data.preselect?.quantity).toBe(3);
    });

    it('updates availability behavior', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const triggerGroup = await createTriggerGroup(event.data.id);
      const result = await client.events.ticketGroups.update(event.data.id, created.data.id, {
        availabilityBehavior: 'after_ticket_ends_or_sold_out',
        triggerTicketGroupId: triggerGroup.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
    });

    it('clears nullable settings when null is provided', async () => {
      const event = await createEvent();
      const ticketTypeId = getDefaultTicketTypeId(event.data);
      const triggerGroup = await createTriggerGroup(event.data.id);
      const created = await createTicketGroup(event.data.id, {
        description: 'Needs clearing',
        layout: {
          type: 'accordion',
          collapse: true,
        },
        preselect: {
          enabled: true,
          ticketTypeId,
          quantity: 2,
        },
        capacity: 25,
        availabilityBehavior: 'after_ticket_sale_ends',
        saleStartOn: '2026-08-01T09:00:00Z',
        saleEndOn: '2026-08-15T09:00:00Z',
        triggerTicketGroupId: triggerGroup.id,
      });

      const result = await client.events.ticketGroups.update(event.data.id, created.data.id, {
        description: null,
        layout: null,
        preselect: null,
        capacity: null,
        saleStartOn: null,
        saleEndOn: null,
        availabilityBehavior: 'always_available',
      });

      expect(result.data.description).toBeNull();
      expect(result.data.layout).toBeNull();
      expect(result.data.preselect ?? null).toBeNull();
      expect(result.data.capacity).toBeNull();
      expect(result.data.saleStartOn).toBeNull();
      expect(result.data.saleEndOn).toBeNull();
      expect(result.data.triggerTicketGroupId ?? null).toBeNull();
      expect(result.data.availabilityBehavior).toBe('always_available');
    });

    it('fails for an unknown ticket group id', async () => {
      const event = await createEvent();

      await expect(
        client.events.ticketGroups.update(event.data.id, fakeObjectId('missinggroup'), {
          name: 'Missing group',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);

      await expect(
        client.events.ticketGroups.update('not-a-valid-id', created.data.id, {
          name: 'Bad event id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();

      await expect(
        client.events.ticketGroups.update(event.data.id, 'not-a-valid-id', {
          name: 'Bad group id',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('archives an existing ticket group', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const result = await client.events.ticketGroups.delete(event.data.id, created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('marks the ticket group as archived in the response', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      const result = await client.events.ticketGroups.delete(event.data.id, created.data.id);

      expect(result.data.status).toBe('archived');
    });

    it('returns the archived ticket group when deleting the same ticket group twice', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);
      await client.events.ticketGroups.delete(event.data.id, created.data.id);

      const result = await client.events.ticketGroups.delete(event.data.id, created.data.id);

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('fails for an unknown ticket group id', async () => {
      const event = await createEvent();

      await expect(
        client.events.ticketGroups.delete(event.data.id, fakeObjectId('missinggroup'))
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const created = await createTicketGroup(event.data.id);

      await expect(
        client.events.ticketGroups.delete('not-a-valid-id', created.data.id)
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();

      await expect(
        client.events.ticketGroups.delete(event.data.id, 'not-a-valid-id')
      ).rejects.toThrow(ValidationError);
    });
  });
});
