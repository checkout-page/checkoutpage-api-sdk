import { beforeAll, describe, expect, it } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { NotFoundError, ValidationError } from '../../errors';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { createImageFile, fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';
import { FileResource } from './files';

describe('FileResource integration tests', () => {
  let apiClient: CheckoutPageApiClient;
  let files: FileResource;

  const createDocumentFile = (name = `document-${uniqueSuffix()}.txt`) => {
    const content = `File integration test ${uniqueSuffix()}`;
    return new File([new Blob([content], { type: 'text/plain' })], name, {
      type: 'text/plain',
    });
  };

  const uploadImage = async () => {
    return files.upload({
      file: createImageFile(`image-${uniqueSuffix()}.png`),
      purpose: 'image',
    });
  };

  const uploadDocument = async () => {
    return files.upload({
      file: createDocumentFile(),
      purpose: 'file',
    });
  };

  beforeAll(() => {
    const config = loadIntegrationConfig();
    apiClient = new CheckoutPageApiClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    files = new FileResource(apiClient);
  });

  describe('upload', () => {
    it('uploads an image file', async () => {
      const result = await uploadImage();

      expect(result.data.id).toBeTypeOf('string');
      expect(result.data.location).toContain('http');
      expect(result.data.name).toContain('.png');
      expect(result.data.purpose).toBe('image');
      expect(result.data.type).toBe('image/png');
      expect(result.data.size).toBeGreaterThan(0);
      expect(result.data.width).toBeDefined();
      expect(result.data.height).toBeDefined();
    });

    it('uploads a document file', async () => {
      const result = await uploadDocument();

      expect(result.data.id).toBeTypeOf('string');
      expect(result.data.location).toContain('http');
      expect(result.data.name).toContain('.txt');
      expect(result.data.purpose).toBe('file');
      expect(result.data.type).toBe('text/plain');
      expect(result.data.size).toBeGreaterThan(0);
      expect(result.data.width).toBeUndefined();
      expect(result.data.height).toBeUndefined();
    });
  });

  describe('download', () => {
    it('downloads an uploaded document file and returns a presigned url', async () => {
      const uploaded = await uploadDocument();
      const result = await files.download(uploaded.data.id);

      expect(result.data.url).toContain('http');
      expect(result.data.expiresIn).toBeGreaterThan(0);
    });

    it('returns a positive expiresIn value', async () => {
      const uploaded = await uploadDocument();
      const result = await files.download(uploaded.data.id);

      expect(typeof result.data.expiresIn).toBe('number');
      expect(result.data.expiresIn).toBeGreaterThan(0);
    });

    it('returns a usable presigned url for a newly uploaded file', async () => {
      const uploaded = await uploadDocument();
      const result = await files.download(uploaded.data.id);

      expect(result.data.url).toContain(uploaded.data.name);
      expect(result.data.url).toContain('http');
    });

    it('uploads downloads and deletes a document file', async () => {
      const uploaded = await uploadDocument();
      const downloaded = await files.download(uploaded.data.id);
      const deleted = await files.delete(uploaded.data.id);

      expect(downloaded.data.url).toContain('http');
      expect(downloaded.data.expiresIn).toBeGreaterThan(0);
      expect(deleted.data.success).toBe(true);
      expect(deleted.data.message).toBeTypeOf('string');
    }, 15000);

    it('fails when downloading an uploaded image file', async () => {
      const uploaded = await uploadImage();

      await expect(files.download(uploaded.data.id)).rejects.toThrow(ValidationError);
    });

    it('fails for a deleted file', async () => {
      const uploaded = await uploadDocument();
      await files.delete(uploaded.data.id);

      await expect(files.download(uploaded.data.id)).rejects.toThrow(NotFoundError);
    }, 15000);

    it('fails for an unknown file id', async () => {
      await expect(files.download(fakeObjectId('missingfile'))).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed file id', async () => {
      await expect(files.download('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('deletes an uploaded image file', async () => {
      const uploaded = await uploadImage();
      const result = await files.delete(uploaded.data.id);

      expect(result.data.success).toBe(true);
      expect(result.data.message).toBeTypeOf('string');
    }, 15000);

    it('deletes an uploaded document file', async () => {
      const uploaded = await uploadDocument();
      const result = await files.delete(uploaded.data.id);

      expect(result.data.success).toBe(true);
      expect(result.data.message).toBeTypeOf('string');
    }, 15000);

    it('returns a success payload with success and message', async () => {
      const uploaded = await uploadDocument();
      const result = await files.delete(uploaded.data.id);

      expect(result.data.success).toBe(true);
      expect(result.data.message.length).toBeGreaterThan(0);
    }, 15000);

    it('uploads a file and then deletes it', async () => {
      const uploaded = await uploadDocument();
      const result = await files.delete(uploaded.data.id);

      expect(uploaded.data.id).toBeTypeOf('string');
      expect(result.data.success).toBe(true);
    }, 15000);

    it('fails when deleting the same file twice', async () => {
      const uploaded = await uploadDocument();
      await files.delete(uploaded.data.id);

      await expect(files.delete(uploaded.data.id)).rejects.toThrow(NotFoundError);
    }, 20000);

    it('fails for an unknown file id', async () => {
      await expect(files.delete(fakeObjectId('missingfile'))).rejects.toThrow(NotFoundError);
    });

    it('fails for a malformed file id', async () => {
      await expect(files.delete('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });
});
