import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const pageId = 'YOUR_PAGE_ID';

    // Add a custom field to a page
    const fields = await checkoutpage.pageFields.create(pageId, {
      type: 'select',
      label: 'Company Size',
      placeholder: 'Select your company size',
      helpText: 'Choose the option that best describes your company',
      required: true,
      options: ['1-10 employees', '11-50 employees', '51-200 employees', '200+ employees'],
    });

    console.log('Field added successfully:');
    console.log(fields.data);
  } catch (error) {
    console.error('Error adding field:', error);
  }
}

main();
