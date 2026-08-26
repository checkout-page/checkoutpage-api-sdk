import type { CheckoutPageApiClient } from '../../client';
import type { ThemePropertyList, ThemePropertyListParams } from '../../types';

export class ThemePropertiesResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(params: ThemePropertyListParams = {}): Promise<ThemePropertyList> {
    const query: Record<string, string | undefined> = {
      search: params.search,
      pathPrefix: params.pathPrefix,
    };

    return this.client.request<ThemePropertyList>({
      method: 'GET',
      path: '/v1/theme-properties/',
      query,
    });
  }
}
