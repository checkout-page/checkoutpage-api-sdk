import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const results = await checkoutpage.coupons.list();

    console.log('Coupons retrieved successfully:');
    console.log(results);
  } catch (error) {
    console.error('Error fetching coupons:', error);
  }
}

main();
