import type { INodeProperties } from 'n8n-workflow';
import {
  abandonmentStatusOption,
  createdAfterOption,
  createdBeforeOption,
  filtersField,
  idField,
  livemodeOption,
  operationField,
  orderStatusOption,
  PAYMENT_STATUSES,
  returnAllAndLimit,
  show,
  simplifyField,
  textOption,
} from './common';

export const paymentDescription: INodeProperties[] = [
  operationField(
    'payment',
    [
      { name: 'Get', value: 'get', description: 'Retrieve a payment', action: 'Get payment' },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Retrieve a list of payments',
        action: 'Get many payments',
      },
    ],
    'getAll'
  ),

  idField('payment', ['get'], 'paymentId', 'Payment ID', 'The ID of the payment'),
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: show('payment', ['get']),
    options: [livemodeOption],
  },

  ...returnAllAndLimit('payment'),
  simplifyField('payment', ['get', 'getAll']),
  filtersField('payment', [
    abandonmentStatusOption,
    textOption('pageId', 'Checkout Page ID', 'Only return payments made on this checkout page'),
    textOption('couponCode', 'Coupon Code', 'Only return payments that used this coupon code'),
    createdAfterOption,
    createdBeforeOption,
    textOption('customerId', 'Customer ID', 'Only return payments from this customer'),
    livemodeOption,
    textOption('orderId', 'Order ID', 'Only return payments with this order ID'),
    orderStatusOption,
    textOption('productId', 'Product ID', 'Only return payments for this product'),
    textOption(
      'search',
      'Search',
      'Case-insensitive search matched against the customer email, customer name and product title'
    ),
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      default: 'paid',
      options: PAYMENT_STATUSES,
    },
  ]),
];
