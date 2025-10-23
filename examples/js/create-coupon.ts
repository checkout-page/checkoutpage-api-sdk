import { CheckoutPage } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = new CheckoutPage({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const results = await checkoutpage.coupons.create({
      type: 'amount',
      label: 'Spring Sale',
      code: 'SPRING25',
      amountOff: 2500,
      currency: 'usd',
      duration: 'once',
    });

    console.log('Coupon successfully created');
    console.log(results);
  } catch (error) {
    console.error('Error creating coupon:', error);
  }
}

main();
