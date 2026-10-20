import { vi } from 'vitest';

export interface CallOutcome<T> {
  status: number | undefined;
  value?: T;
  error?: unknown;
}

/**
 * Runs an SDK call and reports the HTTP status of its last response. The SDK's
 * error classes group statuses (ValidationError is 400 or 422, AuthenticationError
 * is 401 or 403), so tests pinning an exact status read it off the wire.
 */
export async function withStatus<T>(call: () => Promise<T>): Promise<CallOutcome<T>> {
  const statuses: number[] = [];
  const originalFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
    const response = await originalFetch(...args);
    statuses.push(response.status);
    return response;
  });

  try {
    const value = await call();
    return { status: statuses.at(-1), value };
  } catch (error) {
    return { status: statuses.at(-1), error };
  } finally {
    spy.mockRestore();
  }
}
