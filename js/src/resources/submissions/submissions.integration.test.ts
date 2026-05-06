import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { CreateFormParams } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { uniqueSuffix } from '../../test-helpers/test-lib';

describe('SubmissionResource integration tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let createdPageIds: string[] = [];
  let primaryForm:
    | {
        id: string;
        title?: string | null;
      }
    | undefined;
  let secondaryForm:
    | {
        id: string;
        title?: string | null;
      }
    | undefined;
  let primarySubmission:
    | {
        submissionId: string;
        email: string;
        name: string;
        customerId?: string | null;
        createdAt?: string;
      }
    | undefined;
  let secondarySubmission:
    | {
        submissionId: string;
        email: string;
        name: string;
        customerId?: string | null;
        createdAt?: string;
      }
    | undefined;

  const rememberPage = (pageId: string) => {
    createdPageIds.push(pageId);
  };

  const createForm = async (overrides: Partial<CreateFormParams> = {}) => {
    const suffix = uniqueSuffix();
    const params: CreateFormParams = {
      name: `SDK Submission Form ${suffix}`,
      title: `SDK Submission Form Title ${suffix}`,
      fields: [
        {
          label: 'Email',
          element: 'email',
          type: 'email',
          required: true,
        },
        {
          label: 'Name',
          element: 'text',
          type: 'name',
          required: true,
        },
      ],
      ...overrides,
    };

    const response = await client.forms.create(params);
    rememberPage(response.data.id);
    return response;
  };

  const createSubmissionForForm = async (pageId: string) => {
    const email = `sdk-submission-${uniqueSuffix()}@example.com`;
    const name = `SDK Submission ${uniqueSuffix()}`;
    const requestBody = JSON.stringify({
      pageId,
      sellerId: config.testSellerId,
      livemode: true,
      email,
      name,
      fields: [
        {
          label: 'Email',
          element: 'email',
          type: 'email',
          value: email,
        },
        {
          label: 'Name',
          element: 'text',
          type: 'name',
          value: name,
        },
      ],
    });

    let response: Response | undefined;
    let lastBody = '';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(new URL(`/api/v1/checkout/${pageId}/submissions`, config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (response.ok) {
        break;
      }

      lastBody = await response.text();

      if (response.status !== 429 || attempt === 3) {
        throw new Error(
          `Failed to create submission: ${response.status} ${response.statusText} ${lastBody}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }

    const payload = (await response!.json()) as { data: { _id?: string; id?: string } };
    const submissionId = payload.data?._id ?? payload.data?.id;

    if (!submissionId) {
      throw new Error('Submission creation did not return an ID');
    }

    return {
      submissionId,
      email,
      name,
    };
  };

  beforeAll(async () => {
    config = loadIntegrationConfig();
    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    const primaryToken = `SDK submission title ${uniqueSuffix()}`;
    const firstFormResponse = await createForm({
      name: primaryToken,
      title: primaryToken,
    });
    primaryForm = {
      id: firstFormResponse.data.id,
      title: firstFormResponse.data.title,
    };
    primarySubmission = await createSubmissionForForm(primaryForm.id);

    const secondFormResponse = await createForm({
      name: `SDK Submission Secondary ${uniqueSuffix()}`,
      title: `SDK Submission Secondary ${uniqueSuffix()}`,
    });
    secondaryForm = {
      id: secondFormResponse.data.id,
      title: secondFormResponse.data.title,
    };
    secondarySubmission = await createSubmissionForForm(secondaryForm.id);
  });

  afterAll(async () => {
    for (const pageId of [...createdPageIds].reverse()) {
      try {
        await client.forms.delete(pageId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    createdPageIds = [];
  });

  describe('get', () => {
    it('should fetch a real submission by ID', async () => {
      if (!primaryForm || !primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const { data: submission } = await client.submissions.get(primarySubmission.submissionId);

      expect(submission.id).toBe(primarySubmission.submissionId);
      expect(submission.status).toBe('succeeded');
      expect(submission.customerEmail).toBe(primarySubmission.email.toLowerCase());
      expect(submission.customerName).toBe(primarySubmission.name);
      expect(submission.formTitle).toBe(primaryForm.title);
      expect(submission.pageId).toBe(primaryForm.id);
      expect(typeof submission.createdAt).toBe('string');
      expect(typeof submission.updatedAt).toBe('string');

      primarySubmission.customerId = submission.customerId;
      primarySubmission.createdAt = submission.createdAt;
    });

    it('should throw a NotFoundError for a missing submission ID', async () => {
      await expect(client.submissions.get('6812fe6e9f39b6760576f01c')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError for invalid submission ID', async () => {
      await expect(client.submissions.get('not-a-valid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('should list submissions and include the created submission', async () => {
      if (!primaryForm || !primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const result = await client.submissions.list({
        search: primarySubmission.email,
      });

      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
      expect(typeof result.total).toBe('number');
      expect(result.data.length).toBeGreaterThan(0);

      const submission = result.data.find((item) => item.id === primarySubmission?.submissionId);
      expect(submission).toBeDefined();
      expect(submission?.customerEmail).toBe(primarySubmission.email.toLowerCase());
      expect(submission?.formTitle).toBe(primaryForm.title);
    });

    it('should return a list item shape consistent with get for the seeded fixture', async () => {
      if (!primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const listResult = await client.submissions.list({
        search: primarySubmission.email,
      });
      const listSubmission = listResult.data.find(
        (item) => item.id === primarySubmission?.submissionId
      );
      const { data: getSubmission } = await client.submissions.get(primarySubmission.submissionId);

      expect(listSubmission).toBeDefined();
      expect(listSubmission?.id).toBe(getSubmission.id);
      expect(listSubmission?.status).toBe(getSubmission.status);
      expect(listSubmission?.customerEmail).toBe(getSubmission.customerEmail);
      expect(listSubmission?.customerName).toBe(getSubmission.customerName);
      expect(listSubmission?.formTitle).toBe(getSubmission.formTitle);
      expect(listSubmission?.pageId).toBe(getSubmission.pageId);
    });

    it('should filter submissions by pageId', async () => {
      if (!primaryForm || !primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const result = await client.submissions.list({
        pageId: primaryForm.id,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((item) => item.id === primarySubmission?.submissionId)).toBe(true);
      for (const submission of result.data) {
        expect(submission.pageId).toBe(primaryForm.id);
      }
    });

    it('should filter submissions by search using form title', async () => {
      if (!primaryForm || !primarySubmission || !primaryForm.title) {
        throw new Error('Expected primary submission fixture with form title to be created');
      }

      const result = await client.submissions.list({
        search: primaryForm.title,
      });

      const submission = result.data.find((item) => item.id === primarySubmission?.submissionId);
      expect(submission).toBeDefined();
      expect(submission?.formTitle).toBe(primaryForm.title);
    });

    it('should treat an empty-string search the same as omitting search', async () => {
      if (!primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const defaultResult = await client.submissions.list({ limit: 10 });
      const emptySearchResult = await client.submissions.list({
        limit: 10,
        search: '',
      });

      expect(emptySearchResult.total).toBe(defaultResult.total);
      expect(emptySearchResult.has_more).toBe(defaultResult.has_more);
      expect(emptySearchResult.data.map((item) => item.id)).toEqual(
        defaultResult.data.map((item) => item.id)
      );
      expect(
        emptySearchResult.data.some((item) => item.id === primarySubmission?.submissionId)
      ).toBe(true);
    });

    it('should filter submissions by status', async () => {
      const result = await client.submissions.list({
        status: 'succeeded',
      });

      expect(result.data.length).toBeGreaterThan(0);
      for (const submission of result.data) {
        expect(submission.status).toBe('succeeded');
      }
    });

    it('should filter submissions by customerId when available', async () => {
      if (!primarySubmission?.customerId) {
        const { data } = await client.submissions.get(primarySubmission!.submissionId);
        primarySubmission!.customerId = data.customerId;
      }

      if (!primarySubmission?.customerId) {
        throw new Error('Expected primary submission to have a customerId');
      }

      const result = await client.submissions.list({
        customerId: primarySubmission.customerId,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((item) => item.id === primarySubmission?.submissionId)).toBe(true);
      for (const submission of result.data) {
        expect(submission.customerId).toBe(primarySubmission.customerId);
      }
    });

    it('should filter submissions by createdAfter and include the seeded fixture', async () => {
      if (!primarySubmission?.createdAt) {
        const { data } = await client.submissions.get(primarySubmission!.submissionId);
        primarySubmission!.createdAt = data.createdAt;
      }

      if (!primarySubmission?.createdAt) {
        throw new Error('Expected primary submission to have createdAt');
      }

      const createdAt = new Date(primarySubmission.createdAt);
      const createdAfter = new Date(createdAt.getTime() - 1000).toISOString();

      const result = await client.submissions.list({
        createdAfter,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((item) => item.id === primarySubmission?.submissionId)).toBe(true);
      for (const submission of result.data) {
        expect(new Date(submission.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(createdAfter).getTime()
        );
      }
    });

    it('should filter submissions by createdBefore and include the seeded fixture', async () => {
      if (!primarySubmission?.createdAt) {
        const { data } = await client.submissions.get(primarySubmission!.submissionId);
        primarySubmission!.createdAt = data.createdAt;
      }

      if (!primarySubmission?.createdAt) {
        throw new Error('Expected primary submission to have createdAt');
      }

      const createdAt = new Date(primarySubmission.createdAt);
      const createdBefore = new Date(createdAt.getTime() + 60_000).toISOString();

      const result = await client.submissions.list({
        createdBefore,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((item) => item.id === primarySubmission?.submissionId)).toBe(true);
      for (const submission of result.data) {
        expect(new Date(submission.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(createdBefore).getTime()
        );
      }
    });

    it('should return empty results for a search with no matches', async () => {
      const result = await client.submissions.list({
        search: `nonexistent-submission-${uniqueSuffix()}`,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.has_more).toBe(false);
    });

    it('should respect the limit query parameter', async () => {
      if (!primarySubmission || !secondarySubmission) {
        throw new Error('Expected submission fixtures to be created');
      }

      const result = await client.submissions.list({ limit: 1 });

      expect(result.data).toHaveLength(1);
    });

    it('should use cursor-based pagination with starting_after', async () => {
      if (!primarySubmission || !secondarySubmission) {
        throw new Error('Expected submission fixtures to be created');
      }

      const firstPage = await client.submissions.list({ limit: 1 });
      expect(firstPage.data).toHaveLength(1);

      const secondPage = await client.submissions.list({
        limit: 1,
        starting_after: firstPage.data[0].id,
      });

      expect(secondPage.data).toHaveLength(1);
      expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    });

    it('should return an empty page but preserve the unpaginated total for a non-existent starting_after cursor', async () => {
      if (!primarySubmission) {
        throw new Error('Expected primary submission fixture to be created');
      }

      const baseline = await client.submissions.list({ limit: 10 });
      const result = await client.submissions.list({
        limit: 10,
        starting_after: '000000000000000000000000',
      });

      expect(result.data).toEqual([]);
      expect(result.has_more).toBe(false);
      expect(result.total).toBe(baseline.total);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should use cursor-based pagination with ending_before', async () => {
      const seedPage = await client.submissions.list({ limit: 2 });
      expect(seedPage.data.length).toBeGreaterThanOrEqual(2);

      const result = await client.submissions.list({
        limit: 1,
        ending_before: seedPage.data[1].id,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).not.toBe(seedPage.data[1].id);
    });
  });
});
