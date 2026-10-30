import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export const PAYMENT_STATUSES: INodePropertyOptions[] = [
  { name: 'Canceled', value: 'canceled' },
  { name: 'Created', value: 'created' },
  { name: 'Draft', value: 'draft' },
  { name: 'Draft Expired', value: 'draft_expired' },
  { name: 'Failed', value: 'failed' },
  { name: 'Paid', value: 'paid' },
  { name: 'Partial Refund', value: 'partial_refund' },
  { name: 'Partially Paid', value: 'partially_paid' },
  { name: 'Pending', value: 'pending' },
  { name: 'Refunded', value: 'refunded' },
  { name: 'Unpaid', value: 'unpaid' },
];

export const SUBSCRIPTION_STATUSES: INodePropertyOptions[] = [
  { name: 'Active', value: 'active' },
  { name: 'Canceled', value: 'canceled' },
  { name: 'Completed', value: 'completed' },
  { name: 'Draft', value: 'draft' },
  { name: 'Draft Expired', value: 'draft_expired' },
  { name: 'Failed', value: 'failed' },
  { name: 'Incomplete', value: 'incomplete' },
  { name: 'Incomplete Expired', value: 'incomplete_expired' },
  { name: 'Past Due', value: 'past_due' },
  { name: 'Paused', value: 'paused' },
  { name: 'Scheduled', value: 'scheduled' },
  { name: 'Trialing', value: 'trialing' },
  { name: 'Unpaid', value: 'unpaid' },
];

export function show(resource: string, operation: string[]) {
  return { show: { resource: [resource], operation } };
}

export function idField(
  resource: string,
  operations: string[],
  name: string,
  displayName: string,
  description: string
): INodeProperties {
  return {
    displayName,
    name,
    type: 'string',
    required: true,
    default: '',
    displayOptions: show(resource, operations),
    description,
  };
}

export function locatorField(options: {
  resource: string;
  operations: string[];
  name: string;
  displayName: string;
  singular: string;
  searchListMethod: string;
  description: string;
}): INodeProperties {
  const { resource, operations, name, displayName, singular, searchListMethod, description } =
    options;
  const article = /^[aeiou]/.test(singular) ? 'an' : 'a';
  return {
    displayName,
    name,
    type: 'resourceLocator',
    required: true,
    default: { mode: 'list', value: '' },
    displayOptions: show(resource, operations),
    description,
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        placeholder: `Select ${article} ${singular}...`,
        typeOptions: { searchListMethod, searchable: true },
      },
      {
        displayName: 'By ID',
        name: 'id',
        type: 'string',
        placeholder: 'e.g. 66f1c0e2a4b5c6d7e8f90123',
      },
    ],
  };
}

export function returnAllAndLimit(resource: string): INodeProperties[] {
  return [
    {
      displayName: 'Return All',
      name: 'returnAll',
      type: 'boolean',
      displayOptions: show(resource, ['getAll']),
      default: false,
      description: 'Whether to return all results or only up to a given limit',
    },
    {
      displayName: 'Limit',
      name: 'limit',
      type: 'number',
      displayOptions: {
        show: { resource: [resource], operation: ['getAll'], returnAll: [false] },
      },
      typeOptions: { minValue: 1, maxValue: 100 },
      default: 50,
      description: 'Max number of results to return',
    },
  ];
}

export const livemodeOption: INodeProperties = {
  displayName: 'Live Mode',
  name: 'livemode',
  type: 'boolean',
  default: true,
  description:
    'Whether to return live records. Turn this off to return test-mode records created while a page was in test mode. Defaults to the mode of the API key.',
};

export function textOption(
  name: string,
  displayName: string,
  description: string
): INodeProperties {
  return { displayName, name, type: 'string', default: '', description };
}

export function dateOption(
  name: string,
  displayName: string,
  description: string
): INodeProperties {
  return { displayName, name, type: 'dateTime', default: '', description };
}

export const createdAfterOption = dateOption(
  'createdAfter',
  'Created After',
  'Only return records created after this date and time'
);

export const createdBeforeOption = dateOption(
  'createdBefore',
  'Created Before',
  'Only return records created before this date and time'
);

export const abandonmentStatusOption: INodeProperties = {
  displayName: 'Abandonment Status',
  name: 'abandonmentStatus',
  type: 'options',
  default: 'abandoned',
  options: [
    { name: 'Abandoned', value: 'abandoned' },
    { name: 'Recovered', value: 'recovered' },
  ],
  description: 'Only return abandoned checkouts, or abandoned checkouts that were later recovered',
};

export const orderStatusOption: INodeProperties = {
  displayName: 'Order Status',
  name: 'orderStatus',
  type: 'options',
  default: 'active',
  options: [
    { name: 'Active', value: 'active' },
    { name: 'Canceled', value: 'canceled' },
  ],
};

export function filtersField(resource: string, options: INodeProperties[]): INodeProperties {
  return {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: show(resource, ['getAll']),
    options: [...options].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

export function operationField(
  resource: string,
  options: INodePropertyOptions[],
  defaultValue: string
): INodeProperties {
  return {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: [resource] } },
    options,
    default: defaultValue,
  };
}

export function simplifyField(resource: string, operations: string[]): INodeProperties {
  return {
    displayName: 'Simplify',
    name: 'simplify',
    type: 'boolean',
    default: true,
    displayOptions: show(resource, operations),
    description: 'Whether to return a simplified version of the response instead of the raw data',
  };
}
