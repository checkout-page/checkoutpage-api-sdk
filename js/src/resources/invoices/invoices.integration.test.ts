import { beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('InvoiceResource integration tests', () => {
  let client: CheckoutPageClient;

  const config = loadIntegrationConfig();

  beforeAll(() => {
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch a list of invoices', async () => {
      const result = await client.invoices.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
      expect(result.data.length).toBeGreaterThan(0);

      for (const invoice of result.data) {
        expect(invoice).toHaveProperty('id');
        expect(invoice).toHaveProperty('amount');
        expect(invoice).toHaveProperty('status');
        expect(invoice).toHaveProperty('createdAt');
        expect(invoice).toHaveProperty('updatedAt');
        expect(typeof invoice.id).toBe('string');
        expect(typeof invoice.amount).toBe('number');
      }
    });

    it('should respect limit pagination parameter', async () => {
      const result = await client.invoices.list({ limit: 2 });
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      const firstPage = await client.invoices.list({ limit: 1 });
      if (firstPage.data.length === 0) {
        throw new Error('No invoices found for starting_after pagination test');
      }

      const secondPage = await client.invoices.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      if (secondPage.data.length === 0) return;
      expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
      expect(firstPage.data[0].id.localeCompare(secondPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      const moveAwayFromStart = await client.invoices.list({ limit: 5 });
      if (moveAwayFromStart.data.length < 2) {
        throw new Error('Need at least 2 invoices for ending_before pagination test');
      }

      const firstPage = await client.invoices.list({
        limit: 1,
        starting_after: moveAwayFromStart.data[moveAwayFromStart.data.length - 1].id,
      });
      if (firstPage.data.length === 0) return;

      const previousPage = await client.invoices.list({
        limit: 1,
        ending_before: firstPage.data[0].id,
      });

      if (previousPage.data.length === 0) return;
      expect(firstPage.data[0].id).not.toBe(previousPage.data[0].id);
      expect(previousPage.data[0].id.localeCompare(firstPage.data[0].id)).toBeGreaterThanOrEqual(0);
    });

    it('should filter invoices by status', async () => {
      const result = await client.invoices.list({ status: 'paid', limit: 5 });

      expect(Array.isArray(result.data)).toBe(true);
      for (const invoice of result.data) {
        expect(invoice.status).toBe('paid');
      }
    });

    it('should filter invoices by customerId if available', async () => {
      const baseline = await client.invoices.list({ limit: 10 });
      const target = baseline.data.find((i) => i.customerId);

      if (!target?.customerId) {
        throw new Error('No invoice with customerId found for filter test');
      }

      const filtered = await client.invoices.list({ customerId: target.customerId });
      expect(Array.isArray(filtered.data)).toBe(true);
      for (const invoice of filtered.data) {
        expect(invoice.customerId).toBe(target.customerId);
      }
    });

    it('should filter invoices by chargeId if available', async () => {
      const baseline = await client.invoices.list({ limit: 10 });
      const target = baseline.data.find((i) => i.chargeId);

      if (!target?.chargeId) {
        throw new Error('No invoice with chargeId found for filter test');
      }

      const filtered = await client.invoices.list({ chargeId: target.chargeId });
      expect(Array.isArray(filtered.data)).toBe(true);
      for (const invoice of filtered.data) {
        expect(invoice.chargeId).toBe(target.chargeId);
      }
    });

    it('should filter invoices by poNumber if available', async () => {
      const baseline = await client.invoices.list({
        chargeId: config.testInvoiceChargeId,
        limit: 10,
      });
      console.log(baseline);
      const target = baseline.data.find((i) => i.poNumber);

      if (!target?.poNumber) {
        console.log('Skipping: no invoice with a poNumber exists for this seller');
        return;
      }

      const filtered = await client.invoices.list({ poNumber: target.poNumber });
      expect(Array.isArray(filtered.data)).toBe(true);
      expect(filtered.data.length).toBeGreaterThan(0);
      for (const invoice of filtered.data) {
        expect(invoice.poNumber).toBe(target.poNumber);
      }
    });

    it('should support searching invoices by customer email', async () => {
      const baseline = await client.invoices.list({ limit: 10 });
      const target = baseline.data.find((i) => i.customerEmail);

      if (!target?.customerEmail) {
        throw new Error('No invoice with customerEmail found for search test');
      }

      const searchResult = await client.invoices.list({ search: target.customerEmail });
      expect(Array.isArray(searchResult.data)).toBe(true);
      expect(searchResult.data.length).toBeGreaterThan(0);
    });

    it('should support searching invoices by invoice number', async () => {
      const baseline = await client.invoices.list({ limit: 10 });
      const target = baseline.data.find((i) => i.invoiceNumber);

      if (!target?.invoiceNumber) {
        throw new Error('No invoice with invoiceNumber found for search test');
      }

      const searchResult = await client.invoices.list({ search: target.invoiceNumber });
      expect(Array.isArray(searchResult.data)).toBe(true);
      expect(searchResult.data.some((i) => i.id === target.id)).toBe(true);
    });

    it('should filter by createdAfter / createdBefore date range', async () => {
      const result = await client.invoices.list({
        createdAfter: '2020-01-01T00:00:00Z',
        createdBefore: '2099-12-31T23:59:59Z',
        limit: 5,
      });
      expect(Array.isArray(result.data)).toBe(true);
      for (const invoice of result.data) {
        expect(typeof invoice.createdAt).toBe('string');
      }
    });

    it('should combine multiple filters', async () => {
      const result = await client.invoices.list({ status: 'paid', limit: 5 });

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
      for (const invoice of result.data) {
        expect(invoice.status).toBe('paid');
      }
    });

    it('should expose invoiceUrl as a string when the invoice has a generated PDF', async () => {
      const result = await client.invoices.list({ limit: 25 });
      const target = result.data.find((i) => i.invoiceUrl);

      if (!target?.invoiceUrl) {
        throw new Error('No invoice with invoiceUrl found for PDF-URL test');
      }
      expect(typeof target.invoiceUrl).toBe('string');
      expect(target.invoiceUrl).toMatch(/^https?:\/\//);
    });
  });

  it('regenerates a real invoice end-to-end', async () => {
    const { data } = await client.invoices.list({ limit: 1 });
    if (data.length === 0) {
      console.warn('No invoices found for integration test; skipping');
      return;
    }
    const target = data[0];

    const updated = await client.invoices.regenerate(target.id);

    expect(updated.id).toBe(target.id);
    expect(updated.invoiceUrl).toMatch(/^https?:\/\//);
    expect(updated.invoiceUrl).not.toBe(target.invoiceUrl);
  });
});
