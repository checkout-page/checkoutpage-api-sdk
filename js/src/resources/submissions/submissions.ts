import type { CheckoutPageApiClient } from '../../client';
import type {
  CancelSubmissionParams,
  CancelSubmissionResponse,
  ReadOptions,
  SubmissionList,
  SubmissionListParams,
  SubmissionResponse,
} from '../../types';

export class SubmissionResource {
  constructor(private client: CheckoutPageApiClient) {}

  async get(submissionId: string, options: ReadOptions = {}): Promise<SubmissionResponse> {
    if (!submissionId) {
      throw new Error('Submission ID is required');
    }

    return this.client.request<SubmissionResponse>({
      method: 'GET',
      path: `/v1/submissions/${submissionId}`,
      query: { livemode: options.livemode?.toString() },
    });
  }

  async list(args: SubmissionListParams = {}): Promise<SubmissionList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      pageId: args.pageId,
      customerId: args.customerId,
      status: args.status,
      orderStatus: args.orderStatus,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      livemode: args.livemode?.toString(),
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

  /**
   * Cancel a form submission. A cancel is final and cannot be undone; the submission is
   * returned with `orderStatus: 'canceled'`. Fires the `submission.canceled` webhook.
   *
   * Throws a `ValidationError` when the submission is already canceled and a
   * `NotFoundError` for an unknown id.
   *
   * @example
   * const { data: submission } = await client.submissions.cancel(submissionId, {
   *   reason: 'Duplicate registration',
   *   sendCancellationEmail: true,
   * });
   */
  async cancel(
    submissionId: string,
    params: CancelSubmissionParams
  ): Promise<CancelSubmissionResponse> {
    if (!submissionId) {
      throw new Error('Submission ID is required');
    }

    return this.client.request<CancelSubmissionResponse>({
      method: 'POST',
      path: `/v1/submissions/${encodeURIComponent(submissionId)}/cancel`,
      body: params,
    });
  }
}
