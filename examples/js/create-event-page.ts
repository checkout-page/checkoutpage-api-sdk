import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    // Create an event page with ticket groups
    const page = await checkoutpage.pages.create({
      name: 'Tech Conference 2024',
      type: 'event',
      title: 'Annual Tech Conference',
      description: 'Join us for the biggest tech event of the year',
      slug: 'tech-conf-2024',
      ticketGroups: [
        {
          name: 'Early Bird Tickets',
          ticketTypes: [
            {
              name: 'General Admission',
              description: 'Full access to all sessions',
              price: 9900, // $99.00 in cents
              pricing: 'paid',
              capacity: 500,
              maxQuantity: 5,
            },
            {
              name: 'VIP Pass',
              description: 'Premium access with exclusive perks',
              price: 24900, // $249.00 in cents
              pricing: 'paid',
              capacity: 100,
              maxQuantity: 2,
            },
          ],
        },
      ],
    });

    console.log('Event page created successfully:');
    console.log({
      id: page.data.id,
      name: page.data.name,
      type: page.data.type,
      status: page.data.status,
    });
  } catch (error) {
    console.error('Error creating event page:', error);
  }
}

main();
