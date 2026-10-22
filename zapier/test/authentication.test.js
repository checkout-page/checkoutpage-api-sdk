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

const HEALTH = `${API_PATH}/zapier/v2/health`;
const authTest = App.authentication.test;

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  expect(pending).toEqual([]);
});

describe('authentication.test', () => {
  it('calls the health endpoint with the bearer key and no query', async () => {
    const req = captureRequest(api(), HEALTH, { body: { success: true, store: 'Demo store' } });

    await appTester(authTest, bundleFor());

    expect(req.method).toBe('GET');
    expect(req.headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.query).toEqual({});
  });

  it('returns the health response on success', async () => {
    captureRequest(api(), HEALTH, { body: { success: true, store: 'Demo store' } });

    await expect(appTester(authTest, bundleFor())).resolves.toEqual({
      success: true,
      store: 'Demo store',
    });
  });

  it('fails when the API cannot be reached', async () => {
    api().get(HEALTH).replyWithError('connect ECONNREFUSED');

    await expect(appTester(authTest, bundleFor())).rejects.toThrow(/ECONNREFUSED/);
  });

  // Pins current behaviour: with skipThrowForStatus and no throwForStatus() in the test, an
  // error status resolves, so Zapier would accept the connection. See README, Known issues.
  it.each([401, 403, 404, 500])('does not throw on %i', async (status) => {
    const body = { status: 'error', type: 'error', message: 'Missing or invalid API key' };
    captureRequest(api(), HEALTH, { status, body });

    await expect(appTester(authTest, bundleFor())).resolves.toEqual(body);
  });
});
