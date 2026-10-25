import {
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHttpRequestMethods,
} from 'n8n-workflow';
import { toUtcIso } from './dates';

export interface PlannedRequest {
  method: IHttpRequestMethods;
  path: string;
  qs?: IDataObject;
  body?: IDataObject;
  list?: { returnAll: boolean; limit: number };
  simplify?: boolean;
}

const COLLECTION_PATHS: Record<string, string> = {
  booking: '/v1/bookings/',
  payment: '/v1/payments/',
  customer: '/v1/customers/',
  coupon: '/v1/coupons/',
  subscription: '/v1/subscriptions/',
  event: '/v1/events/',
  checkoutPage: '/v1/checkout-pages/',
  form: '/v1/forms/',
};

const ID_PARAMETERS: Record<string, string> = {
  booking: 'bookingId',
  payment: 'paymentId',
  customer: 'customerId',
  subscription: 'subscriptionId',
  event: 'pageId',
  checkoutPage: 'pageId',
  form: 'pageId',
};

const RESOURCES_WITH_LIVEMODE_ON_GET = new Set(['booking', 'payment', 'subscription']);

/** The API takes booleans in the query string as the strings "true" and "false". */
export function toQuery(values: IDataObject): IDataObject {
  const qs: IDataObject = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === undefined || value === null) continue;
    qs[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return qs;
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((v) => v.trim())
      .filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function compact(values: IDataObject): IDataObject {
  const result: IDataObject = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === undefined || value === null) continue;
    result[key] = value;
  }
  return result;
}

const DATE_KEYS = ['createdAfter', 'createdBefore', 'redeemBy'];

function withUtcDates(ctx: IExecuteFunctions, values: IDataObject, i: number): IDataObject {
  const result = { ...values };
  for (const key of DATE_KEYS) {
    const value = result[key];
    if (value === '' || value === undefined || value === null) continue;
    const iso = toUtcIso(value, ctx.getTimezone());
    if (!iso) {
      throw new NodeOperationError(ctx.getNode(), `${key} is not a valid date: ${String(value)}`, {
        itemIndex: i,
      });
    }
    result[key] = iso;
  }
  return result;
}

function itemPath(ctx: IExecuteFunctions, resource: string, i: number): string {
  const id = String(ctx.getNodeParameter(ID_PARAMETERS[resource], i) ?? '').trim();
  if (!id) {
    throw new NodeOperationError(ctx.getNode(), 'An ID is required', { itemIndex: i });
  }
  return `${COLLECTION_PATHS[resource]}${encodeURIComponent(id)}`;
}

function bookingCreateBody(ctx: IExecuteFunctions, i: number): IDataObject {
  const eventId = ctx.getNodeParameter('eventId', i) as string;
  const ticketRows =
    ((ctx.getNodeParameter('tickets', i, {}) as IDataObject).ticket as IDataObject[]) ?? [];
  const fieldRows =
    ((ctx.getNodeParameter('fields', i, {}) as IDataObject).field as IDataObject[]) ?? [];
  const additional = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

  const tickets: IDataObject = {};
  for (const row of ticketRows) {
    const id = String(row.ticketTypeId ?? '').trim();
    if (!id) continue;
    tickets[id] = ((tickets[id] as number) ?? 0) + Number(row.quantity ?? 1);
  }
  if (!Object.keys(tickets).length) {
    throw new NodeOperationError(ctx.getNode(), 'Add at least one ticket to book', {
      itemIndex: i,
    });
  }

  const fields = fieldRows
    .filter((row) => String(row.fieldId ?? '').trim())
    .map((row) => {
      const value = row.value === undefined || row.value === null ? '' : String(row.value);
      return { fieldId: String(row.fieldId).trim(), value };
    });

  if (!fields.length) {
    throw new NodeOperationError(ctx.getNode(), 'Add at least the email field', {
      description: "Booking needs a value for the event's email field, so add it under Fields.",
      itemIndex: i,
    });
  }

  const body: IDataObject = { eventId, tickets, fields };

  if (additional.complimentary === true) body.complimentary = true;
  if (additional.manualType) body.paymentOption = { manualType: additional.manualType };
  if (additional.couponId) body.couponId = additional.couponId;

  const pwywRows =
    ((additional.ticketPwywAmounts as IDataObject | undefined)?.amount as IDataObject[]) ?? [];
  if (pwywRows.length) {
    const amounts: IDataObject = {};
    for (const row of pwywRows) {
      const id = String(row.ticketTypeId ?? '').trim();
      if (id) amounts[id] = Number(row.amount ?? 0);
    }
    if (Object.keys(amounts).length) body.ticketPwywAmounts = amounts;
  }

  return body;
}

function couponCreateBody(ctx: IExecuteFunctions, i: number): IDataObject {
  const discountType = ctx.getNodeParameter('discountType', i) as string;
  const duration = ctx.getNodeParameter('duration', i) as string;
  const additional = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;

  const body: IDataObject = {
    label: ctx.getNodeParameter('label', i),
    code: ctx.getNodeParameter('code', i),
    duration,
  };
  if (discountType === 'amount') {
    body.amountOff = ctx.getNodeParameter('amountOff', i);
    body.currency = ctx.getNodeParameter('currency', i);
  } else {
    body.percentOff = ctx.getNodeParameter('percentOff', i);
  }
  if (duration === 'repeating') {
    body.durationInMonths = ctx.getNodeParameter('durationInMonths', i);
  }

  const { pageIds, ticketTypeIds, ...rest } = withUtcDates(ctx, additional, i);
  Object.assign(body, compact(rest));
  const pages = splitList(pageIds);
  if (pages.length) body.pageIds = pages;
  const ticketTypes = splitList(ticketTypeIds);
  if (ticketTypes.length) body.ticketTypeIds = ticketTypes;

  return body;
}

function addressFrom(value: unknown): IDataObject | undefined {
  const address = (value as IDataObject | undefined)?.address as IDataObject | undefined;
  if (!address) return undefined;
  const result = compact(address);
  return Object.keys(result).length ? result : undefined;
}

function customerUpdateBody(ctx: IExecuteFunctions, i: number): IDataObject {
  const { address, shippingAddress, ...rest } = ctx.getNodeParameter(
    'updateFields',
    i,
    {}
  ) as IDataObject;
  const body = compact(rest);
  const billing = addressFrom(address);
  if (billing) body.address = billing;
  const shipping = addressFrom(shippingAddress);
  if (shipping) body.shipping = { address: shipping };
  if (!Object.keys(body).length) {
    throw new NodeOperationError(ctx.getNode(), 'Add at least one field to update', {
      itemIndex: i,
    });
  }
  return body;
}

export function planRequest(
  ctx: IExecuteFunctions,
  resource: string,
  operation: string,
  i: number
): PlannedRequest {
  const collection = COLLECTION_PATHS[resource];
  if (!collection) {
    throw new NodeOperationError(ctx.getNode(), `Unknown resource: ${resource}`, { itemIndex: i });
  }

  if (operation === 'getAll') {
    const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
    const limit = returnAll ? 0 : (ctx.getNodeParameter('limit', i, 50) as number);
    const filters = withUtcDates(ctx, ctx.getNodeParameter('filters', i, {}) as IDataObject, i);
    return {
      method: 'GET',
      path: collection,
      qs: toQuery(filters),
      list: { returnAll, limit },
      simplify: ctx.getNodeParameter('simplify', i, true) as boolean,
    };
  }

  if (operation === 'get') {
    const options = RESOURCES_WITH_LIVEMODE_ON_GET.has(resource)
      ? (ctx.getNodeParameter('options', i, {}) as IDataObject)
      : {};
    return {
      method: 'GET',
      path: itemPath(ctx, resource, i),
      qs: toQuery(options),
      simplify: ctx.getNodeParameter('simplify', i, true) as boolean,
    };
  }

  if (resource === 'booking' && operation === 'create') {
    return { method: 'POST', path: collection, body: bookingCreateBody(ctx, i) };
  }

  if (resource === 'coupon' && operation === 'create') {
    return { method: 'POST', path: collection, body: couponCreateBody(ctx, i) };
  }

  if (resource === 'customer' && operation === 'update') {
    return { method: 'PATCH', path: itemPath(ctx, resource, i), body: customerUpdateBody(ctx, i) };
  }

  throw new NodeOperationError(
    ctx.getNode(),
    `The operation "${operation}" is not supported for ${resource}`,
    { itemIndex: i }
  );
}
