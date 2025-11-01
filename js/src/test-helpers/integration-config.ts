import * as dotenv from 'dotenv';
import * as path from 'path';

export interface IntegrationConfig {
  apiKey: string;
  baseUrl: string;
  testCustomerId: string;
  testCustomerEmail: string;
  testSellerId: string;
  testTicketId: string;
}

export function loadIntegrationConfig(): IntegrationConfig {
  const envPath = path.join(__dirname, '../../.env.test');
  dotenv.config({ path: envPath });

  const apiKey = process.env.CHECKOUTPAGE_API_KEY;
  const baseUrl = process.env.CHECKOUTPAGE_BASE_URL || 'https://api.checkoutpage.com';
  const testCustomerId = process.env.TEST_CUSTOMER_ID || '';
  const testCustomerEmail = process.env.TEST_CUSTOMER_EMAIL || '';
  const testSellerId = process.env.TEST_SELLER_ID || '';
  const testTicketId = process.env.TEST_TICKET_ID || '';

  if (!apiKey) {
    throw new Error(
      '\nIntegration tests will fail - no API key provided.\n' +
        'To run integration tests:\n' +
        '1. Copy .env.test.example to .env.test\n' +
        '2. Add your CHECKOUTPAGE_API_KEY and test data\n' +
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
  };
}
