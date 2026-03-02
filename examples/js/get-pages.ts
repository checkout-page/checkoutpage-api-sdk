import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    // List all pages
    const pages = await checkoutpage.pages.list({
      status: 'published',
      type: 'checkout',
      limit: 10,
    });

    console.log(`Found ${pages.total} pages`);
    console.log('Pages:');
    pages.data.forEach((page) => {
      console.log({
        id: page.id,
        name: page.name,
        type: page.type,
        status: page.status,
      });
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
  }
}

main();
