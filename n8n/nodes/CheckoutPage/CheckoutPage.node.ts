import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type ILoadOptionsFunctions,
  type INodeExecutionData,
  type INodeListSearchResult,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';
import { bookingDescription } from './descriptions/BookingDescription';
import { couponDescription } from './descriptions/CouponDescription';
import { customerDescription } from './descriptions/CustomerDescription';
import {
  checkoutPageDescription,
  eventDescription,
  formDescription,
} from './descriptions/PageDescription';
import { paymentDescription } from './descriptions/PaymentDescription';
import { subscriptionDescription } from './descriptions/SubscriptionDescription';
import { planRequest } from './operations';
import { simplifyRecord } from './simplify';
import {
  apiRequest,
  apiRequestList,
  CREDENTIAL_NAME,
  MAX_PAGE_SIZE,
  toNodeApiError,
  type ListResponse,
} from './transport';

async function getEvent(this: ILoadOptionsFunctions): Promise<IDataObject | undefined> {
  const eventId = this.getCurrentNodeParameter('eventId', { extractValue: true }) as
    | string
    | undefined;
  if (!eventId) return undefined;
  const response = await apiRequest.call(this, 'GET', `/v1/events/${encodeURIComponent(eventId)}`);
  return response.data as IDataObject | undefined;
}

async function searchList(
  this: ILoadOptionsFunctions,
  path: string,
  label: (record: IDataObject) => unknown,
  filter?: string,
  paginationToken?: string
): Promise<INodeListSearchResult> {
  const qs: IDataObject = { limit: MAX_PAGE_SIZE };
  if (filter) qs.search = filter;
  if (paginationToken) qs.starting_after = paginationToken;
  const response = (await apiRequest.call(
    this,
    'GET',
    path,
    undefined,
    qs
  )) as unknown as ListResponse;
  const records = response.data ?? [];
  const lastId = records.length ? records[records.length - 1].id : undefined;
  return {
    results: records.map((record) => ({
      name: String(label(record) || record.id),
      value: String(record.id),
      url: typeof record.url === 'string' && record.url ? record.url : undefined,
    })),
    paginationToken: response.has_more && lastId ? String(lastId) : undefined,
  };
}

const pageLabel = (page: IDataObject) => page.title || page.name;

const customerLabel = (customer: IDataObject) =>
  customer.name && customer.email
    ? `${String(customer.name)} (${String(customer.email)})`
    : customer.name || customer.email;

export class CheckoutPage implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Checkout Page',
    name: 'checkoutPage',
    icon: {
      light: 'file:../../icons/checkoutpage.svg',
      dark: 'file:../../icons/checkoutpage.dark.svg',
    },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Manage bookings, payments, customers, coupons and more in Checkout Page',
    defaults: { name: 'Checkout Page' },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: CREDENTIAL_NAME, required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Booking', value: 'booking' },
          { name: 'Checkout Page', value: 'checkoutPage' },
          { name: 'Coupon', value: 'coupon' },
          { name: 'Customer', value: 'customer' },
          { name: 'Event', value: 'event' },
          { name: 'Form', value: 'form' },
          { name: 'Payment', value: 'payment' },
          { name: 'Subscription', value: 'subscription' },
        ],
        default: 'booking',
      },
      ...bookingDescription,
      ...checkoutPageDescription,
      ...couponDescription,
      ...customerDescription,
      ...eventDescription,
      ...formDescription,
      ...paymentDescription,
      ...subscriptionDescription,
    ],
  };

  methods = {
    listSearch: {
      async searchEvents(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
        return searchList.call(this, '/v1/events/', pageLabel, filter, paginationToken);
      },

      async searchCheckoutPages(
        this: ILoadOptionsFunctions,
        filter?: string,
        paginationToken?: string
      ) {
        return searchList.call(this, '/v1/checkout-pages/', pageLabel, filter, paginationToken);
      },

      async searchForms(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string) {
        return searchList.call(this, '/v1/forms/', pageLabel, filter, paginationToken);
      },

      async searchCustomers(
        this: ILoadOptionsFunctions,
        filter?: string,
        paginationToken?: string
      ) {
        return searchList.call(this, '/v1/customers/', customerLabel, filter, paginationToken);
      },
    },

    loadOptions: {
      async getTicketTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const event = await getEvent.call(this);
        const groups = (event?.ticketGroups as IDataObject[] | undefined) ?? [];
        return groups.flatMap((group) =>
          ((group.ticketTypes as IDataObject[] | undefined) ?? []).map((ticketType) => ({
            name:
              groups.length > 1
                ? `${String(group.name ?? '')}: ${String(ticketType.name ?? ticketType.id)}`
                : String(ticketType.name ?? ticketType.id),
            value: String(ticketType.id),
          }))
        );
      },

      async getEventFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const event = await getEvent.call(this);
        const fields = (event?.fields as IDataObject[] | undefined) ?? [];
        return fields
          .filter((field) => field.disabled !== true)
          .map((field) => ({
            name: String(field.label || field.type || field.id),
            value: String(field.id),
            description: field.required ? 'Required' : undefined,
          }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const request = planRequest(this, resource, operation, i);
        const shape = (record: IDataObject) =>
          request.simplify ? simplifyRecord(resource, record) : record;

        if (request.list) {
          const records = await apiRequestList.call(
            this,
            request.path,
            request.qs ?? {},
            request.list.returnAll,
            request.list.limit
          );
          for (const record of records) {
            returnData.push({ json: shape(record), pairedItem: { item: i } });
          }
          continue;
        }

        const response = await apiRequest.call(
          this,
          request.method,
          request.path,
          request.body,
          request.qs
        );
        const record = (response?.data as IDataObject | undefined) ?? response;
        returnData.push({ json: shape(record), pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        if (error instanceof NodeOperationError) {
          throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
        }
        throw toNodeApiError(this.getNode(), error, i);
      }
    }

    return [returnData];
  }
}
