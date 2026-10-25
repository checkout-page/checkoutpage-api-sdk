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

export const bookingDescription: INodeProperties[] = [
  operationField(
    'booking',
    [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new booking to add an attendee to an event',
        action: 'Create booking',
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Retrieve a booking',
        action: 'Get booking',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Retrieve a list of bookings',
        action: 'Get many bookings',
      },
    ],
    'getAll'
  ),

  idField('booking', ['get'], 'bookingId', 'Booking ID', 'The ID of the booking'),
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: show('booking', ['get']),
    options: [livemodeOption],
  },

  ...returnAllAndLimit('booking'),
  filtersField('booking', [
    abandonmentStatusOption,
    textOption('couponCode', 'Coupon Code', 'Only return bookings that used this coupon code'),
    createdAfterOption,
    createdBeforeOption,
    textOption('customerId', 'Customer ID', 'Only return bookings for this customer'),
    textOption('pageId', 'Event ID', 'Only return bookings for this event'),
    {
      displayName: 'Is Complimentary',
      name: 'isComplimentary',
      type: 'boolean',
      default: true,
      description: 'Whether to return only complimentary bookings (on) or exclude them (off)',
    },
    livemodeOption,
    textOption('orderId', 'Order ID', 'Only return bookings with this order ID'),
    orderStatusOption,
    textOption(
      'search',
      'Search',
      'Case-insensitive search matched against the customer email, customer name and event title'
    ),
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      default: 'paid',
      options: PAYMENT_STATUSES,
    },
  ]),

  {
    displayName: 'Event Name or ID',
    name: 'eventId',
    type: 'options',
    required: true,
    default: '',
    typeOptions: { loadOptionsMethod: 'getEvents' },
    displayOptions: show('booking', ['create']),
    description:
      'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
  },
  {
    displayName: 'Tickets',
    name: 'tickets',
    type: 'fixedCollection',
    required: true,
    placeholder: 'Add Ticket',
    typeOptions: { multipleValues: true },
    default: {},
    displayOptions: show('booking', ['create']),
    description: 'Ticket types to book, with the quantity of each',
    options: [
      {
        displayName: 'Ticket',
        name: 'ticket',
        values: [
          {
            displayName: 'Ticket Type Name or ID',
            name: 'ticketTypeId',
            type: 'options',
            default: '',
            typeOptions: {
              loadOptionsMethod: 'getTicketTypes',
              loadOptionsDependsOn: ['eventId'],
            },
            description:
              'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
          },
          {
            displayName: 'Quantity',
            name: 'quantity',
            type: 'number',
            default: 1,
            typeOptions: { minValue: 1, maxValue: 1000 },
          },
        ],
      },
    ],
  },
  {
    displayName: 'Fields',
    name: 'fields',
    type: 'fixedCollection',
    required: true,
    placeholder: 'Add Field',
    typeOptions: { multipleValues: true },
    default: {},
    displayOptions: show('booking', ['create']),
    description:
      "Values for the event's fields. Include the email field: the booking's customer is created from it. Multi-select and address fields can't be set yet.",
    options: [
      {
        displayName: 'Field',
        name: 'field',
        values: [
          {
            displayName: 'Field Name or ID',
            name: 'fieldId',
            type: 'options',
            default: '',
            typeOptions: {
              loadOptionsMethod: 'getEventFields',
              loadOptionsDependsOn: ['eventId'],
            },
            description:
              'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'The submitted value, as text',
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
    displayOptions: show('booking', ['create']),
    options: [
      {
        displayName: 'Complimentary',
        name: 'complimentary',
        type: 'boolean',
        default: false,
        description:
          'Whether to issue the tickets at no charge. Cannot be combined with a payment type or a coupon.',
      },
      {
        displayName: 'Coupon ID',
        name: 'couponId',
        type: 'string',
        default: '',
        description: 'A coupon to apply to the booking',
      },
      {
        displayName: 'Pay-What-You-Want Amounts',
        name: 'ticketPwywAmounts',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        description:
          'Chosen amounts for pay-what-you-want ticket types, in the smallest currency unit (for example cents)',
        options: [
          {
            displayName: 'Amount',
            name: 'amount',
            values: [
              {
                displayName: 'Ticket Type ID',
                name: 'ticketTypeId',
                type: 'string',
                default: '',
              },
              {
                displayName: 'Amount',
                name: 'amount',
                type: 'number',
                default: 0,
                typeOptions: { minValue: 0 },
              },
            ],
          },
        ],
      },
      {
        displayName: 'Payment Type',
        name: 'manualType',
        type: 'options',
        default: 'invoice',
        options: [
          {
            name: 'Cash on Delivery',
            value: 'cash_on_delivery',
            description: 'Recorded as unpaid and payable on arrival',
          },
          {
            name: 'Invoice',
            value: 'invoice',
            description: 'Recorded as unpaid and awaiting an invoice payment',
          },
        ],
        description:
          'How the attendee will pay. This never takes a card payment: the booking is recorded as unpaid with the amount as its balance due.',
      },
    ],
  },
];
