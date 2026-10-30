const nock = require('nock');
const zapier = require('zapier-platform-core');

const API_ORIGIN = 'https://api.checkoutpage.test';
const API_PATH = '/api/v1';
const API_KEY = 'test-api-key-123';

process.env.API_URL = `${API_ORIGIN}${API_PATH}`;

const App = require('../index');

const appTester = zapier.createAppTester(App);

const api = () => nock(API_ORIGIN);

const bundleFor = ({ inputData = {}, page = 0 } = {}) => ({
  authData: { api_key: API_KEY },
  inputData,
  meta: { page },
});

const captureRequest = (scope, path, { status = 200, body = [] } = {}) => {
  const captured = {};
  scope
    .get(path)
    .query((query) => {
      captured.query = query;
      return true;
    })
    .reply(function reply() {
      captured.headers = this.req.headers;
      captured.method = this.req.method;
      return [status, body];
    });
  return captured;
};

module.exports = {
  API_KEY,
  API_ORIGIN,
  API_PATH,
  App,
  api,
  appTester,
  bundleFor,
  captureRequest,
  nock,
};
