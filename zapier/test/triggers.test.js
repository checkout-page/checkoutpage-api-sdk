const {
  API_KEY,
  API_PATH,
  App,
  api,
  appTester,
  bundleFor,
  captureRequest,
  nock,
} = require('./helpers');

const SORT_BY_CANCELED_AT = JSON.stringify({ canceledAt: -1 });

const TRIGGERS = [
  { key: 'new_payment', resource: 'charges', testField: 'include_test_payments' },
  { key: 'new_submission', resource: 'submissions', testField: 'include_test_submissions' },
  { key: 'new_subscription', resource: 'subscriptions', testField: 'include_test_subscriptions' },
  {
    key: 'active_subscription',
    resource: 'active-subscriptions',
    testField: 'include_test_subscriptions',
  },
  {
    key: 'canceled_subscription',
    resource: 'canceled-subscriptions',
    testField: 'include_test_subscriptions',
    extraQuery: { sort: SORT_BY_CANCELED_AT },
  },
  {
    key: 'completed_subscription',
    resource: 'completed-subscriptions',
    testField: 'include_test_subscriptions',
    extraQuery: { sort: SORT_BY_CANCELED_AT },
  },
  {
    key: 'new_subscription_payment',
    resource: 'subscription-payments',
    testField: 'include_test_subscriptions',
  },
  { key: 'new_abandoned_payment', resource: 'abandoned-payments', testField: null },
  { key: 'new_abandoned_booking', resource: 'abandoned-bookings', testField: null },
  { key: 'new_abandoned_subscription', resource: 'abandoned-subscriptions', testField: null },
];

// What the converted code sends today. The string 'false' is truthy, so it drops the livemode
// filter like 'true' does: pinned as-is so a fix is a deliberate, reviewed change.
const LIVEMODE_CASES = [
  { input: true, sendsLivemode: false },
  { input: 'true', sendsLivemode: false },
  { input: false, sendsLivemode: true },
  { input: 'false', sendsLivemode: false },
  { input: undefined, sendsLivemode: true },
];

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  expect(pending).toEqual([]);
});

describe.each(TRIGGERS)('triggers.$key', ({ key, resource, testField, extraQuery = {} }) => {
  const method = App.triggers[key].operation.perform;
  const path = `${API_PATH}/zapier/v2/${resource}`;
  const livemodeQuery = testField ? { livemode: 'true' } : {};

  it('sends GET with the bearer key and JSON Accept header', async () => {
    const req = captureRequest(api(), path, { body: [{ id: 'one' }] });

    await appTester(method, bundleFor());

    expect(req.method).toBe('GET');
    expect(req.headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.headers.accept).toBe('application/json');
  });

  it('asks for the first 25 on page 0', async () => {
    const req = captureRequest(api(), path);

    await appTester(method, bundleFor({ page: 0 }));

    expect(req.query).toEqual({ limit: '25', skip: '0', ...extraQuery, ...livemodeQuery });
  });

  it('skips 50 on page 2', async () => {
    const req = captureRequest(api(), path);

    await appTester(method, bundleFor({ page: 2 }));

    expect(req.query).toEqual({ limit: '25', skip: '50', ...extraQuery, ...livemodeQuery });
  });

  if (testField) {
    it.each(LIVEMODE_CASES)(
      `${testField}=$input sends livemode: $sendsLivemode`,
      async ({ input, sendsLivemode }) => {
        const req = captureRequest(api(), path);
        const inputData = input === undefined ? {} : { [testField]: input };

        await appTester(method, bundleFor({ inputData }));

        expect(req.query).toEqual({
          limit: '25',
          skip: '0',
          ...extraQuery,
          ...(sendsLivemode ? { livemode: 'true' } : {}),
        });
      }
    );
  } else {
    it.each([true, 'true', false, 'false'])(
      'never sends livemode, even with include_test_* set to %p',
      async (input) => {
        const req = captureRequest(api(), path);

        await appTester(
          method,
          bundleFor({
            inputData: { include_test_payments: input, include_test_subscriptions: input },
          })
        );

        expect(req.query).toEqual({ limit: '25', skip: '0' });
      }
    );
  }

  it('returns the API results unchanged', async () => {
    const body = [
      { id: 'first', amount: '10.00', nested: { a: [1, 2] }, livemode: false },
      { id: 'second', amount: null, fields: { customer_email: 'person@example.com' } },
    ];
    captureRequest(api(), path, { body });

    const results = await appTester(method, bundleFor());

    expect(results).toEqual(body);
  });

  it('returns an empty list as-is', async () => {
    captureRequest(api(), path, { body: [] });

    await expect(appTester(method, bundleFor())).resolves.toEqual([]);
  });

  it.each([401, 403, 500])('throws a ResponseError on %i', async (status) => {
    captureRequest(api(), path, { status, body: { error: 'nope' } });

    const error = await appTester(method, bundleFor()).catch((err) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ResponseError');
    expect(JSON.parse(error.message).status).toBe(status);
  });
});
