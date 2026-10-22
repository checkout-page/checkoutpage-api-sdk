import {
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IHookFunctions,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from 'n8n-workflow';
import {
  apiRequest,
  apiRequestList,
  CREDENTIAL_NAME,
  getHttpStatus,
  toNodeApiError,
} from '../CheckoutPage/transport';
import { generateSecret, verifySignature } from './signature';

export const WEBHOOK_EVENTS = [
  'booking.abandoned',
  'booking.created',
  'booking.paid',
  'checkout_page.created',
  'checkout_page.updated',
  'customer.created',
  'customer.updated',
  'payment.abandoned',
  'payment.created',
  'payment.paid',
  'product.created',
  'product.updated',
  'submission.created',
  'submission.updated',
  'subscription.abandoned',
  'subscription.active',
  'subscription.canceled',
  'subscription.completed',
  'subscription.created',
  'subscription.expired',
  'subscription.scheduled',
  'subscription.trialing',
  'ticket.created',
] as const;

function eventLabel(event: string): string {
  return event
    .split(/[._]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface WebhookStaticData extends IDataObject {
  webhookId?: string;
  webhookSecret?: string;
}

function sameEvents(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a)) return false;
  const left = [...new Set(a.map(String))].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((event, index) => event === right[index]);
}

function clearStaticData(data: WebhookStaticData) {
  delete data.webhookId;
  delete data.webhookSecret;
}

async function deleteRemoteWebhook(this: IHookFunctions, webhookId: string): Promise<void> {
  try {
    await apiRequest.call(this, 'DELETE', `/v1/webhooks/${encodeURIComponent(webhookId)}`);
  } catch (error) {
    if (getHttpStatus(error) === 404) return;
    throw toNodeApiError(this.getNode(), error);
  }
}

export class CheckoutPageTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Checkout Page Trigger',
    name: 'checkoutPageTrigger',
    icon: {
      light: 'file:../../icons/checkoutpage.svg',
      dark: 'file:../../icons/checkoutpage.dark.svg',
    },
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description:
      'Starts the workflow when something happens in Checkout Page, such as a new booking or payment',
    defaults: { name: 'Checkout Page Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: CREDENTIAL_NAME, required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: ['booking.created'],
        options: WEBHOOK_EVENTS.map((event) => ({
          name: eventLabel(event),
          value: event,
        })),
        description: 'The events that start this workflow',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
        const webhookId = staticData.webhookId;
        if (!webhookId) return false;

        let webhook: IDataObject | undefined;
        try {
          const response = await apiRequest.call(
            this,
            'GET',
            `/v1/webhooks/${encodeURIComponent(webhookId)}`
          );
          webhook = response.data as IDataObject | undefined;
        } catch (error) {
          if (getHttpStatus(error) !== 404) throw toNodeApiError(this.getNode(), error);
          clearStaticData(staticData);
          return false;
        }

        const webhookUrl = this.getNodeWebhookUrl('default');
        const events = this.getNodeParameter('events') as string[];
        if (
          webhook &&
          webhook.url === webhookUrl &&
          sameEvents(webhook.events, events) &&
          staticData.webhookSecret
        ) {
          return true;
        }

        await deleteRemoteWebhook.call(this, webhookId);
        clearStaticData(staticData);
        return false;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = this.getNodeParameter('events') as string[];

        if (!webhookUrl?.startsWith('https://')) {
          throw new NodeOperationError(
            this.getNode(),
            'Checkout Page only sends webhooks to https addresses',
            {
              description: `This workflow's webhook address is ${webhookUrl}. Run n8n behind a public https address, for example a tunnel, and try again.`,
            }
          );
        }
        if (!events?.length) {
          throw new NodeOperationError(this.getNode(), 'Choose at least one event');
        }

        const secret = generateSecret();
        const workflowName = this.getWorkflow().name || 'workflow';
        const body: IDataObject = {
          name: `n8n: ${workflowName}`.slice(0, 100),
          url: webhookUrl,
          events,
          secret,
        };

        let response: IDataObject;
        try {
          response = await apiRequest.call(this, 'POST', '/v1/webhooks/', body);
        } catch (error) {
          if (getHttpStatus(error) !== 409) throw toNodeApiError(this.getNode(), error);
          // A webhook for this URL survives from an earlier activation whose static
          // data was lost. Its secret can't be read back, so replace it.
          const existing = await apiRequestList.call(this, '/v1/webhooks/', {}, true);
          const stale = existing.find((webhook) => webhook.url === webhookUrl);
          if (!stale?.id) throw toNodeApiError(this.getNode(), error);
          await deleteRemoteWebhook.call(this, String(stale.id));
          response = await apiRequest.call(this, 'POST', '/v1/webhooks/', body);
        }

        const webhook = response.data as IDataObject | undefined;
        if (!webhook?.id) {
          throw new NodeOperationError(
            this.getNode(),
            'Checkout Page did not return the new webhook'
          );
        }

        const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
        staticData.webhookId = String(webhook.id);
        staticData.webhookSecret =
          typeof webhook.secret === 'string' && webhook.secret ? webhook.secret : secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
        if (staticData.webhookId) {
          await deleteRemoteWebhook.call(this, staticData.webhookId);
        }
        clearStaticData(staticData);
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const request = this.getRequestObject();
    const headers = this.getHeaderData() as IDataObject;
    const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;

    const valid = verifySignature(
      request.rawBody,
      headers['x-webhook-signature'],
      staticData.webhookSecret
    );

    if (!valid) {
      const response = this.getResponseObject();
      response.status(401).json({ message: 'Invalid webhook signature' });
      return { noWebhookResponse: true };
    }

    return {
      workflowData: [this.helpers.returnJsonArray(this.getBodyData() as IDataObject)],
    };
  }
}
