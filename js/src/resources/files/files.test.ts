import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileResource } from './files';
import { CheckoutPageApiClient } from '../../client';
import type { UploadFileResponse, UploadFileParams } from '../../types';

describe('FileResource', () => {
  let client: CheckoutPageApiClient;
  let fileResource: FileResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    fileResource = new FileResource(client);
  });

  describe('upload', () => {
    it('should upload an image file with required fields', async () => {
      const mockFile = new File(['test content'], 'test-image.jpg', { type: 'image/jpeg' });

      const params: UploadFileParams = {
        file: mockFile,
        purpose: 'image',
      };

      const mockResponse: UploadFileResponse = {
        data: {
          id: '507f1f77bcf86cd799439011',
          location: 'https://checkoutpage-images.s3.amazonaws.com/test-image.jpg',
          name: 'test-image.jpg',
          purpose: 'image',
          type: 'image/jpeg',
          size: 12345,
          width: 1920,
          height: 1080,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await fileResource.upload(params);

      expect(result).toEqual(mockResponse);
      expect(result.data.id).toBe('507f1f77bcf86cd799439011');
      expect(result.data.purpose).toBe('image');

      // Verify request was called correctly
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/files/upload',
        formData: expect.any(FormData),
      });

      // Verify FormData contents
      const callArgs = vi.mocked(client.request).mock.calls[0][0];
      const formData = callArgs.formData as FormData;
      expect(formData.get('purpose')).toBe('image');
      expect(formData.get('file')).toBe(mockFile);
    });

    it('should upload a private file', async () => {
      const mockFile = new File(['pdf content'], 'document.pdf', {
        type: 'application/pdf',
      });

      const params: UploadFileParams = {
        file: mockFile,
        purpose: 'file',
      };

      const mockResponse: UploadFileResponse = {
        data: {
          id: '507f1f77bcf86cd799439012',
          location: 'https://checkoutpage-files.s3.amazonaws.com/document.pdf',
          name: 'document.pdf',
          purpose: 'file',
          type: 'application/pdf',
          size: 54321,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await fileResource.upload(params);

      expect(result).toEqual(mockResponse);
      expect(result.data.purpose).toBe('file');
      expect(result.data.type).toBe('application/pdf');

      // Verify FormData contents
      const callArgs = vi.mocked(client.request).mock.calls[0][0];
      const formData = callArgs.formData as FormData;
      expect(formData.get('purpose')).toBe('file');
      expect(formData.get('file')).toBe(mockFile);
    });

    it('should upload using Blob instead of File', async () => {
      const mockBlob = new Blob(['blob content'], { type: 'image/png' });

      const params: UploadFileParams = {
        file: mockBlob,
        purpose: 'image',
      };

      const mockResponse: UploadFileResponse = {
        data: {
          id: '507f1f77bcf86cd799439013',
          location: 'https://checkoutpage-images.s3.amazonaws.com/blob.png',
          name: 'blob.png',
          purpose: 'image',
          type: 'image/png',
          size: 9876,
          width: 800,
          height: 600,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await fileResource.upload(params);

      expect(result).toEqual(mockResponse);
      expect(client.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1/files/upload',
        formData: expect.any(FormData),
      });
    });

    it('should throw error for missing file', async () => {
      const params = {
        file: null as unknown as File,
        purpose: 'image' as const,
      };

      await expect(fileResource.upload(params)).rejects.toThrow('File is required');
    });

    it('should throw error for missing purpose', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const params = {
        file: mockFile,
        purpose: null as unknown as 'image',
      };

      await expect(fileResource.upload(params)).rejects.toThrow('Purpose is required');
    });

    it('should return image dimensions for image uploads', async () => {
      const mockFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

      const params: UploadFileParams = {
        file: mockFile,
        purpose: 'image',
      };

      const mockResponse: UploadFileResponse = {
        data: {
          id: '507f1f77bcf86cd799439014',
          location: 'https://checkoutpage-images.s3.amazonaws.com/photo.jpg',
          name: 'photo.jpg',
          purpose: 'image',
          type: 'image/jpeg',
          size: 245678,
          width: 2048,
          height: 1536,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await fileResource.upload(params);

      expect(result.data.width).toBe(2048);
      expect(result.data.height).toBe(1536);
    });

    it('should not include width/height for non-image files', async () => {
      const mockFile = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

      const params: UploadFileParams = {
        file: mockFile,
        purpose: 'file',
      };

      const mockResponse: UploadFileResponse = {
        data: {
          id: '507f1f77bcf86cd799439015',
          location: 'https://checkoutpage-files.s3.amazonaws.com/doc.pdf',
          name: 'doc.pdf',
          purpose: 'file',
          type: 'application/pdf',
          size: 100000,
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockResponse);

      const result = await fileResource.upload(params);

      expect(result.data.width).toBeUndefined();
      expect(result.data.height).toBeUndefined();
    });
  });
});
