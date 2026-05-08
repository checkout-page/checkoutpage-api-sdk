import { describe, it, expect } from 'vitest';
import { CheckoutPageApiClient } from '../../client';

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL ?? 'https://api.checkoutpage.dev';

describe.skipIf(!apiKey)('InvoiceResource (integration)', () => {
  const client = new CheckoutPageApiClient({ apiKey: apiKey ?? 'placeholder', baseUrl });

  it('returns the wrapped envelope', async () => {
    const result = await client.invoices.list({ limit: 5 });
    expect(result.data).toBeInstanceOf(Array);
    expect(typeof result.has_more).toBe('boolean');
    expect(typeof result.total).toBe('number');
  });

  it('respects the limit param', async () => {
    const result = await client.invoices.list({ limit: 1 });
    expect(result.data.length).toBeLessThanOrEqual(1);
  });

  it('filters by status=paid (every returned invoice has status paid)', async () => {
    const result = await client.invoices.list({ status: 'paid', limit: 5 });
    for (const invoice of result.data) {
      expect(invoice.status).toBe('paid');
    }
  });
});
