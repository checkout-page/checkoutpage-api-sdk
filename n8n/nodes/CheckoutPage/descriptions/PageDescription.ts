import type { INodeProperties } from 'n8n-workflow';
import { filtersField, idField, operationField, returnAllAndLimit, textOption } from './common';

function pageResource(resource: string, singular: string, plural: string): INodeProperties[] {
  const singularTitle = singular.charAt(0).toUpperCase() + singular.slice(1);
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
    idField(resource, ['get'], 'pageId', `${singularTitle} ID`, `The ID of the ${singular}`),
    ...returnAllAndLimit(resource),
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

export const eventDescription = pageResource('event', 'event', 'events');
export const checkoutPageDescription = pageResource(
  'checkoutPage',
  'checkout page',
  'checkout pages'
);
export const formDescription = pageResource('form', 'form', 'forms');
