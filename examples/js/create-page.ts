import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    // Create a checkout page
    const page = await checkoutpage.pages.create({
      name: 'Summer Sale Checkout',
      type: 'checkout',
      title: 'Buy Now - 50% Off',
      description: 'Limited time summer sale',
      slug: 'summer-sale',
      price: 4900, // $49.00 in cents
      currency: 'usd',
      layoutType: 'modern',
    });

    console.log('Page created successfully:');
    console.log({
      id: page.data.id,
      name: page.data.name,
      type: page.data.type,
      status: page.data.status,
    });
  } catch (error) {
    console.error('Error creating page:', error);
  }
}

main();
