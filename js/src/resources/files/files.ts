import type { CheckoutPageApiClient } from '../../client';
import type {
  DeleteFileResponse,
  DownloadFileResponse,
  UploadFileResponse,
  UploadFileParams,
} from '../../types';

export class FileResource {
  constructor(private client: CheckoutPageApiClient) {}

  async upload(params: UploadFileParams): Promise<UploadFileResponse> {
    if (!params.file) {
      throw new Error('File is required');
    }

    if (!params.purpose) {
      throw new Error('Purpose is required');
    }

    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('purpose', params.purpose);

    return this.client.request<UploadFileResponse>({
      method: 'POST',
      path: '/v1/files/upload',
      formData,
    });
  }

  async delete(fileId: string): Promise<DeleteFileResponse> {
    if (!fileId) {
      throw new Error('File ID is required');
    }

    return this.client.request<DeleteFileResponse>({
      method: 'DELETE',
      path: `/v1/files/${fileId}`,
    });
  }

  async download(fileId: string): Promise<DownloadFileResponse> {
    if (!fileId) {
      throw new Error('File ID is required');
    }

    return this.client.request<DownloadFileResponse>({
      method: 'GET',
      path: `/v1/files/${fileId}/download`,
    });
  }
}
