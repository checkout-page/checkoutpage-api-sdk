import { CheckoutPage } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = new CheckoutPage({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const results = await checkoutpage.payments.list();

    console.log('Payments retrieved successfully:');
    console.log(results);
  } catch (error) {
    console.error('Error fetching payments:', error);
  }
}

main();
