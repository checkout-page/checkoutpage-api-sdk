import type { INodeProperties } from 'n8n-workflow';
import {
  filtersField,
  operationField,
  returnAllAndLimit,
  show,
  simplifyField,
  textOption,
} from './common';

const CURRENCIES = [
  'aed',
  'aud',
  'brl',
  'cad',
  'chf',
  'clp',
  'czk',
  'dkk',
  'eur',
  'gbp',
  'hkd',
  'inr',
  'jpy',
  'mxn',
  'myr',
  'nok',
  'nzd',
  'php',
  'pln',
  'ron',
  'sek',
  'sgd',
  'thb',
  'usd',
  'zar',
];

export const couponDescription: INodeProperties[] = [
  operationField(
    'coupon',
    [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new coupon',
        action: 'Create coupon',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Retrieve a list of coupons',
        action: 'Get many coupons',
      },
    ],
    'create'
  ),

  ...returnAllAndLimit('coupon'),
  simplifyField('coupon', ['getAll']),
  filtersField('coupon', [
    textOption(
      'search',
      'Search',
      'Case-insensitive search matched against the coupon label and code'
    ),
  ]),

  {
    displayName: 'Label',
    name: 'label',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. Spring sale',
    displayOptions: show('coupon', ['create']),
    description: 'Internal name for the coupon',
  },
  {
    displayName: 'Code',
    name: 'code',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. SPRING10',
    displayOptions: show('coupon', ['create']),
    description: 'The coupon code a customer enters',
  },
  {
    displayName: 'Discount Type',
    name: 'discountType',
    type: 'options',
    default: 'percent',
    displayOptions: show('coupon', ['create']),
    options: [
      { name: 'Fixed Amount', value: 'amount' },
      { name: 'Percentage', value: 'percent' },
    ],
  },
  {
    displayName: 'Percent Off',
    name: 'percentOff',
    type: 'number',
    required: true,
    default: 10,
    typeOptions: { minValue: 0, maxValue: 100, numberPrecision: 2 },
    displayOptions: {
      show: { resource: ['coupon'], operation: ['create'], discountType: ['percent'] },
    },
    description: 'The discount, larger than 0 and up to 100',
  },
  {
    displayName: 'Amount Off',
    name: 'amountOff',
    type: 'number',
    required: true,
    default: 0,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['coupon'], operation: ['create'], discountType: ['amount'] },
    },
    description:
      'The amount to subtract, in the smallest currency unit. For example 2500 is $25.00.',
  },
  {
    displayName: 'Currency',
    name: 'currency',
    type: 'options',
    required: true,
    default: 'usd',
    displayOptions: {
      show: { resource: ['coupon'], operation: ['create'], discountType: ['amount'] },
    },
    options: CURRENCIES.map((code) => ({ name: code.toUpperCase(), value: code })),
    description: 'The currency of the amount off',
  },
  {
    displayName: 'Duration',
    name: 'duration',
    type: 'options',
    required: true,
    default: 'once',
    displayOptions: show('coupon', ['create']),
    options: [
      { name: 'Forever', value: 'forever', description: 'Applies to every subscription payment' },
      { name: 'Once', value: 'once', description: 'Applies to the first payment only' },
      {
        name: 'Repeating',
        value: 'repeating',
        description: 'Applies for a set number of months',
      },
    ],
    description: 'How long the discount applies to a subscription',
  },
  {
    displayName: 'Duration in Months',
    name: 'durationInMonths',
    type: 'number',
    required: true,
    default: 3,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['coupon'], operation: ['create'], duration: ['repeating'] },
    },
    description: 'The number of months the coupon applies for',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: show('coupon', ['create']),
    options: [
      {
        displayName: 'Applies to Setup Fee',
        name: 'appliesToSetupFee',
        type: 'boolean',
        default: false,
        description: 'Whether the discount also applies to the setup fee',
      },
      {
        displayName: 'Applies to Ticket Fees',
        name: 'appliesToTicketFees',
        type: 'boolean',
        default: false,
        description: 'Whether the discount also applies to ticket-level fees on events',
      },
      {
        displayName: 'Max Redemptions',
        name: 'maxRedemptions',
        type: 'number',
        default: 1,
        typeOptions: { minValue: 1 },
        description:
          'The total number of times this coupon can be used. It does not limit how often one customer uses it.',
      },
      {
        displayName: 'Page IDs',
        name: 'pageIds',
        type: 'string',
        default: '',
        description:
          'IDs of the checkout pages, events or forms this coupon can be used on, separated by commas',
      },
      {
        displayName: 'Redeem By',
        name: 'redeemBy',
        type: 'dateTime',
        default: '',
        description: 'The coupon must be used before this date and time',
      },
      {
        displayName: 'Ticket Type IDs',
        name: 'ticketTypeIds',
        type: 'string',
        default: '',
        description:
          'IDs of the ticket types this coupon can be used with, separated by commas. They must belong to one of the pages in Page IDs.',
      },
    ],
  },
];
