import type { INodeProperties } from 'n8n-workflow';
import {
  createdAfterOption,
  createdBeforeOption,
  filtersField,
  idField,
  operationField,
  returnAllAndLimit,
  show,
  textOption,
} from './common';

const addressValues: INodeProperties[] = [
  { displayName: 'City', name: 'city', type: 'string', default: '' },
  {
    displayName: 'Country',
    name: 'country',
    type: 'string',
    default: '',
    description: 'Two-letter country code, for example US or GB',
  },
  { displayName: 'Line 1', name: 'line1', type: 'string', default: '' },
  { displayName: 'Line 2', name: 'line2', type: 'string', default: '' },
  { displayName: 'Postal Code', name: 'postalCode', type: 'string', default: '' },
  { displayName: 'State', name: 'state', type: 'string', default: '' },
];

export const customerDescription: INodeProperties[] = [
  operationField(
    'customer',
    [
      { name: 'Get', value: 'get', description: 'Get a customer', action: 'Get a customer' },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Get many customers',
        action: 'Get many customers',
      },
      {
        name: 'Update',
        value: 'update',
        description: 'Update a customer',
        action: 'Update a customer',
      },
    ],
    'get'
  ),

  idField('customer', ['get', 'update'], 'customerId', 'Customer ID', 'The ID of the customer'),

  ...returnAllAndLimit('customer'),
  filtersField('customer', [
    createdAfterOption,
    createdBeforeOption,
    textOption(
      'search',
      'Search',
      'Case-insensitive search matched against the customer name and email'
    ),
  ]),

  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: show('customer', ['update']),
    options: [
      {
        displayName: 'Billing Address',
        name: 'address',
        type: 'fixedCollection',
        default: {},
        description: 'Only the parts you fill in are changed',
        options: [{ displayName: 'Address', name: 'address', values: addressValues }],
      },
      {
        displayName: 'Billing Email',
        name: 'billingEmail',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Billing email address. Can be different from the primary email.',
      },
      {
        displayName: 'Company Name',
        name: 'companyName',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        description: 'Primary email address',
      },
      { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Full name' },
      { displayName: 'Phone', name: 'phone', type: 'string', default: '' },
      {
        displayName: 'Shipping Address',
        name: 'shippingAddress',
        type: 'fixedCollection',
        default: {},
        description: 'Only the parts you fill in are changed',
        options: [{ displayName: 'Address', name: 'address', values: addressValues }],
      },
    ],
  },
];
