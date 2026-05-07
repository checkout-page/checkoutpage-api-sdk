import type { CheckoutPageApiClient } from '../../client';
import type { SubmissionList, SubmissionListParams, SubmissionResponse } from '../../types';

export class SubmissionResource {
  constructor(private client: CheckoutPageApiClient) {}

  async get(submissionId: string): Promise<SubmissionResponse> {
    if (!submissionId) {
      throw new Error('Submission ID is required');
    }

    return this.client.request<SubmissionResponse>({
      method: 'GET',
      path: `/v1/submissions/${submissionId}`,
    });
  }

  async list(args: SubmissionListParams = {}): Promise<SubmissionList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      pageId: args.pageId,
      customerId: args.customerId,
      status: args.status,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<SubmissionList>({
      method: 'GET',
      path: '/v1/submissions/',
      query,
    });
  }
}
