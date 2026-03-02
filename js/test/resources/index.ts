/**
 * Test resource loader for file upload tests
 */
import fs from 'fs';
import path from 'path';

export type TestImageType = 'png' | 'jpg' | 'webp' | 'gif';
export type TestDocumentType = 'pdf';

const TEST_RESOURCES_DIR = __dirname;

/**
 * Load a test image file
 */
export function loadTestImage(type: TestImageType = 'png'): Buffer {
  const filePath = path.join(TEST_RESOURCES_DIR, `test-image.${type}`);
  return fs.readFileSync(filePath);
}

/**
 * Load a test document file
 */
export function loadTestDocument(type: TestDocumentType = 'pdf'): Buffer {
  const filePath = path.join(TEST_RESOURCES_DIR, `test-document.${type}`);
  return fs.readFileSync(filePath);
}

/**
 * Create a File object from a test image (for browser-like environments)
 */
export function createTestImageFile(type: TestImageType = 'png', filename?: string): File {
  const buffer = loadTestImage(type);
  const mimeType = `image/${type === 'jpg' ? 'jpeg' : type}`;
  const name = filename || `test-image.${type}`;
  const blob = new Blob([buffer], { type: mimeType });
  return new File([blob], name, { type: mimeType });
}

/**
 * Create a File object from a test document (for browser-like environments)
 */
export function createTestDocumentFile(type: TestDocumentType = 'pdf', filename?: string): File {
  const buffer = loadTestDocument(type);
  const mimeType = type === 'pdf' ? 'application/pdf' : 'application/octet-stream';
  const name = filename || `test-document.${type}`;
  const blob = new Blob([buffer], { type: mimeType });
  return new File([blob], name, { type: mimeType });
}

/**
 * Get the path to a test resource file
 */
export function getTestResourcePath(filename: string): string {
  return path.join(TEST_RESOURCES_DIR, filename);
}

export const testResources = {
  images: {
    png: () => loadTestImage('png'),
    jpg: () => loadTestImage('jpg'),
    webp: () => loadTestImage('webp'),
    gif: () => loadTestImage('gif'),
  },
  documents: {
    pdf: () => loadTestDocument('pdf'),
  },
  files: {
    png: (name?: string) => createTestImageFile('png', name),
    jpg: (name?: string) => createTestImageFile('jpg', name),
    webp: (name?: string) => createTestImageFile('webp', name),
    gif: (name?: string) => createTestImageFile('gif', name),
    pdf: (name?: string) => createTestDocumentFile('pdf', name),
  },
};
