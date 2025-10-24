import { CheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = new CheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    // Get a customer by ID
    const customer = await checkoutpage.customers.get('6812fe6e9f39b6760576f01c');

    console.log('Customer retrieved successfully:');
    console.log({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      createdAt: customer.createdAt,
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
  }
}

main();
