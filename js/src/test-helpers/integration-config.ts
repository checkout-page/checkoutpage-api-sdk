import * as dotenv from 'dotenv';
import * as path from 'path';

export interface IntegrationConfig {
  apiKey: string;
  baseUrl: string;
  testCustomerId: string;
  testCustomerEmail: string;
  testSellerId: string;
  testTicketId: string;
  testTicketTypeId: string;
  testTicketTypePageId: string;
  testCheckoutPageId: string;
  testInvoiceId: string;
  testInvoiceChargeId: string;
}

export function loadIntegrationConfig(): IntegrationConfig {
  const envPath = path.join(__dirname, '../../.env.test');
  dotenv.config({ path: envPath });

  const apiKey = process.env.CHECKOUTPAGE_API_KEY;
  const baseUrl = process.env.CHECKOUTPAGE_BASE_URL;
  const testCustomerId = process.env.TEST_CUSTOMER_ID || '';
  const testCustomerEmail = process.env.TEST_CUSTOMER_EMAIL || '';
  const testSellerId = process.env.TEST_SELLER_ID || '';
  const testTicketId = process.env.TEST_TICKET_ID || '';
  const testTicketTypeId = process.env.TEST_TICKET_TYPE_ID || '';
  const testTicketTypePageId = process.env.TEST_TICKET_TYPE_PAGE_ID || '';
  const testCheckoutPageId = process.env.TEST_CHECKOUT_PAGE_ID || '';
  const testInvoiceId = process.env.TEST_INVOICE_ID || '';
  const testInvoiceChargeId = process.env.TEST_INVOICE_CHARGE_ID || '';

  if (!apiKey) {
    throw new Error(
      '\nIntegration tests will fail - no API key provided.\n' +
        'To run integration tests:\n' +
        '1. Copy .env.test.example to .env.test\n' +
        '2. Add your CHECKOUTPAGE_API_KEY and test data\n' +
        '3. Run: pnpm test:integration\n'
    );
  }

  // No default: an unset base URL used to silently target production, so a
  // half-filled .env.test ran create/update/delete against a live seller.
  if (!baseUrl) {
    throw new Error(
      '\nIntegration tests will fail - no base URL provided.\n' +
        'To run integration tests:\n' +
        '1. Copy .env.test.example to .env.test\n' +
        '2. Set CHECKOUTPAGE_BASE_URL explicitly (there is no default — production is never assumed)\n' +
        '3. Run: pnpm test:integration\n'
    );
  }

  return {
    apiKey,
    baseUrl,
    testCustomerId,
    testCustomerEmail,
    testSellerId,
    testTicketId,
    testTicketTypeId,
    testTicketTypePageId,
    testCheckoutPageId,
    testInvoiceId,
    testInvoiceChargeId,
  };
}
