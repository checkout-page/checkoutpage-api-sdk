import type { INodeProperties } from 'n8n-workflow';
import {
  filtersField,
  locatorField,
  operationField,
  returnAllAndLimit,
  simplifyField,
  textOption,
} from './common';

function pageResource(
  resource: string,
  singular: string,
  plural: string,
  searchListMethod: string
): INodeProperties[] {
  const singularTitle = singular.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return [
    operationField(
      resource,
      [
        {
          name: 'Get',
          value: 'get',
          description: `Retrieve ${singular === 'event' ? 'an' : 'a'} ${singular}`,
          action: `Get ${singular}`,
        },
        {
          name: 'Get Many',
          value: 'getAll',
          description: `Retrieve a list of ${plural}`,
          action: `Get many ${plural}`,
        },
      ],
      'getAll'
    ),
    locatorField({
      resource,
      operations: ['get'],
      name: 'pageId',
      displayName: singularTitle,
      singular,
      searchListMethod,
      description: `The ${singular} to retrieve`,
    }),
    ...returnAllAndLimit(resource),
    simplifyField(resource, ['get', 'getAll']),
    filtersField(resource, [
      textOption(
        'search',
        'Search',
        `Case-insensitive search matched against the ${singular} name and title`
      ),
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        default: 'published',
        options: [
          { name: 'Archived', value: 'archived' },
          { name: 'Draft', value: 'draft' },
          { name: 'Published', value: 'published' },
        ],
        description: 'Filter by publication status',
      },
      {
        displayName: 'Test Mode',
        name: 'testmode',
        type: 'boolean',
        default: true,
        description: `Whether to return only ${plural} in test mode (on) or only ${plural} not in test mode (off)`,
      },
    ]),
  ];
}

export const eventDescription = pageResource('event', 'event', 'events', 'searchEvents');
export const checkoutPageDescription = pageResource(
  'checkoutPage',
  'checkout page',
  'checkout pages',
  'searchCheckoutPages'
);
export const formDescription = pageResource('form', 'form', 'forms', 'searchForms');
