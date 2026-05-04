import { CheckoutPageClient } from '@checkoutpage/sdk';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // Create a tax rate
  const created = await client.taxRates.create({
    displayName: 'VAT',
    inclusive: true,
    percentage: 20,
    default: true,
  });

  console.log('Created tax rate:', created.data);

  // List all tax rates
  const { data: taxRates } = await client.taxRates.list();

  console.log(`Found ${taxRates.length} tax rate(s)`);

  // Update a tax rate
  const updated = await client.taxRates.update(created.data.id, {
    displayName: 'VAT (Updated)',
    default: true,
  });

  console.log('Updated tax rate:', updated.data);
}

main().catch(console.error);
