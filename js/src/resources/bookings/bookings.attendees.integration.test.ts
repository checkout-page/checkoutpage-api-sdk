import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, ValidationError } from '../../index';
import type { CreateBookingParams, CreateEventPageParams } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

type AttendeeDetails = NonNullable<CreateEventPageParams['eventDetails']>['attendeeDetails'];
type AttendeeInput = NonNullable<CreateBookingParams['attendees']>[number];

describe('BookingResource attendee integration tests', () => {
  let client: CheckoutPageClient;
  const eventIds: string[] = [];

  const createEvent = async (attendeeDetails: AttendeeDetails) => {
    const suffix = uniqueSuffix();
    const { data: event } = await client.events.create({
      name: `SDK Attendees ${suffix}`,
      title: `SDK Attendees ${suffix}`,
      eventDetails: {
        type: 'virtual',
        currency: 'usd',
        startDate: '2027-03-01T09:00:00Z',
        endDate: '2027-03-01T17:00:00Z',
        timezone: 'UTC',
        attendeeDetails,
      },
      fields: [
        { label: 'Name', element: 'text', type: 'name', required: true },
        { label: 'Email address', element: 'email', type: 'email', required: true },
      ],
      ticketGroups: [
        { name: 'General Admission', ticketTypes: [{ name: 'GA', pricing: 'paid', price: 2500 }] },
      ],
    });
    eventIds.push(event.id);

    const ticketTypeId = event.ticketGroups?.[0]?.ticketTypes?.[0]?.id;
    if (!ticketTypeId) throw new Error('Provisioned event has no ticket type');

    const { data: fields } = await client.events.fields.list(event.id);
    const idOf = (label: string) => {
      const id = fields.find((field) => field.label === label)?.id;
      if (!id) throw new Error(`Provisioned event has no "${label}" field`);
      return id;
    };

    return { event, ticketTypeId, nameFieldId: idOf('Name'), emailFieldId: idOf('Email address') };
  };

  type ProvisionedEvent = Awaited<ReturnType<typeof createEvent>>;

  const book = (
    { event, ticketTypeId, nameFieldId, emailFieldId }: ProvisionedEvent,
    quantity: number,
    attendees: Omit<AttendeeInput, 'ticketTypeId'>[]
  ) =>
    client.bookings.create({
      eventId: event.id,
      tickets: { [ticketTypeId]: quantity },
      fields: [
        { fieldId: nameFieldId, value: 'Pat Booker' },
        { fieldId: emailFieldId, value: `sdk-booker-${uniqueSuffix()}@example.com` },
      ],
      attendees: attendees.map((attendee) => ({ ticketTypeId, ...attendee })),
      complimentary: true,
    });

  const ticketsOf = async (bookingId: string) => {
    const { data } = await client.tickets.list({ bookingId });
    return data;
  };

  let collecting: ProvisionedEvent;

  beforeAll(async () => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    collecting = await createEvent({ enabled: true });
  });

  afterAll(async () => {
    for (const eventId of eventIds) {
      try {
        await client.events.delete(eventId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
  });

  it('creates an event that collects attendee details, with no questions besides name and email', async () => {
    expect(collecting.event.eventDetails?.attendeeDetails?.enabled).toBe(true);

    const { data: event } = await client.events.get(collecting.event.id);
    expect(event.eventDetails?.attendeeDetails?.enabled).toBe(true);
    expect(event.attendeeQuestions).toEqual([]);
  });

  it(
    "keeps each attendee's name and email on the booking, one attendee per ticket",
    { timeout: 60_000 },
    async () => {
      const { data: created } = await book(collecting, 2, [
        { name: 'Ann Lee', email: 'ann@example.com' },
        { name: 'Bo Chen', email: 'bo@example.com' },
      ]);

      const { data: booking } = await client.bookings.get(created.id);
      expect(booking.attendeeStatus).toBe('complete');
      expect(
        booking.attendees?.map(({ position, name, email, ticketTypeId }) => ({
          position,
          name,
          email,
          ticketTypeId,
        }))
      ).toEqual([
        {
          position: 1,
          name: 'Ann Lee',
          email: 'ann@example.com',
          ticketTypeId: collecting.ticketTypeId,
        },
        {
          position: 2,
          name: 'Bo Chen',
          email: 'bo@example.com',
          ticketTypeId: collecting.ticketTypeId,
        },
      ]);

      const tickets = await ticketsOf(created.id);
      expect(new Set(booking.attendees?.map((attendee) => attendee.ticketId))).toEqual(
        new Set(tickets.map((ticket) => ticket.id))
      );
    }
  );

  it(
    "puts a ticket's attendee name and email in attendeeName and attendeeEmail, with no attendee object",
    { timeout: 60_000 },
    async () => {
      const { data: booking } = await book(collecting, 2, [
        { name: 'Ann Lee', email: 'ann@example.com' },
        { name: 'Bo Chen', email: 'bo@example.com' },
      ]);

      const tickets = await ticketsOf(booking.id);
      expect(
        tickets.map(({ attendeeName, attendeeEmail }) => [attendeeName, attendeeEmail]).sort()
      ).toEqual([
        ['Ann Lee', 'ann@example.com'],
        ['Bo Chen', 'bo@example.com'],
      ]);
      for (const ticket of tickets) expect(ticket.attendee).toBeUndefined();
    }
  );

  it('keeps the booker on a ticket that has no attendee yet', { timeout: 60_000 }, async () => {
    const { data: created } = await book(collecting, 2, [
      { name: 'Ann Lee', email: 'ann@example.com' },
    ]);

    const { data: booking } = await client.bookings.get(created.id);
    expect(booking.attendeeStatus).toBe('missing');

    const tickets = await ticketsOf(created.id);
    expect(tickets.map((ticket) => ticket.attendeeName).sort()).toEqual(['Ann Lee', 'Pat Booker']);
  });

  it(
    'gives a flagged attendee a ticket attendee object without their name or email',
    { timeout: 90_000 },
    async () => {
      const flagging = await createEvent({ enabled: true, emailDomains: 'flag' });
      const { data: created } = await book(flagging, 1, [
        { name: 'Cy Diaz', email: `sdk-attendee-${uniqueSuffix()}@gmail.com` },
      ]);

      const { data: booking } = await client.bookings.get(created.id);
      expect(booking.attendeeStatus).toBe('flagged');
      const attendee = booking.attendees?.[0];
      expect(attendee).toMatchObject({ name: 'Cy Diaz', flagged: true });

      const [ticket] = await ticketsOf(created.id);
      expect(ticket?.attendee).toEqual({ flagged: true });
      expect(ticket?.attendeeName).toBe('Cy Diaz');
      expect(ticket?.attendeeEmail).toBe(attendee?.email);
    }
  );

  it("refuses an attendee answer to one of the booking's own fields", async () => {
    await expect(
      book(collecting, 1, [
        {
          email: 'ann@example.com',
          answers: [{ fieldId: collecting.nameFieldId, value: 'Ann Lee' }],
        },
      ])
    ).rejects.toThrow(ValidationError);
  });
});
