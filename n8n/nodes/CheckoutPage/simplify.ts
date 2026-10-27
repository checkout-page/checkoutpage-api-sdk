import type { IDataObject } from 'n8n-workflow';

type FieldPick = string | [outputKey: string, path: string];

export const SIMPLIFIED_FIELDS: Record<string, FieldPick[]> = {
  booking: [
    'id',
    'customerName',
    'customerEmail',
    'eventTitle',
    'amount',
    'currency',
    'status',
    'orderId',
    'pageId',
    'createdAt',
  ],
  payment: [
    'id',
    'customerName',
    'customerEmail',
    'productTitle',
    'amount',
    'currency',
    'status',
    'quantity',
    'orderId',
    'createdAt',
  ],
  subscription: [
    'id',
    'customerName',
    'customerEmail',
    'productTitle',
    'amount',
    'currency',
    'interval',
    'status',
    'currentPeriodEnd',
    'createdAt',
  ],
  customer: [
    'id',
    'name',
    'email',
    'phone',
    'companyName',
    'billingEmail',
    ['city', 'address.city'],
    ['country', 'address.country'],
    'createdAt',
  ],
  coupon: [
    'id',
    'label',
    'code',
    'percentOff',
    'amountOff',
    'currency',
    'duration',
    'timesRedeemed',
    'maxRedemptions',
    'redeemBy',
  ],
  event: [
    'id',
    'title',
    'name',
    'status',
    ['startDate', 'eventDetails.startDate'],
    ['endDate', 'eventDetails.endDate'],
    ['location', 'eventDetails.location'],
    'url',
    'testmode',
    'createdAt',
  ],
  checkoutPage: [
    'id',
    'name',
    ['productTitle', 'product.title'],
    'status',
    'url',
    'slug',
    'testmode',
    'createdAt',
  ],
  form: ['id', 'title', 'name', 'status', 'url', 'submissionCount', 'testmode', 'createdAt'],
};

function valueAt(record: IDataObject, path: string): unknown {
  let value: unknown = record;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as IDataObject)[key];
  }
  return value;
}

export function simplifyRecord(resource: string, record: IDataObject): IDataObject {
  const picks = SIMPLIFIED_FIELDS[resource];
  if (!picks) return record;
  const result: IDataObject = {};
  for (const pick of picks) {
    const [key, path] = typeof pick === 'string' ? [pick, pick] : pick;
    const value = valueAt(record, path);
    if (value !== undefined) result[key] = value as IDataObject[string];
  }
  return result;
}
