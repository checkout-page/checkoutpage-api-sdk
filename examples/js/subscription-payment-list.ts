import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const results = await checkoutpage.subscriptionPayments.list({ limit: 10 });

    console.log(`Found ${results.total} subscription payments`);
    for (const payment of results.data) {
      console.log(
        `${payment.createdAt} | ${payment.customerEmail ?? 'unknown'} | ${payment.amount} ${payment.currency ?? ''} | ${payment.paymentStatus}`,
      );
    }
  } catch (error) {
    console.error('Error fetching subscription payments:', error);
  }
}

main();
