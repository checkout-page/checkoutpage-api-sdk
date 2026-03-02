import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient } from '../../index';

describe('FileResource Integration Tests', () => {
  let client: CheckoutPageClient;

  beforeAll(() => {
    const apiKey = process.env.CHECKOUTPAGE_API_KEY;

    if (!apiKey) {
      console.warn('Skipping integration tests: CHECKOUTPAGE_API_KEY not set');
      return;
    }

    client = new CheckoutPageClient({ apiKey });
  });

  it('should upload an image file', async () => {
    if (!client) {
      console.log('Skipping: No API key');
      return;
    }

    // Create a test image file (1x1 red pixel PNG)
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    const file = new File([blob], 'test-image.png', { type: 'image/png' });

    const result = await client.files.upload({
      file,
      purpose: 'image',
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBeDefined();
    expect(result.data.location).toBeDefined();
    expect(result.data.name).toBeDefined();
    expect(result.data.purpose).toBe('image');
    expect(result.data.type).toBe('image/png');
    expect(result.data.size).toBeGreaterThan(0);

    // Images should have width and height
    expect(result.data.width).toBeDefined();
    expect(result.data.height).toBeDefined();

    console.log('Uploaded image:', {
      id: result.data.id,
      location: result.data.location,
      size: result.data.size,
      dimensions: `${result.data.width}x${result.data.height}`,
    });
  });

  it('should upload a file (non-image)', async () => {
    if (!client) return;

    // Create a test text file
    const textContent = 'This is a test document for integration testing.';
    const blob = new Blob([textContent], { type: 'text/plain' });
    const file = new File([blob], 'test-document.txt', { type: 'text/plain' });

    const result = await client.files.upload({
      file,
      purpose: 'file',
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBeDefined();
    expect(result.data.location).toBeDefined();
    expect(result.data.name).toBeDefined();
    expect(result.data.purpose).toBe('file');
    expect(result.data.size).toBe(textContent.length);

    console.log('Uploaded file:', {
      id: result.data.id,
      location: result.data.location,
      size: result.data.size,
    });
  });

  it('should upload using Blob', async () => {
    if (!client) return;

    // Create a blob without File wrapper
    const content = 'Blob content test';
    const blob = new Blob([content], { type: 'text/plain' });

    const result = await client.files.upload({
      file: blob,
      purpose: 'file',
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBeDefined();
    expect(result.data.size).toBe(content.length);

    console.log('Uploaded blob:', {
      id: result.data.id,
      size: result.data.size,
    });
  });
});
