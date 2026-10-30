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
    typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 2 },
    displayOptions: {
      show: { resource: ['coupon'], operation: ['create'], discountType: ['percent'] },
    },
    description: 'The discount, from 1 to 100',
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
    displayName: 'Rules',
    name: 'rules',
    type: 'fixedCollection',
    placeholder: 'Add Rule',
    typeOptions: { multipleValues: true },
    default: {},
    displayOptions: show('coupon', ['create']),
    description:
      'Where the coupon works and what it discounts, one rule for each checkout page or event. With no rules, the coupon works on every checkout page and event and discounts the whole order.',
    options: [
      {
        displayName: 'Rule',
        name: 'rule',
        values: [
          {
            displayName: 'Page ID',
            name: 'pageId',
            type: 'string',
            required: true,
            default: '',
            description: 'The ID of the checkout page or event the coupon works on',
          },
          {
            displayName: 'Applies To',
            name: 'appliesTo',
            type: 'options',
            default: 'wholeOrder',
            options: [
              {
                name: 'Prices (Checkout Pages)',
                value: 'prices',
                description:
                  'For a checkout page. Works when the customer buys one of the chosen prices, and discounts that price only.',
              },
              {
                name: 'Tickets (Events)',
                value: 'tickets',
                description:
                  'For an event. Works when the customer buys one of the chosen ticket types, and discounts those tickets only.',
              },
              {
                name: 'Whole Order',
                value: 'wholeOrder',
                description:
                  'Discounts the whole order: on a checkout page, the product at any price and every order bump; on an event, every ticket and add-on',
              },
            ],
          },
          {
            displayName: 'Price IDs',
            name: 'priceIds',
            type: 'string',
            default: '',
            displayOptions: { show: { appliesTo: ['prices'] } },
            description:
              "IDs of prices of the checkout page's product, separated by commas. These are Checkout Page price IDs, not Stripe ones. Leave empty for every price, including prices added later.",
          },
          {
            displayName: 'Ticket Type IDs',
            name: 'ticketTypeIds',
            type: 'string',
            default: '',
            displayOptions: { show: { appliesTo: ['tickets'] } },
            description:
              "IDs of the event's ticket types, separated by commas. Leave empty for every ticket type, including ones added later.",
          },
        ],
      },
    ],
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
        displayName: 'Redeem By',
        name: 'redeemBy',
        type: 'dateTime',
        default: '',
        description: 'The coupon must be used before this date and time',
      },
    ],
  },
];
