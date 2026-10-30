import type {
  IDataObject,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INodeProperties,
  INodePropertyCollection,
  INodePropertyOptions,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { CheckoutPageApi } from '../credentials/CheckoutPageApi.credentials';
import { CheckoutPage } from '../nodes/CheckoutPage/CheckoutPage.node';
import { CheckoutPageTrigger } from '../nodes/CheckoutPageTrigger/CheckoutPageTrigger.node';
import {
  apiError,
  CREDENTIALS,
  executeContext,
  hookContext,
  httpMock,
  loadOptionsContext,
  locator,
} from './helpers';
import {
  checkBodyKeys,
  declaredBodyPaths,
  findOperation,
  isDeprecatedQueryParameter,
  operations,
  queryParameters,
  validateBody,
  validateQueryValue,
} from './spec';

const node = new CheckoutPage();
const trigger = new CheckoutPageTrigger();

const ID = '66f1c0e2a4b5c6d7e8f90123';
const IDS = [
  '66f1c0e2a4b5c6d7e8f90001',
  '66f1c0e2a4b5c6d7e8f90002',
  '66f1c0e2a4b5c6d7e8f90003',
  '66f1c0e2a4b5c6d7e8f90004',
  '66f1c0e2a4b5c6d7e8f90005',
];
const NEXT_ID = '66f1c0e2a4b5c6d7e8f90999';
const WEBHOOK_URL = 'https://n8n.example.com/webhook/abc/webhook';

interface SentRequest {
  label: string;
  method: string;
  path: string;
  qs: IDataObject;
  body?: IDataObject;
}

type Recipe = { label: string; run: () => Promise<SentRequest[]> };
type Path = Array<string | number>;

function sent(label: string, http: ReturnType<typeof httpMock>): SentRequest[] {
  return http.mock.calls.map(([, options]: [string, IHttpRequestOptions]) => ({
    label,
    method: options.method ?? 'GET',
    path: String(options.url).slice(CREDENTIALS.baseUrl.length),
    qs: (options.qs as IDataObject | undefined) ?? {},
    body: options.body as IDataObject | undefined,
  }));
}

function conformance(request: SentRequest): string[] {
  const where = `${request.label}: ${request.method} ${request.path}`;
  const op = findOperation(request.method, request.path);
  if (!op) return [`${where} is not an operation in the spec`];
  const errors: string[] = [];
  for (const [name, value] of Object.entries(request.qs)) {
    errors.push(...validateQueryValue(op, name, value));
    if (isDeprecatedQueryParameter(op, name))
      errors.push(`query.${name} is deprecated in the spec`);
  }
  for (const parameter of queryParameters(op)) {
    if (parameter.required && !(parameter.name in request.qs)) {
      errors.push(`query.${parameter.name} is required`);
    }
  }
  if (request.body !== undefined) {
    if (!op.hasBody) {
      errors.push('sends a body, but the spec takes none');
    } else {
      const { unknown, deprecated } = checkBodyKeys(op, request.body);
      errors.push(...unknown.map((path) => `body${path} is not a property in the spec`));
      errors.push(...deprecated.map((path) => `body${path} is deprecated in the spec`));
      errors.push(...validateBody(op, request.body));
    }
  }
  return errors.map((error) => `${where} ${error}`);
}

async function expectConformance(recipe: Recipe) {
  const requests = await recipe.run();
  expect(requests.length, `${recipe.label} sent no request`).toBeGreaterThan(0);
  expect(requests.flatMap(conformance)).toEqual([]);
}

const properties = node.description.properties;

function visibleFor(prop: INodeProperties, resource: string, operation?: string): boolean {
  const show = prop.displayOptions?.show;
  const resources = show?.resource as string[] | undefined;
  const operations = show?.operation as string[] | undefined;
  if (!resources?.includes(resource)) return false;
  if (operation === undefined) return !operations;
  return !operations || operations.includes(operation);
}

const resources = (
  properties.find((p) => p.name === 'resource')!.options as INodePropertyOptions[]
).map((option) => String(option.value));

const nodeOperations = resources.flatMap((resource) => {
  const field = properties.find((p) => p.name === 'operation' && visibleFor(p, resource));
  return (field!.options as INodePropertyOptions[]).map((option) => ({
    resource,
    operation: String(option.value),
  }));
});

const READS = new Set(['get', 'getAll']);
const readOperations = nodeOperations.filter(({ operation }) => READS.has(operation));
const writeOperations = nodeOperations.filter(({ operation }) => !READS.has(operation));

const opProperties = (resource: string, operation: string) =>
  properties.filter(
    (p) => p.name !== 'resource' && p.name !== 'operation' && visibleFor(p, resource, operation)
  );

function optionValues(prop: INodeProperties): unknown[] {
  return ((prop.options as INodePropertyOptions[] | undefined) ?? []).map((option) => option.value);
}

function sample(prop: INodeProperties, variant: number): unknown {
  switch (prop.type) {
    case 'boolean':
      return variant % 2 === 0;
    case 'options': {
      const values = optionValues(prop);
      return values[variant % values.length];
    }
    case 'dateTime':
      return '2026-10-01T09:00:00';
    case 'number': {
      const bounds = [prop.typeOptions?.minValue, prop.typeOptions?.maxValue, prop.default];
      return bounds[variant % 3] ?? prop.default;
    }
    case 'resourceLocator':
      return locator(ID, 'id');
    case 'collection':
      return Object.fromEntries(
        (prop.options as INodeProperties[]).map((option) => [option.name, sample(option, variant)])
      );
    default:
      return ID;
  }
}

function variantCount(props: INodeProperties[]): number {
  const lengths = props.flatMap((prop) =>
    prop.type === 'collection'
      ? (prop.options as INodeProperties[]).map((option) => optionValues(option).length)
      : [optionValues(prop).length]
  );
  return Math.max(4, ...lengths);
}

async function execute(label: string, params: IDataObject, responses: unknown[]) {
  const { context, http } = executeContext(params, responses);
  await node.execute.call(context);
  return sent(label, http);
}

const readRecipes: Recipe[] = readOperations.flatMap(({ resource, operation }) => {
  const props = opProperties(resource, operation);
  return Array.from({ length: variantCount(props) }, (_, variant) => ({
    label: `${resource} ${operation} #${variant}`,
    run: () =>
      execute(
        `${resource} ${operation} #${variant}`,
        {
          resource,
          operation,
          ...Object.fromEntries(props.map((prop) => [prop.name, sample(prop, variant)])),
        },
        operation === 'getAll'
          ? [
              { data: [{ id: NEXT_ID }], has_more: true },
              { data: [], has_more: false },
            ]
          : [{ data: { id: ID } }]
      ),
  }));
});

interface WriteFixtures {
  required: IDataObject[];
  full: IDataObject[];
}

const address = (city: string): IDataObject => ({
  address: {
    city,
    country: 'GB',
    line1: '1 High Street',
    line2: 'Flat 2',
    postalCode: 'SW1A 1AA',
    state: 'London',
  },
});

const WRITE_FIXTURES: Record<string, WriteFixtures> = {
  'booking create': {
    required: [
      {
        eventId: locator(ID),
        tickets: { ticket: [{ ticketTypeId: IDS[0], quantity: 1 }] },
        fields: { field: [{ fieldId: IDS[1], value: 'ada@example.com' }] },
      },
    ],
    full: [
      {
        eventId: locator(ID, 'id'),
        tickets: {
          ticket: [
            { ticketTypeId: IDS[0], quantity: 2 },
            { ticketTypeId: IDS[2], quantity: 1 },
          ],
        },
        fields: {
          field: [
            { fieldId: IDS[1], value: 'ada@example.com' },
            { fieldId: IDS[3], value: 'Ada Lovelace' },
          ],
        },
        additionalFields: {
          complimentary: true,
          ticketPwywAmounts: { amount: [{ ticketTypeId: IDS[0], amount: 1500 }] },
        },
      },
      {
        eventId: locator(ID),
        tickets: { ticket: [{ ticketTypeId: IDS[0], quantity: 3 }] },
        fields: { field: [{ fieldId: IDS[1], value: 'ada@example.com' }] },
        additionalFields: {
          complimentary: false,
          couponId: IDS[4],
          manualType: 'invoice',
          ticketPwywAmounts: {
            amount: [
              { ticketTypeId: IDS[0], amount: 0 },
              { ticketTypeId: IDS[2], amount: 2500 },
            ],
          },
        },
      },
    ],
  },
  'coupon create': {
    required: [
      {
        label: 'Spring sale',
        code: 'SPRING10',
        discountType: 'percent',
        percentOff: 10,
        duration: 'once',
      },
      {
        label: 'Spring sale',
        code: 'SPRING25',
        discountType: 'amount',
        amountOff: 2500,
        currency: 'usd',
        duration: 'forever',
      },
    ],
    full: [
      {
        label: 'Members',
        code: 'MEMBERS-12_5',
        discountType: 'percent',
        percentOff: 12.5,
        duration: 'repeating',
        durationInMonths: 3,
        additionalFields: {
          appliesToSetupFee: true,
          appliesToTicketFees: true,
          maxRedemptions: 50,
          redeemBy: '2026-12-31T23:59:00',
        },
        rules: {
          rule: [
            { pageId: IDS[0], appliesTo: 'prices', priceIds: `${IDS[1]}, ${IDS[2]}` },
            { pageId: IDS[3], appliesTo: 'tickets', ticketTypeIds: IDS[4] },
          ],
        },
      },
      {
        label: 'Members',
        code: 'MEMBERS25',
        discountType: 'amount',
        amountOff: 2500,
        currency: 'gbp',
        duration: 'repeating',
        durationInMonths: 12,
        additionalFields: {
          appliesToSetupFee: false,
          appliesToTicketFees: false,
          maxRedemptions: 1,
          redeemBy: '2027-01-01',
        },
        rules: {
          rule: [
            { pageId: IDS[3], appliesTo: 'tickets', ticketTypeIds: `${IDS[1]},${IDS[2]}` },
            { pageId: IDS[0], appliesTo: 'prices', priceIds: '' },
          ],
        },
      },
      {
        label: 'Everyone',
        code: 'EVERYONE',
        discountType: 'percent',
        percentOff: 100,
        duration: 'forever',
        rules: {
          rule: [
            { pageId: IDS[0], appliesTo: 'wholeOrder' },
            { pageId: IDS[3], appliesTo: 'wholeOrder' },
          ],
        },
      },
    ],
  },
  'customer update': {
    required: [{ customerId: locator(ID), updateFields: { name: 'Ada Lovelace' } }],
    full: [
      {
        customerId: locator(ID, 'id'),
        updateFields: {
          address: address('London'),
          billingEmail: 'billing@example.com',
          companyName: 'Analytical Engines',
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          phone: '+44 20 7946 0000',
          shippingAddress: address('Bath'),
        },
      },
    ],
  },
};

function runWrite(resource: string, operation: string, label: string, fixture: IDataObject) {
  return execute(label, { resource, operation, ...fixture }, [{ data: { id: ID } }]);
}

const writeRecipes = (kind: keyof WriteFixtures): Recipe[] =>
  writeOperations.flatMap(({ resource, operation }) =>
    (WRITE_FIXTURES[`${resource} ${operation}`]?.[kind] ?? []).map((fixture, index) => {
      const label = `${resource} ${operation} (${kind} #${index})`;
      return { label, run: () => runWrite(resource, operation, label, fixture) };
    })
  );

interface Leaf {
  path: Path;
  prop: INodeProperties;
}

function leaves(prop: INodeProperties, base: Path = []): Leaf[] {
  const path = [...base, prop.name];
  if (prop.type === 'collection') {
    return (prop.options as INodeProperties[]).flatMap((option) => leaves(option, path));
  }
  if (prop.type === 'fixedCollection') {
    const rows = prop.typeOptions?.multipleValues ? [0] : [];
    return (prop.options as INodePropertyCollection[]).flatMap((group) =>
      group.values.flatMap((value) => leaves(value, [...path, group.name, ...rows]))
    );
  }
  return [{ path, prop }];
}

function getIn(value: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      current && typeof current === 'object'
        ? (current as Record<string | number, unknown>)[key]
        : undefined,
    value
  );
}

function withValue(fixture: IDataObject, path: Path, value: unknown): IDataObject {
  const copy = structuredClone(fixture);
  const parent = getIn(copy, path.slice(0, -1)) as Record<string | number, unknown>;
  parent[path[path.length - 1]] = value;
  return copy;
}

const pathLabel = (path: Path) => path.join('.');

const writeLeaves = (resource: string, operation: string) =>
  opProperties(resource, operation).flatMap((prop) => leaves(prop));

function nested(prop: INodeProperties): INodeProperties[] {
  if (prop.type === 'collection') return (prop.options as INodeProperties[]).flatMap(nested);
  if (prop.type === 'fixedCollection') {
    return (prop.options as INodePropertyCollection[]).flatMap((group) =>
      group.values.flatMap(nested)
    );
  }
  return [prop];
}

const allProperties = properties.flatMap((prop) => [prop, ...nested(prop)]);

const drivesDisplay = (name: string) =>
  allProperties.some((p) => p.displayOptions?.show && name in p.displayOptions.show);

const allFixtures = (resource: string, operation: string) => {
  const fixtures = WRITE_FIXTURES[`${resource} ${operation}`];
  return fixtures ? [...fixtures.required, ...fixtures.full] : [];
};

const optionSweeps = writeOperations.flatMap(({ resource, operation }) =>
  writeLeaves(resource, operation)
    .filter(({ prop }) => prop.type === 'options' && optionValues(prop).length)
    .filter(({ prop }) => !drivesDisplay(prop.name))
    .map(({ path, prop }) => ({
      label: `${resource} ${operation} ${pathLabel(path)}`,
      resource,
      operation,
      path,
      values: optionValues(prop),
    }))
);

const boundSweeps = writeOperations.flatMap(({ resource, operation }) =>
  writeLeaves(resource, operation)
    .filter(({ prop }) => prop.type === 'number')
    .flatMap(({ path, prop }) =>
      (['minValue', 'maxValue'] as const)
        .filter((bound) => typeof prop.typeOptions?.[bound] === 'number')
        .map((bound) => ({
          label: `${resource} ${operation} ${pathLabel(path)} at ${bound} ${prop.typeOptions![bound]}`,
          resource,
          operation,
          path,
          value: prop.typeOptions![bound] as number,
        }))
    )
);

function sweepRecipes(
  resource: string,
  operation: string,
  path: Path,
  value: unknown,
  label: string
): Recipe[] {
  return allFixtures(resource, operation)
    .filter((fixture) => getIn(fixture, path) !== undefined)
    .map((fixture, index) => ({
      label: `${label} (fixture #${index})`,
      run: () =>
        runWrite(
          resource,
          operation,
          `${label} (fixture #${index})`,
          withValue(fixture, path, value)
        ),
    }));
}

async function runHook(
  label: string,
  method: 'checkExists' | 'create' | 'delete',
  params: IDataObject,
  responses: unknown[],
  staticData?: IDataObject
) {
  const { context, http } = hookContext(params, responses, {
    staticData,
    webhookUrl: WEBHOOK_URL,
  });
  await trigger.webhookMethods.default[method].call(context);
  return sent(label, http);
}

const triggerEvents = optionValues(trigger.description.properties[0]) as string[];

const triggerRecipes: Recipe[] = [
  {
    label: 'trigger create (every event)',
    run: () =>
      runHook('trigger create (every event)', 'create', { events: triggerEvents }, [
        { data: { id: ID, secret: 'whsec-fake-aaaa-bbbb' } },
      ]),
  },
  {
    label: 'trigger create (one event)',
    run: () =>
      runHook('trigger create (one event)', 'create', { events: ['booking.created'] }, [
        { data: { id: ID } },
      ]),
  },
  {
    label: 'trigger create (replaces a leftover webhook)',
    run: () =>
      runHook('trigger create (replaces a leftover webhook)', 'create', { events: triggerEvents }, [
        apiError(409, 'A webhook with this URL already exists'),
        { data: [{ id: NEXT_ID, url: 'https://other.example.com' }], has_more: true },
        { data: [{ id: ID, url: WEBHOOK_URL }], has_more: false },
        {},
        { data: { id: ID } },
      ]),
  },
  {
    label: 'trigger checkExists',
    run: () =>
      runHook(
        'trigger checkExists',
        'checkExists',
        { events: ['booking.created'] },
        [{ data: { id: ID, url: 'https://other.example.com', events: ['booking.created'] } }, {}],
        { webhookId: ID, webhookSecret: 'secret' }
      ),
  },
  {
    label: 'trigger delete',
    run: () => runHook('trigger delete', 'delete', {}, [{}], { webhookId: ID }),
  },
];

type SearchMethod = (
  this: ILoadOptionsFunctions,
  filter?: string,
  paginationToken?: string
) => Promise<unknown>;

const methodRecipes: Recipe[] = [
  ...Object.entries(node.methods.listSearch as Record<string, SearchMethod>).flatMap(
    ([name, method]) =>
      [[], ['volunteer', NEXT_ID]].map((args, index) => {
        const label = `listSearch ${name} #${index}`;
        return {
          label,
          run: async () => {
            const { context, http } = loadOptionsContext({}, [{ data: [], has_more: false }]);
            await method.call(context, ...(args as [string?, string?]));
            return sent(label, http);
          },
        };
      })
  ),
  ...Object.entries(
    node.methods.loadOptions as Record<string, (this: ILoadOptionsFunctions) => Promise<unknown>>
  ).map(([name, method]) => {
    const label = `loadOptions ${name}`;
    return {
      label,
      run: async () => {
        const { context, http } = loadOptionsContext({ eventId: locator(ID) }, [
          { data: { id: ID, ticketGroups: [], fields: [] } },
        ]);
        await method.call(context);
        return sent(label, http);
      },
    };
  }),
  {
    label: 'credential test',
    run: async () => {
      const request = new CheckoutPageApi().test.request;
      return [
        {
          label: 'credential test',
          method: request.method ?? 'GET',
          path: String(request.url),
          qs: (request.qs as IDataObject | undefined) ?? {},
          body: request.body as IDataObject | undefined,
        },
      ];
    },
  },
];

describe('spec conformance: the node only sends what the seller API spec accepts', () => {
  it('has request fixtures for every write operation the node offers', () => {
    expect(nodeOperations.length).toBeGreaterThan(0);
    const missing = writeOperations
      .map(({ resource, operation }) => `${resource} ${operation}`)
      .filter((key) => !WRITE_FIXTURES[key]?.required.length || !WRITE_FIXTURES[key]?.full.length);
    expect(missing, 'add required and full fixtures to WRITE_FIXTURES').toEqual([]);
  });

  it('reports a deprecated body field with its path', () => {
    const op = findOperation('POST', '/v1/coupons/')!;
    const body = { label: 'x', code: 'X', duration: 'once', percentOff: 10, pageIds: [ID] };
    expect(
      conformance({ label: 'probe', method: 'POST', path: '/v1/coupons/', qs: {}, body })
    ).toEqual(['probe: POST /v1/coupons/ body/pageIds is deprecated in the spec']);
    expect(
      checkBodyKeys(op, { rules: [{ pageId: ID, appliesTo: 'wholeOrder' }] }).deprecated
    ).toEqual([]);
  });

  describe.each(readOperations)('$resource $operation', ({ resource, operation }) => {
    it.each(readRecipes.filter((r) => r.label.startsWith(`${resource} ${operation} #`)))(
      'with every filter and option filled: $label',
      expectConformance
    );
  });

  describe.each(writeOperations)('$resource $operation', ({ resource, operation }) => {
    const key = `${resource} ${operation}`;

    it.each(writeRecipes('required').filter((r) => r.label.startsWith(key)))(
      'with only required parameters: $label',
      expectConformance
    );

    it.each(writeRecipes('full').filter((r) => r.label.startsWith(key)))(
      'with every optional parameter: $label',
      expectConformance
    );

    it('has full fixtures that fill every parameter the node offers', () => {
      const full = WRITE_FIXTURES[key]?.full ?? [];
      const unfilled = writeLeaves(resource, operation)
        .map(({ path }) => path)
        .filter((path) => full.every((fixture) => getIn(fixture, path) === undefined))
        .map(pathLabel);
      expect(unfilled, `fill these in a full fixture for ${key}`).toEqual([]);
    });

    it('has fixtures for every value of the options that change which parameters show', () => {
      const fixtures = allFixtures(resource, operation);
      const unused = writeLeaves(resource, operation)
        .filter(({ prop }) => prop.type === 'options' && drivesDisplay(prop.name))
        .flatMap(({ path, prop }) =>
          optionValues(prop)
            .filter((value) => fixtures.every((fixture) => getIn(fixture, path) !== value))
            .map((value) => `${pathLabel(path)} = ${String(value)}`)
        );
      expect(unused, `add a fixture for each of these in ${key}`).toEqual([]);
    });
  });

  it.each(optionSweeps)('sends every $label option the UI offers', async (sweep) => {
    for (const value of sweep.values) {
      const recipes = sweepRecipes(
        sweep.resource,
        sweep.operation,
        sweep.path,
        value,
        `${sweep.label} = ${String(value)}`
      );
      expect(recipes.length, `no fixture sets ${sweep.label}`).toBeGreaterThan(0);
      for (const recipe of recipes) {
        const requests = await recipe.run();
        expect(JSON.stringify(requests), `${recipe.label} never reached the request`).toContain(
          JSON.stringify(value)
        );
        expect(requests.flatMap(conformance)).toEqual([]);
      }
    }
  });

  it.each(boundSweeps)('accepts $label', async (sweep) => {
    const recipes = sweepRecipes(
      sweep.resource,
      sweep.operation,
      sweep.path,
      sweep.value,
      sweep.label
    );
    expect(recipes.length, `no fixture sets ${sweep.label}`).toBeGreaterThan(0);
    for (const recipe of recipes) await expectConformance(recipe);
  });

  it.each(triggerRecipes)('$label', expectConformance);

  it.each(methodRecipes)('$label', expectConformance);

  it('lists the spec fields and query parameters the node never sends', async () => {
    const recipes = [
      ...readRecipes,
      ...writeRecipes('required'),
      ...writeRecipes('full'),
      ...triggerRecipes,
      ...methodRecipes,
    ];
    const used = new Map<string, { query: Set<string>; body: Set<string> }>();
    for (const recipe of recipes) {
      for (const request of await recipe.run()) {
        const op = findOperation(request.method, request.path);
        if (!op) continue;
        const entry = used.get(op.key) ?? { query: new Set(), body: new Set() };
        Object.keys(request.qs).forEach((name) => entry.query.add(name));
        if (request.body && op.hasBody) {
          checkBodyKeys(op, request.body).sent.forEach((path) => entry.body.add(path));
        }
        used.set(op.key, entry);
      }
    }

    const unsent: Record<string, { query?: string[]; body?: string[] }> = {};
    for (const [key, entry] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
      const op = operations.find((candidate) => candidate.key === key)!;
      const query = queryParameters(op)
        .map((parameter) => parameter.name)
        .filter((name) => !entry.query.has(name));
      const body = op.hasBody ? declaredBodyPaths(op).filter((p) => !entry.body.has(p)) : [];
      if (query.length || body.length) {
        unsent[key] = {
          ...(query.length ? { query } : {}),
          ...(body.length ? { body } : {}),
        };
      }
    }
    expect(unsent).toMatchInlineSnapshot(`
      {
        "GET /v1/bookings/": {
          "query": [
            "archived",
            "ending_before",
          ],
        },
        "GET /v1/checkout-pages/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/coupons/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/customers/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/events/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/forms/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/payments/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/subscriptions/": {
          "query": [
            "ending_before",
          ],
        },
        "GET /v1/webhooks/": {
          "query": [
            "ending_before",
            "status",
            "event",
          ],
        },
        "PATCH /v1/customers/:customerId": {
          "body": [
            "shipping.name",
            "shipping.phone",
          ],
        },
        "POST /v1/bookings/": {
          "body": [
            "fields[].meta",
            "fields[].meta.type",
            "fields[].value.billing",
            "fields[].value.billing.city",
            "fields[].value.billing.country",
            "fields[].value.billing.line1",
            "fields[].value.billing.line2",
            "fields[].value.billing.name",
            "fields[].value.billing.phone",
            "fields[].value.billing.postalCode",
            "fields[].value.billing.region",
            "fields[].value.billing.state",
            "fields[].value.sameAsShipping",
            "fields[].value.shipping",
            "fields[].value.shipping.city",
            "fields[].value.shipping.country",
            "fields[].value.shipping.line1",
            "fields[].value.shipping.line2",
            "fields[].value.shipping.name",
            "fields[].value.shipping.phone",
            "fields[].value.shipping.postalCode",
            "fields[].value.shipping.region",
            "fields[].value.shipping.state",
            "fields[].values",
            "queryParameters",
            "queryParameters.*",
          ],
        },
        "POST /v1/coupons/": {
          "body": [
            "pageIds",
            "rules[].bumpProductIds",
            "ticketTypeIds",
          ],
        },
        "POST /v1/webhooks/": {
          "body": [
            "customHeaders",
            "customHeaders.*",
          ],
        },
      }
    `);
  });
});
