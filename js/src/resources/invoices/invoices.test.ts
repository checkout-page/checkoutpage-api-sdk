import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { InvoiceResource } from './invoices';

describe('InvoiceResource', () => {
  let client: CheckoutPageApiClient;
  let resource: InvoiceResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    resource = new InvoiceResource(client);
  });

  describe('list', () => {
    it('GETs /v1/invoices/ with no filters', async () => {
      const mockResponse = { data: [], has_more: false, total: 0 } as any;
      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await resource.list();

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/invoices/',
        query: {
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
          search: undefined,
          status: undefined,
          customerId: undefined,
          chargeId: undefined,
          poNumber: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
        },
      });
    });

    it('stringifies limit and forwards every filter', async () => {
      vi.spyOn(client, 'request').mockResolvedValue({
        data: [],
        has_more: false,
        total: 0,
      } as any);

      await resource.list({
        limit: 25,
        starting_after: '507f1f77bcf86cd799439013',
        ending_before: '507f1f77bcf86cd799439014',
        search: 'jane@example.com',
        status: 'paid',
        customerId: '507f1f77bcf86cd799439011',
        chargeId: '507f1f77bcf86cd799439012',
        poNumber: 'PO-1',
        createdAfter: '2026-01-01T00:00:00Z',
        createdBefore: '2026-12-31T23:59:59Z',
      });

      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/invoices/',
        query: {
          limit: '25',
          starting_after: '507f1f77bcf86cd799439013',
          ending_before: '507f1f77bcf86cd799439014',
          search: 'jane@example.com',
          status: 'paid',
          customerId: '507f1f77bcf86cd799439011',
          chargeId: '507f1f77bcf86cd799439012',
          poNumber: 'PO-1',
          createdAfter: '2026-01-01T00:00:00Z',
          createdBefore: '2026-12-31T23:59:59Z',
        },
      });
    });

    it('returns the wrapped envelope verbatim (data + has_more + total)', async () => {
      const payload = {
        data: [{ id: 'inv_1' }, { id: 'inv_2' }],
        has_more: true,
        total: 42,
      } as any;
      vi.spyOn(client, 'request').mockResolvedValue(payload);

      const result = await resource.list();

      expect(result).toBe(payload);
      expect(result.data).toHaveLength(2);
      expect(result.has_more).toBe(true);
      expect(result.total).toBe(42);
    });
  });
});

describe('InvoiceResource.regenerate', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        data: { id: '507f1f77bcf86cd799439011', invoiceUrl: 'https://x.example/y.pdf' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('POSTs to /v1/invoices/:id/regenerate with the bearer token', async () => {
    const client = new CheckoutPageApiClient({ apiKey: 'k', baseUrl: 'https://api.example.com' });
    await client.invoices.regenerate('507f1f77bcf86cd799439011');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/invoices/507f1f77bcf86cd799439011/regenerate');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer k');
  });

  it('returns the parsed invoice', async () => {
    const client = new CheckoutPageApiClient({ apiKey: 'k' });
    const result = await client.invoices.regenerate('507f1f77bcf86cd799439011');
    expect(result.id).toBe('507f1f77bcf86cd799439011');
    expect(result.invoiceUrl).toBe('https://x.example/y.pdf');
  });
});
