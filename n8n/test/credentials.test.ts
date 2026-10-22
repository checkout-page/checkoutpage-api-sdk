import { describe, expect, it } from 'vitest';
import { CheckoutPageApi } from '../credentials/CheckoutPageApi.credentials';

describe('CheckoutPageApi credentials', () => {
  const credentials = new CheckoutPageApi();

  it('is named checkoutPageApi', () => {
    expect(credentials.name).toBe('checkoutPageApi');
    expect(credentials.displayName).toBe('Checkout Page API');
  });

  it('stores the API key as a password field', () => {
    const apiKey = credentials.properties.find((p) => p.name === 'apiKey');
    expect(apiKey?.type).toBe('string');
    expect(apiKey?.typeOptions?.password).toBe(true);
    expect(apiKey?.required).toBe(true);
  });

  it('defaults the base URL to production', () => {
    const baseUrl = credentials.properties.find((p) => p.name === 'baseUrl');
    expect(baseUrl?.default).toBe('https://api.checkoutpage.com');
  });

  it('sends the API key as a Bearer token', () => {
    expect(credentials.authenticate).toEqual({
      type: 'generic',
      properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
    });
  });

  it('tests the key with GET /v1/account/ on the configured base URL', () => {
    expect(credentials.test.request.method).toBe('GET');
    expect(credentials.test.request.url).toBe('/v1/account/');
    expect(credentials.test.request.baseURL).toContain('$credentials.baseUrl');
  });

  it('strips trailing slashes from the base URL in the test request', () => {
    expect(credentials.test.request.baseURL).toBe('={{$credentials.baseUrl.replace(/\\/+$/, "")}}');
  });
});
