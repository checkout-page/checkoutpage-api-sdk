import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, ValidationError } from '../../index';
import type { CreateBookingParams } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

const SOURCE_LABEL = 'How did you hear about us?';
type BookingFieldInput = CreateBookingParams['fields'][number];

const OPTIONS = [
  { label: 'Google', value: 'google' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'A friend' },
];

describe('BookingResource multi-select integration tests', () => {
  let client: CheckoutPageClient;
  let eventId: string;
  let ticketTypeId: string;
  let emailFieldId: string;
  let sourceFieldId: string;
  let notesFieldId: string;

  const email = () => `sdk-multi-select-${uniqueSuffix()}@example.com`;

  const book = (sourceInput: Omit<BookingFieldInput, 'fieldId'>) =>
    client.bookings.create({
      eventId,
      tickets: { [ticketTypeId]: 1 },
      fields: [
        { fieldId: emailFieldId, value: email() },
        { fieldId: sourceFieldId, ...sourceInput },
      ],
      complimentary: true,
    });

  beforeAll(async () => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    const suffix = uniqueSuffix();
    const response = await client.events.create({
      name: `SDK Multi-select Booking ${suffix}`,
      title: `SDK Multi-select Booking ${suffix}`,
      eventDetails: {
        type: 'virtual',
        currency: 'usd',
        startDate: '2027-03-01T09:00:00Z',
        endDate: '2027-03-01T17:00:00Z',
        timezone: 'UTC',
      },
      fields: [
        { label: 'Email address', element: 'email', type: 'email', required: true },
        {
          label: SOURCE_LABEL,
          element: 'multi-select',
          options: OPTIONS,
          maxValue: { enabled: true, value: '2' },
        },
        { label: 'Notes', element: 'text' },
      ],
      ticketGroups: [
        { name: 'General Admission', ticketTypes: [{ name: 'GA', pricing: 'paid', price: 2500 }] },
      ],
    });

    eventId = response.data.id;
    const ticketType = response.data.ticketGroups?.[0]?.ticketTypes?.[0];
    if (!ticketType?.id) throw new Error('Provisioned event has no ticket type');
    ticketTypeId = ticketType.id;

    const { data: fields } = await client.events.fields.list(eventId);
    const idOf = (label: string) => {
      const id = fields.find((field) => field.label === label)?.id;
      if (!id) throw new Error(`Provisioned event has no "${label}" field`);
      return id;
    };
    emailFieldId = idOf('Email address');
    sourceFieldId = idOf(SOURCE_LABEL);
    notesFieldId = idOf('Notes');
  });

  afterAll(async () => {
    if (!eventId) return;
    try {
      await client.events.delete(eventId);
    } catch {
      // Best-effort cleanup for integration tests.
    }
  });

  it(
    'books a multi-select through values, stored in the option order',
    { timeout: 60_000 },
    async () => {
      const { data: booking } = await book({ values: ['Facebook', 'Google'] });

      const row = booking.fields?.find((field) => field.fieldId === sourceFieldId);
      expect(row?.element).toBe('multi-select');
      expect(row?.value).toBe('Google, Facebook');
      expect(row?.values).toEqual(['Google', 'Facebook']);
      expect(row?.meta ?? {}).not.toHaveProperty('selectedOptionValues');

      const fetched = await client.bookings.get(booking.id);
      const fetchedRow = fetched.data.fields?.find((field) => field.fieldId === sourceFieldId);
      expect(fetchedRow?.value).toBe('Google, Facebook');
      expect(fetchedRow?.values).toEqual(['Google', 'Facebook']);
    }
  );

  it('takes an answer row read from the API straight back', { timeout: 120_000 }, async () => {
    const { data: first } = await book({ values: ['A friend', 'Google'] });
    const { data: fetched } = await client.bookings.get(first.id);
    const row = fetched.fields?.find((field) => field.fieldId === sourceFieldId);
    if (!row?.values) throw new Error('The booking read back has no multi-select values');

    const { data: second } = await book({ value: row.value, values: row.values });

    const posted = second.fields?.find((field) => field.fieldId === sourceFieldId);
    expect(posted?.value).toBe('Google, A friend');
    expect(posted?.values).toEqual(['Google', 'A friend']);
  });

  it('rebuilds value from values when the two disagree', { timeout: 60_000 }, async () => {
    const { data: booking } = await book({ value: 'Something else', values: ['Facebook'] });

    const row = booking.fields?.find((field) => field.fieldId === sourceFieldId);
    expect(row?.value).toBe('Facebook');
    expect(row?.values).toEqual(['Facebook']);
  });

  it('stores no answer for an optional multi-select left empty', { timeout: 60_000 }, async () => {
    const { data: booking } = await book({ values: [] });

    expect(booking.fields?.find((field) => field.fieldId === sourceFieldId)).toBeUndefined();
  });

  it('refuses a multi-select answered in value', async () => {
    await expect(book({ value: 'Google' })).rejects.toThrow(ValidationError);
    await expect(book({ value: 'Google' })).rejects.toThrow(
      /is a multi-select; send its option labels as a list in "values"/
    );
  });

  it('refuses values on a field that is not a multi-select', async () => {
    const attempt = client.bookings.create({
      eventId,
      tickets: { [ticketTypeId]: 1 },
      fields: [
        { fieldId: emailFieldId, value: email() },
        { fieldId: notesFieldId, values: ['Hello'] },
      ],
      complimentary: true,
    });

    await expect(attempt).rejects.toThrow(/is not a multi-select; send a single "value"/);
  });

  it('refuses more options than the field allows', async () => {
    await expect(book({ values: ['Google', 'Facebook', 'A friend'] })).rejects.toThrow(
      /takes at most 2 options/
    );
  });

  it('refuses a label that is not one of the options', async () => {
    await expect(book({ values: ['Google', 'Bing'] })).rejects.toThrow(/has no option "Bing"/);
  });
});
