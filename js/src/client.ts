import {
  APIError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './errors';
import { InvoiceResource } from './resources/invoices/invoices';

export interface CheckoutPageApiClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  formData?: FormData;
}

export class CheckoutPageApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  public readonly invoices: InvoiceResource;

  constructor(options: CheckoutPageApiClientOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.checkoutpage.com';
    this.invoices = new InvoiceResource(this);
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': '@checkoutpage/sdk/0.1.0',
    };

    // Only set Content-Type for JSON requests (FormData sets its own boundary)
    if (!options.formData) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
    };

    if (options.formData) {
      fetchOptions.body = options.formData;
    } else if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    return await this.handleResponse<T>(response);
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: unknown;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message = this.extractErrorMessage(data);

      switch (response.status) {
        case 401:
        case 403:
          throw new AuthenticationError(message);
        case 404:
          throw new NotFoundError(message);
        case 409:
          throw new ConflictError(message);
        case 400:
        case 422:
          throw new ValidationError(message);
        case 429:
          throw new RateLimitError(message);
        default:
          throw new APIError(message, response.status, data);
      }
    }

    return data as T;
  }

  private extractErrorMessage(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      if ('message' in data && typeof data.message === 'string') {
        return data.message;
      }
      if ('error' in data && typeof data.error === 'string') {
        return data.error;
      }
    }
    return 'An unexpected error occurred';
  }
}
