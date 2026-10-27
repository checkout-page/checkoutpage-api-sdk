const zapier = require('zapier-platform-core');

const App = require('../../index');

const { ZAPIER_LIVE_API_URL, ZAPIER_LIVE_API_KEY } = process.env;
const describeLive = ZAPIER_LIVE_API_URL && ZAPIER_LIVE_API_KEY ? describe : describe.skip;

jest.setTimeout(30000);

describeLive('live API', () => {
  const appTester = zapier.createAppTester(App);

  beforeAll(() => {
    process.env.API_URL = ZAPIER_LIVE_API_URL.replace(/\/+$/, '');
  });

  const bundle = (inputData = {}) => ({
    authData: { api_key: ZAPIER_LIVE_API_KEY },
    inputData,
    meta: { page: 0 },
  });

  it('authentication test succeeds for the configured key', async () => {
    const result = await appTester(App.authentication.test, bundle());

    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it.each(Object.keys(App.triggers))('%s returns an array of objects with an id', async (key) => {
    const results = await appTester(
      App.triggers[key].operation.perform,
      bundle({
        include_test_payments: true,
        include_test_submissions: true,
        include_test_subscriptions: true,
      })
    );

    expect(Array.isArray(results)).toBe(true);
    for (const item of results) {
      expect(item).toEqual(expect.objectContaining({ id: expect.anything() }));
    }
  });
});
