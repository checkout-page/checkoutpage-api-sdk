import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  const subscriptionId = process.argv[2];
  if (!subscriptionId) {
    console.error('Usage: tsx subscription-payments-by-subscription.ts <subscriptionId>');
    process.exit(1);
  }

  try {
    const results = await checkoutpage.subscriptionPayments.list({
      subscriptionId,
      limit: 50,
    });

    console.log(`${results.total} payments for subscription ${subscriptionId}`);
    for (const payment of results.data) {
      console.log(
        `${payment.createdAt} | ${payment.billingReason} | ${payment.amount} | paid=${payment.paid} | ${payment.paymentStatus}`,
      );
    }
  } catch (error) {
    console.error('Error fetching subscription payments:', error);
  }
}

main();
