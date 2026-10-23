import type { INodeProperties } from 'n8n-workflow';
import {
  abandonmentStatusOption,
  createdAfterOption,
  createdBeforeOption,
  filtersField,
  idField,
  livemodeOption,
  operationField,
  returnAllAndLimit,
  show,
  SUBSCRIPTION_STATUSES,
  textOption,
} from './common';

export const subscriptionDescription: INodeProperties[] = [
  operationField(
    'subscription',
    [
      {
        name: 'Get',
        value: 'get',
        description: 'Get a subscription',
        action: 'Get a subscription',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many subscriptions',
        action: 'Get many subscriptions',
      },
    ],
    'getAll'
  ),

  idField(
    'subscription',
    ['get'],
    'subscriptionId',
    'Subscription ID',
    'The ID of the subscription'
  ),
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: show('subscription', ['get']),
    options: [livemodeOption],
  },

  ...returnAllAndLimit('subscription'),
  filtersField('subscription', [
    abandonmentStatusOption,
    textOption('pageId', 'Checkout Page ID', 'Only return subscriptions started on this page'),
    createdAfterOption,
    createdBeforeOption,
    textOption('customerId', 'Customer ID', 'Only return subscriptions for this customer'),
    livemodeOption,
    textOption('orderId', 'Order ID', 'Only return subscriptions with this order ID'),
    textOption(
      'search',
      'Search',
      'Case-insensitive search matched against the customer email, customer name, product title, order ID and subscription ID'
    ),
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      default: 'active',
      options: SUBSCRIPTION_STATUSES,
    },
  ]),
];
