import type { CheckoutPageApiClient } from '../../client';
import type { UploadFileResponse, UploadFileParams } from '../../types';

export class FileResource {
  constructor(private client: CheckoutPageApiClient) {}

  async upload(params: UploadFileParams): Promise<UploadFileResponse> {
    if (!params.file) {
      throw new Error('File is required');
    }

    if (!params.purpose) {
      throw new Error('Purpose is required');
    }

    // Create FormData for multipart/form-data upload
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('purpose', params.purpose);

    return this.client.request<UploadFileResponse>({
      method: 'POST',
      path: '/v1/files/upload',
      formData,
    });
  }
}
