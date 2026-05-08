import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutPageApiClient } from '../../client';

describe('InvoiceResource.list', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: [], has_more: false, total: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('GETs /v1/invoices/ with the bearer token', async () => {
    const client = new CheckoutPageApiClient({ apiKey: 'k', baseUrl: 'https://api.example.com' });
    await client.invoices.list();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/invoices/');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer k');
  });

  it('serializes filters and pagination params', async () => {
    const client = new CheckoutPageApiClient({ apiKey: 'k', baseUrl: 'https://api.example.com' });
    await client.invoices.list({
      status: 'paid',
      customerId: '507f1f77bcf86cd799439011',
      chargeId: '507f1f77bcf86cd799439012',
      customerEmail: 'jane@example.com',
      poNumber: 'PO-1',
      limit: 25,
      starting_after: '507f1f77bcf86cd799439013',
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('status=paid');
    expect(url).toContain('customerId=507f1f77bcf86cd799439011');
    expect(url).toContain('chargeId=507f1f77bcf86cd799439012');
    expect(url).toContain('customerEmail=jane%40example.com');
    expect(url).toContain('poNumber=PO-1');
    expect(url).toContain('limit=25');
    expect(url).toContain('starting_after=507f1f77bcf86cd799439013');
  });

  it('returns the wrapped envelope (data + has_more + total)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: [{ id: 'inv_1' }], has_more: true, total: 42 }),
    });
    const client = new CheckoutPageApiClient({ apiKey: 'k' });
    const result = await client.invoices.list();
    expect(result.data).toEqual([{ id: 'inv_1' }]);
    expect(result.has_more).toBe(true);
    expect(result.total).toBe(42);
  });
});
