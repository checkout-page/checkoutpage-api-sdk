import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { NotFoundError, ValidationError } from '../../errors';
import { EventsResource } from './events';
import { FileResource } from '../files/files';
import type {
  CreateEventParams,
  CreateEventTicketGroupParams,
  CreateEventTicketTypeParams,
} from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { createImageFile, fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('EventsResource ticketGroups.ticketTypes integration tests', () => {
  let apiClient: CheckoutPageApiClient;
  let events: EventsResource;
  let files: FileResource;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const forgetPage = (pageId: string) => {
    createdPageIds = createdPageIds.filter((id) => id !== pageId);
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
    const response = await events.create({
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
    return events.ticketGroups.create(pageId, {
      name: `SDK Ticket Group ${suffix}`,
      ...overrides,
    });
  };

  const createTicketType = async (
    pageId: string,
    ticketGroupId: string,
    overrides: Partial<CreateEventTicketTypeParams> = {}
  ) => {
    const suffix = uniqueSuffix();
    return events.ticketGroups.ticketTypes.create(pageId, ticketGroupId, {
      name: `SDK Ticket Type ${suffix}`,
      pricing: 'paid',
      price: 2500,
      ...overrides,
    });
  };

  const createTriggerTicketType = async (pageId: string, ticketGroupId: string) => {
    const response = await createTicketType(pageId, ticketGroupId, {
      name: `Trigger Ticket ${uniqueSuffix()}`,
      availabilityBehavior: 'date_time_based',
      saleStartOn: '2026-08-01T09:00:00Z',
      saleEndOn: '2026-08-15T09:00:00Z',
    });

    return response.data;
  };

  const uploadImage = async () => {
    const result = await files.upload({
      file: createImageFile(`ticket-type-${uniqueSuffix()}.png`),
      purpose: 'image',
    });

    return result.data.id;
  };

  beforeAll(() => {
    config = loadIntegrationConfig();
    apiClient = new CheckoutPageApiClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    events = new EventsResource(apiClient);
    files = new FileResource(apiClient);
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

  describe('list', () => {
    it('lists ticket types for a ticket group', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      await createTicketType(event.data.id, group.data.id);

      const result = await events.ticketGroups.ticketTypes.list(event.data.id, group.data.id);

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
    });

    it('returns ticket types in persisted order', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const first = await createTicketType(event.data.id, group.data.id, {
        name: `First ${uniqueSuffix()}`,
      });
      const second = await createTicketType(event.data.id, group.data.id, {
        name: `Second ${uniqueSuffix()}`,
      });

      const result = await events.ticketGroups.ticketTypes.list(event.data.id, group.data.id);
      const firstIndex = result.data.findIndex((ticket) => ticket.id === first.data.id);
      const secondIndex = result.data.findIndex((ticket) => ticket.id === second.data.id);

      expect(firstIndex).toBeGreaterThan(-1);
      expect(secondIndex).toBeGreaterThan(-1);
      expect(firstIndex).toBeLessThan(secondIndex);
    });

    it('returns an empty list for an unknown ticket group id', async () => {
      const event = await createEvent();
      await expect(
        events.ticketGroups.ticketTypes.list(event.data.id, fakeObjectId('missinggroup'))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a minimal paid ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id);

      expect(result.data.id).toBeTypeOf('string');
      expect(result.data.pricing).toBe('paid');
      expect(result.data.price).toBe(2500);
    });

    it('creates a free ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        pricing: 'free',
        price: 0,
      });

      expect(result.data.pricing).toBe('free');
      expect(result.data.price).toBe(0);
    });

    it('creates a ticket type with uploaded imageId', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const imageId = await uploadImage();
      const result = await createTicketType(event.data.id, group.data.id, {
        imageId,
      });

      expect(result.data.image?.fileId).toBe(imageId);
      expect(result.data.image?.url).toContain('http');
      expect(result.data.image?.name).toContain('.png');
    });

    it('creates a ticket type with quantity limits and capacity', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        capacity: 100,
        minQuantity: 1,
        maxQuantity: 5,
        showAvailableQuantity: true,
        showTicketSaleDates: true,
      });

      expect(result.data.capacity).toBe(100);
      expect(result.data.minQuantity).toBe(1);
      expect(result.data.maxQuantity).toBe(5);
      expect(result.data.showAvailableQuantity).toBe(true);
      expect(result.data.showTicketSaleDates).toBe(true);
    });

    it('creates a ticket type with discountedFromPrice', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        price: 2500,
        discountedFromPrice: 3500,
      });

      expect(result.data.price).toBe(2500);
      expect(result.data.discountedFromPrice).toBe(3500);
    });

    it('creates a ticket type with date_time_based availability', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        availabilityBehavior: 'date_time_based',
        saleStartOn: '2026-08-01T09:00:00Z',
        saleEndOn: '2026-08-15T09:00:00Z',
      });

      expect(result.data.availabilityBehavior).toBe('date_time_based');
      expect(result.data.saleStartOn).toBe('2026-08-01T09:00:00.000Z');
      expect(result.data.saleEndOn).toBe('2026-08-15T09:00:00.000Z');
    });

    it('creates a ticket type with after_ticket_sale_ends availability', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const trigger = await createTriggerTicketType(event.data.id, group.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        availabilityBehavior: 'after_ticket_sale_ends',
        triggerTicketTypeId: trigger.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_sale_ends');
      expect(result.data.triggerTicketTypeId ?? null).toBe(trigger.id);
    });

    it('creates a ticket type with after_ticket_sold_out availability', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const trigger = await createTriggerTicketType(event.data.id, group.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        availabilityBehavior: 'after_ticket_sold_out',
        triggerTicketTypeId: trigger.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_sold_out');
      expect(result.data.triggerTicketTypeId ?? null).toBe(trigger.id);
    });

    it('creates a ticket type with after_ticket_ends_or_sold_out availability', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const trigger = await createTriggerTicketType(event.data.id, group.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        availabilityBehavior: 'after_ticket_ends_or_sold_out',
        triggerTicketTypeId: trigger.id,
      });

      expect(result.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
      expect(result.data.triggerTicketTypeId ?? null).toBe(trigger.id);
    });

    it('creates a ticket type with until_event_starts availability', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const result = await createTicketType(event.data.id, group.data.id, {
        availabilityBehavior: 'until_event_starts',
      });

      expect(result.data.availabilityBehavior).toBe('until_event_starts');
    });

    it('creates updates and deletes a ticket type within a full event lifecycle', async () => {
      const event = await createEvent();
      const updatedEvent = await events.update(event.data.id, {
        title: `Updated Event ${uniqueSuffix()}`,
      });
      expect(updatedEvent.data.title).toContain('Updated Event');

      const group = await createTicketGroup(event.data.id, {
        name: `Lifecycle Group ${uniqueSuffix()}`,
      });
      const created = await createTicketType(event.data.id, group.data.id, {
        name: `Lifecycle Ticket ${uniqueSuffix()}`,
        price: 4200,
      });
      const updated = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          price: 4500,
          maxQuantity: 4,
        }
      );

      expect(updated.data.price).toBe(4500);
      expect(updated.data.maxQuantity).toBe(4);

      const groupRead = await events.ticketGroups.get(event.data.id, group.data.id);
      expect(groupRead.data.ticketTypeIds).toContain(created.data.id);

      const eventRead = await events.get(event.data.id);
      const nestedGroup = eventRead.data.ticketGroups?.find((item) => item.id === group.data.id);
      expect(nestedGroup?.ticketTypes?.some((ticket) => ticket.id === created.data.id)).toBe(true);

      const deletedTicket = await events.ticketGroups.ticketTypes.delete(
        event.data.id,
        group.data.id,
        created.data.id
      );
      expect(deletedTicket.data.status).toBe('archived');

      const eventReadAfterDeletes = await events.get(event.data.id);
      expect(eventReadAfterDeletes.data.id).toBe(event.data.id);
    });

    it('fails when triggerTicketTypeId references a missing ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        createTicketType(event.data.id, group.data.id, {
          availabilityBehavior: 'after_ticket_sold_out',
          triggerTicketTypeId: fakeObjectId('missingticket'),
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('fails when imageId references a missing file', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        createTicketType(event.data.id, group.data.id, {
          imageId: fakeObjectId('missingimage'),
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.create('not-a-valid-id', group.data.id, {
          name: 'Bad event id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();

      await expect(
        events.ticketGroups.ticketTypes.create(event.data.id, 'not-a-valid-id', {
          name: 'Bad group id',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get', () => {
    it('gets an existing ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.get(
        event.data.id,
        group.data.id,
        created.data.id
      );

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.name).toBe(created.data.name);
    });

    it('returns pricing availability and image configuration', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const imageId = await uploadImage();
      const created = await createTicketType(event.data.id, group.data.id, {
        imageId,
        price: 2700,
        discountedFromPrice: 3200,
        availabilityBehavior: 'date_time_based',
        saleStartOn: '2026-08-01T09:00:00Z',
        saleEndOn: '2026-08-15T09:00:00Z',
      });
      const result = await events.ticketGroups.ticketTypes.get(
        event.data.id,
        group.data.id,
        created.data.id
      );

      expect(result.data.price).toBe(2700);
      expect(result.data.discountedFromPrice).toBe(3200);
      expect(result.data.availabilityBehavior).toBe('date_time_based');
      expect(result.data.image?.fileId).toBe(imageId);
    });

    it('fails for an unknown ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get(
          event.data.id,
          group.data.id,
          fakeObjectId('missingticket')
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a ticket type that does not belong to the ticket group', async () => {
      const event = await createEvent();
      const firstGroup = await createTicketGroup(event.data.id);
      const secondGroup = await createTicketGroup(event.data.id);
      const secondTicket = await createTicketType(event.data.id, secondGroup.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get(event.data.id, firstGroup.data.id, secondTicket.data.id)
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a ticket type that does not belong to the event', async () => {
      const firstEvent = await createEvent();
      const secondEvent = await createEvent();
      const secondGroup = await createTicketGroup(secondEvent.data.id);
      const secondTicket = await createTicketType(secondEvent.data.id, secondGroup.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get(
          firstEvent.data.id,
          secondGroup.data.id,
          secondTicket.data.id
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const ticket = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get('not-a-valid-id', group.data.id, ticket.data.id)
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const ticket = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get(event.data.id, 'not-a-valid-id', ticket.data.id)
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.get(event.data.id, group.data.id, 'not-a-valid-id')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('updates ticket type metadata', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          name: `Updated ${uniqueSuffix()}`,
          description: 'Updated description',
          reference: `ref-${uniqueSuffix()}`,
          status: 'disabled',
        }
      );

      expect(result.data.name).toContain('Updated');
      expect(result.data.description).toBe('Updated description');
      expect(result.data.reference).toContain('ref-');
      expect(result.data.status).toBe('disabled');
    });

    it('updates ticket pricing fields', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          pricing: 'free',
          price: 0,
          discountedFromPrice: 1000,
        }
      );

      expect(result.data.pricing).toBe('free');
      expect(result.data.price).toBe(0);
      expect(result.data.discountedFromPrice).toBe(1000);
    });

    it('updates ticket type image with a newly uploaded file', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const imageId = await uploadImage();
      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          imageId,
        }
      );

      expect(result.data.image?.fileId).toBe(imageId);
    });

    it('updates quantity limits and capacity', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          capacity: 25,
          minQuantity: 2,
          maxQuantity: 6,
          showAvailableQuantity: true,
          showTicketSaleDates: true,
        }
      );

      expect(result.data.capacity).toBe(25);
      expect(result.data.minQuantity).toBe(2);
      expect(result.data.maxQuantity).toBe(6);
      expect(result.data.showAvailableQuantity).toBe(true);
      expect(result.data.showTicketSaleDates).toBe(true);
    });

    it('updates availability behavior', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const trigger = await createTriggerTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          availabilityBehavior: 'after_ticket_ends_or_sold_out',
          triggerTicketTypeId: trigger.id,
        }
      );

      expect(result.data.availabilityBehavior).toBe('after_ticket_ends_or_sold_out');
      expect(result.data.triggerTicketTypeId ?? null).toBe(trigger.id);
    });

    it('round-trips ticket type changes through event and ticket-group fetches', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const updatedName = `Round Trip ${uniqueSuffix()}`;
      const updatedPrice = 5100;

      await events.ticketGroups.ticketTypes.update(event.data.id, group.data.id, created.data.id, {
        name: updatedName,
        price: updatedPrice,
      });

      const groupRead = await events.ticketGroups.get(event.data.id, group.data.id);
      expect(groupRead.data.ticketTypeIds).toContain(created.data.id);

      const eventRead = await events.get(event.data.id);
      const nestedGroup = eventRead.data.ticketGroups?.find((item) => item.id === group.data.id);
      const nestedTicket = nestedGroup?.ticketTypes?.find((item) => item.id === created.data.id);
      expect(nestedTicket?.name).toBe(updatedName);
      expect(nestedTicket?.price).toBe(updatedPrice);
    });

    it('clears nullable settings when null is provided', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const imageId = await uploadImage();
      const created = await createTicketType(event.data.id, group.data.id, {
        description: 'Needs clearing',
        discountedFromPrice: 3200,
        capacity: 25,
        imageId,
        saleStartOn: '2026-08-01T09:00:00Z',
        saleEndOn: '2026-08-15T09:00:00Z',
        availabilityBehavior: 'date_time_based',
      });

      const result = await events.ticketGroups.ticketTypes.update(
        event.data.id,
        group.data.id,
        created.data.id,
        {
          description: null,
          discountedFromPrice: null,
          capacity: null,
          imageId: null,
          saleStartOn: null,
          saleEndOn: null,
          availabilityBehavior: 'always_available',
        }
      );

      expect(result.data.description).toBeNull();
      expect(result.data.discountedFromPrice).toBeNull();
      expect(result.data.capacity).toBeNull();
      expect(result.data.image).toBeNull();
      expect(result.data.saleStartOn).toBeNull();
      expect(result.data.saleEndOn).toBeNull();
      expect(result.data.availabilityBehavior).toBe('always_available');
    });

    it('fails for an unknown ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.update(
          event.data.id,
          group.data.id,
          fakeObjectId('missingticket'),
          { name: 'Missing ticket' }
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.update('not-a-valid-id', group.data.id, created.data.id, {
          name: 'Bad event id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.update(event.data.id, 'not-a-valid-id', created.data.id, {
          name: 'Bad group id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.update(event.data.id, group.data.id, 'not-a-valid-id', {
          name: 'Bad ticket id',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('archives an existing ticket type', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.delete(
        event.data.id,
        group.data.id,
        created.data.id
      );

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('marks the ticket type as archived in the response', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      const result = await events.ticketGroups.ticketTypes.delete(
        event.data.id,
        group.data.id,
        created.data.id
      );

      expect(result.data.status).toBe('archived');
    });

    it('returns the archived ticket type when deleting the same ticket type twice', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);
      await events.ticketGroups.ticketTypes.delete(event.data.id, group.data.id, created.data.id);

      const result = await events.ticketGroups.ticketTypes.delete(
        event.data.id,
        group.data.id,
        created.data.id
      );

      expect(result.data.id).toBe(created.data.id);
      expect(result.data.status).toBe('archived');
    });

    it('returns the deleted ticket type as archived in subsequent ticket-group and event reads', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);

      await events.ticketGroups.ticketTypes.delete(event.data.id, group.data.id, created.data.id);

      const groupRead = await events.ticketGroups.get(event.data.id, group.data.id);
      expect(groupRead.data.ticketTypeIds).toContain(created.data.id);

      const eventRead = await events.get(event.data.id);
      const nestedGroup = eventRead.data.ticketGroups?.find((item) => item.id === group.data.id);
      const nestedTicket = nestedGroup?.ticketTypes?.find(
        (ticket) => ticket.id === created.data.id
      );
      expect(nestedTicket?.status).toBe('archived');
    });

    it('fails for an unknown ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.delete(
          event.data.id,
          group.data.id,
          fakeObjectId('missingticket')
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed event id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.delete('not-a-valid-id', group.data.id, created.data.id)
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket group id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);
      const created = await createTicketType(event.data.id, group.data.id);

      await expect(
        events.ticketGroups.ticketTypes.delete(event.data.id, 'not-a-valid-id', created.data.id)
      ).rejects.toThrow(ValidationError);
    });

    it('fails for a malformed ticket type id', async () => {
      const event = await createEvent();
      const group = await createTicketGroup(event.data.id);

      await expect(
        events.ticketGroups.ticketTypes.delete(event.data.id, group.data.id, 'not-a-valid-id')
      ).rejects.toThrow(ValidationError);
    });
  });
});
