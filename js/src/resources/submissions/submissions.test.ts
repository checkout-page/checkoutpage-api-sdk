import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPageApiClient } from '../../client';
import { SubmissionResource } from './submissions';
import type { SubmissionList, SubmissionResponse } from '../../types';

describe('SubmissionResource', () => {
  let client: CheckoutPageApiClient;
  let submissionResource: SubmissionResource;

  beforeEach(() => {
    client = new CheckoutPageApiClient({ apiKey: 'test_api_key' });
    submissionResource = new SubmissionResource(client);
  });

  describe('get', () => {
    it('should fetch a submission by id', async () => {
      const mockSubmission: SubmissionResponse = {
        data: {
          id: '6812fe6e9f39b6760576f01c',
          status: 'succeeded',
          sellerId: '6812fe6e9f39b6760576f01d',
          customerEmail: 'test@example.com',
          customerName: 'Test Customer',
          formTitle: 'Lead Capture Form',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubmission);

      const result = await submissionResource.get('6812fe6e9f39b6760576f01c');

      expect(result).toEqual(mockSubmission);
      expect(result.data.id).toBe('6812fe6e9f39b6760576f01c');
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/submissions/6812fe6e9f39b6760576f01c',
      });
    });

    it('should throw error for missing submission id', async () => {
      await expect(submissionResource.get('')).rejects.toThrow('Submission ID is required');
    });
  });

  describe('list', () => {
    it('should fetch a list of submissions with default parameters', async () => {
      const mockSubmissionList: SubmissionList = {
        data: [
          {
            id: '6812fe6e9f39b6760576f01c',
            status: 'succeeded',
            sellerId: '6812fe6e9f39b6760576f01d',
            customerEmail: 'john@example.com',
            customerName: 'John Doe',
            formTitle: 'Lead Capture Form',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubmissionList);

      const result = await submissionResource.list({});

      expect(result).toEqual(mockSubmissionList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/submissions/',
        query: {
          search: undefined,
          pageId: undefined,
          customerId: undefined,
          status: undefined,
          createdAfter: undefined,
          createdBefore: undefined,
          limit: undefined,
          starting_after: undefined,
          ending_before: undefined,
        },
      });
    });

    it('should pass through submission list filters and stringifies limit', async () => {
      const mockSubmissionList: SubmissionList = {
        data: [],
        total: 0,
        has_more: false,
      };

      vi.spyOn(client, 'request').mockResolvedValue(mockSubmissionList);

      const result = await submissionResource.list({
        search: 'Lead Capture Form',
        pageId: '507f1f77bcf86cd799439011',
        customerId: '507f1f77bcf86cd799439012',
        status: 'succeeded',
        createdAfter: '2026-03-01T00:00:00Z',
        createdBefore: '2026-03-31T23:59:59Z',
        limit: 10,
        starting_after: '507f1f77bcf86cd799439013',
        ending_before: '507f1f77bcf86cd799439014',
      });

      expect(result).toEqual(mockSubmissionList);
      expect(client.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1/submissions/',
        query: {
          search: 'Lead Capture Form',
          pageId: '507f1f77bcf86cd799439011',
          customerId: '507f1f77bcf86cd799439012',
          status: 'succeeded',
          createdAfter: '2026-03-01T00:00:00Z',
          createdBefore: '2026-03-31T23:59:59Z',
          limit: '10',
          starting_after: '507f1f77bcf86cd799439013',
          ending_before: '507f1f77bcf86cd799439014',
        },
      });
    });

    /**
     * Demonstrates how a consumer drives forward/backward pagination
     * through the SDK: walk forward with `starting_after`, walk back with
     * `ending_before`. The server returns pages newest-first.
     */
    it('demonstrates a forward and backward pagination flow', async () => {
      const stub = (id: string) => ({
        id,
        status: 'succeeded' as const,
        sellerId: 's',
        customerEmail: `${id}@example.com`,
        customerName: id,
        formTitle: 'F',
        createdAt: '',
        updatedAt: '',
      });
      const PAGE_1: SubmissionList = { data: [stub('s5'), stub('s4')], has_more: true, total: 5 };
      const PAGE_2: SubmissionList = { data: [stub('s3'), stub('s2')], has_more: true, total: 5 };

      const spy = vi
        .spyOn(client, 'request')
        .mockResolvedValueOnce(PAGE_1)
        .mockResolvedValueOnce(PAGE_2)
        .mockResolvedValueOnce({ ...PAGE_1, has_more: false });

      await submissionResource.list({ limit: 2 });
      await submissionResource.list({ limit: 2, starting_after: PAGE_1.data[1].id });
      await submissionResource.list({ limit: 2, ending_before: PAGE_2.data[0].id });

      expect(spy.mock.calls[0][0].query.starting_after).toBeUndefined();
      expect(spy.mock.calls[0][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[1][0].query).toMatchObject({ limit: '2', starting_after: 's4' });
      expect(spy.mock.calls[1][0].query.ending_before).toBeUndefined();
      expect(spy.mock.calls[2][0].query).toMatchObject({ limit: '2', ending_before: 's3' });
      expect(spy.mock.calls[2][0].query.starting_after).toBeUndefined();
    });
  });
});
