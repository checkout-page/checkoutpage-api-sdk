import { createCheckoutPageClient } from '@checkoutpage/sdk';

async function main() {
  // Initialize the SDK with your API key
  const checkoutpage = createCheckoutPageClient({
    apiKey: process.env.CHECKOUTPAGE_API_KEY || 'YOUR_API_KEY',
  });

  try {
    const productId = 'YOUR_PRODUCT_ID';

    // Update product details
    const product = await checkoutpage.products.update(productId, {
      title: 'Updated Product Title',
      description: 'Updated product description with more details',
      price: 5900, // $59.00 in cents
      stock: 100,
      hasUnlimitedStock: false,
    });

    console.log('Product updated successfully:');
    console.log({
      id: product.data.id,
      title: product.data.title,
      price: product.data.price,
      stock: product.data.stock,
    });
  } catch (error) {
    console.error('Error updating product:', error);
  }
}

main();
