import { NodeOperationError, type IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { CheckoutPage } from '../nodes/CheckoutPage/CheckoutPage.node';
import { toNodeApiError } from '../nodes/CheckoutPage/transport';
import { CheckoutPageTrigger } from '../nodes/CheckoutPageTrigger/CheckoutPageTrigger.node';
import { executeContext, hookContext, locator, TEST_NODE } from './helpers';

const node = new CheckoutPage();
const FORBIDDEN = /\b(error|problem|failure|mistake)s?\b/i;

async function failure(params: IDataObject) {
  const { context, http } = executeContext(params, []);
  const error = await node.execute.call(context).catch((e) => e);
  expect(http).not.toHaveBeenCalled();
  expect(error).toBeInstanceOf(NodeOperationError);
  expect(error.message).not.toMatch(FORBIDDEN);
  expect(error.description).not.toMatch(FORBIDDEN);
  return error as NodeOperationError;
}

describe('input messages say what happened and how to fix it', () => {
  it.each([
    ['createdAfter', 'Created After'],
    ['createdBefore', 'Created Before'],
  ])('names the %s filter by its display name', async (key, label) => {
    const error = await failure({
      resource: 'payment',
      operation: 'getAll',
      returnAll: false,
      limit: 10,
      filters: { [key]: 'next tuesday' },
    });
    expect(error.message).toBe(`The value of '${label}' is not a date`);
    expect(error.description).toBe(
      'Pick a date with the date picker, or enter one such as 2026-10-01 or 2026-10-01T09:00:00. The value given was "next tuesday".'
    );
  });

  it("names 'Redeem By' on coupon create", async () => {
    const error = await failure({
      resource: 'coupon',
      operation: 'create',
      label: 'Spring',
      code: 'SPRING',
      discountType: 'percent',
      percentOff: 10,
      duration: 'once',
      additionalFields: { redeemBy: 'soon' },
    });
    expect(error.message).toBe("The value of 'Redeem By' is not a date");
  });

  it('names a plain ID field and says how to fill it', async () => {
    const error = await failure({
      resource: 'booking',
      operation: 'get',
      bookingId: ' ',
      options: {},
    });
    expect(error.message).toBe("'Booking ID' is empty");
    expect(error.description).toBe('Enter the ID of the booking, or map it from an earlier node.');
  });

  it.each([
    ['customer', 'customerId', 'Customer', 'a customer'],
    ['event', 'pageId', 'Event', 'an event'],
    ['checkoutPage', 'pageId', 'Checkout Page', 'a checkout page'],
    ['form', 'pageId', 'Form', 'a form'],
  ])('names the %s locator and says how to fill it', async (resource, name, label, thing) => {
    const error = await failure({ resource, operation: 'get', [name]: locator('') });
    expect(error.message).toBe(`'${label}' is empty`);
    expect(error.description).toBe(
      `Choose ${thing} from the list, or switch to 'By ID' and enter its ID.`
    );
  });

  it('explains a booking with no tickets', async () => {
    const error = await failure({
      resource: 'booking',
      operation: 'create',
      eventId: locator('ev_1'),
      tickets: {},
      fields: {},
      additionalFields: {},
    });
    expect(error.message).toBe('No tickets to book');
    expect(error.description).toBe("Add a row under 'Tickets' with a ticket type and a quantity.");
  });

  it('explains a booking with no field values', async () => {
    const error = await failure({
      resource: 'booking',
      operation: 'create',
      eventId: locator('ev_1'),
      tickets: { ticket: [{ ticketTypeId: 'tt_1', quantity: 1 }] },
      fields: {},
      additionalFields: {},
    });
    expect(error.message).toBe('No field values to book with');
    expect(error.description).toBe(
      "Add the event's email field under 'Fields'. The booking's customer is created from it."
    );
  });

  it('explains a customer update with nothing to change', async () => {
    const error = await failure({
      resource: 'customer',
      operation: 'update',
      customerId: locator('cus_1'),
      updateFields: {},
    });
    expect(error.message).toBe('No fields to update');
    expect(error.description).toBe("Add at least one field under 'Update Fields'.");
  });

  it('explains an unavailable resource or operation', async () => {
    const resource = await failure({ resource: 'invoice', operation: 'get' });
    expect(resource.message).toBe("The resource 'invoice' is not available");
    expect(resource.description).toBe("Choose a resource from the 'Resource' list.");

    const operation = await failure({ resource: 'payment', operation: 'delete' });
    expect(operation.message).toBe("The operation 'delete' is not available for this resource");
    expect(operation.description).toBe("Choose an operation from the 'Operation' list.");
  });
});

describe('API messages', () => {
  it('explains a request that got no answer', () => {
    const error = toNodeApiError(TEST_NODE, {});
    expect(error.message).toBe('Checkout Page did not answer the request');
    expect(error.description).toBe(
      "Check your connection and the 'Base URL' in the Checkout Page credential, then try again."
    );
  });

  it("passes the API's message through without adding a description", () => {
    const error = toNodeApiError(TEST_NODE, {
      response: { status: 404, data: { message: 'Booking not found' } },
    });
    expect(error.message).toBe('Booking not found');
    expect(error.description).toBeFalsy();
  });
});

describe('trigger messages', () => {
  it('explains a trigger with no events', async () => {
    const { context, http } = hookContext({ events: [] }, []);
    const error = await new CheckoutPageTrigger().webhookMethods.default.create
      .call(context)
      .catch((e) => e);
    expect(http).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('No events chosen');
    expect(error.description).toBe("Choose at least one event in 'Events'.");
  });

  it('explains a webhook that came back without an id', async () => {
    const { context } = hookContext({ events: ['booking.created'] }, [{ data: {} }]);
    const error = await new CheckoutPageTrigger().webhookMethods.default.create
      .call(context)
      .catch((e) => e);
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('Checkout Page did not return the new webhook');
    expect(error.description).toBe('Deactivate the workflow and activate it again to retry.');
  });
});
