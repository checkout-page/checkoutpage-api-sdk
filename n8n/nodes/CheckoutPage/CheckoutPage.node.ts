import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type ILoadOptionsFunctions,
  type INodeExecutionData,
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
import { apiRequest, apiRequestList, CREDENTIAL_NAME, toNodeApiError } from './transport';

async function getEvent(this: ILoadOptionsFunctions): Promise<IDataObject | undefined> {
  const eventId = this.getCurrentNodeParameter('eventId') as string | undefined;
  if (!eventId) return undefined;
  const response = await apiRequest.call(this, 'GET', `/v1/events/${encodeURIComponent(eventId)}`);
  return response.data as IDataObject | undefined;
}

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
    loadOptions: {
      async getEvents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const events = await apiRequestList.call(this, '/v1/events/', {}, true);
        return events.map((event) => ({
          name: String(event.title || event.name || event.id),
          value: String(event.id),
        }));
      },

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

        if (request.list) {
          const records = await apiRequestList.call(
            this,
            request.path,
            request.qs ?? {},
            request.list.returnAll,
            request.list.limit
          );
          for (const record of records) {
            returnData.push({ json: record, pairedItem: { item: i } });
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
        returnData.push({ json: record, pairedItem: { item: i } });
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
