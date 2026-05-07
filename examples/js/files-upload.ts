import { CheckoutPageClient } from '@checkoutpage/sdk';
import * as fs from 'fs';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // Example 1: Upload an image file from the filesystem
  console.log('Example 1: Upload image file');
  const imageBuffer = fs.readFileSync('./product-image.jpg');
  const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
  const imageFile = new File([imageBlob], 'product-image.jpg', { type: 'image/jpeg' });

  const imageResult = await client.files.upload({
    file: imageFile,
    purpose: 'image',
  });

  console.log('Image uploaded:', {
    id: imageResult.data.id,
    location: imageResult.data.location,
    size: imageResult.data.size,
    dimensions: `${imageResult.data.width}x${imageResult.data.height}`,
  });

  // Example 2: Upload a private file (PDF)
  console.log('\nExample 2: Upload private file');
  const pdfBuffer = fs.readFileSync('./ebook.pdf');
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const pdfFile = new File([pdfBlob], 'ebook.pdf', { type: 'application/pdf' });

  const fileResult = await client.files.upload({
    file: pdfFile,
    purpose: 'file',
  });

  console.log('File uploaded:', {
    id: fileResult.data.id,
    location: fileResult.data.location,
    size: fileResult.data.size,
  });

  // Example 3: Upload and attach to a product
  console.log('\nExample 3: Create product with uploaded files');
  const page = await client.pages.create({
    name: 'Digital Product with Files',
    type: 'checkout',
    title: 'Premium eBook',
    productData: {
      title: 'Complete Guide to Node.js',
      price: {
        price: 2900,
        currency: 'usd',
      },
      media: [{ fileId: imageResult.data.id }],
      files: [fileResult.data.id],
      taxBehavior: '',
    },
  });

  console.log('Page created with files:', {
    pageId: page.data.id,
    productMedia: page.data.product?.media,
  });
}

main().catch(console.error);
