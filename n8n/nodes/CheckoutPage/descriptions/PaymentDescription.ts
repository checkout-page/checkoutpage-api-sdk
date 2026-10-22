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
  textOption,
} from './common';

export const paymentDescription: INodeProperties[] = [
  operationField(
    'payment',
    [
      { name: 'Get', value: 'get', description: 'Get a payment', action: 'Get a payment' },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many payments',
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
