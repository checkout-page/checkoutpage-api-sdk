import type { CheckoutPageApiClient } from '../../client';
import type {
  CreateThemeParams,
  CreateThemeResponse,
  DeleteThemeResponse,
  ThemeList,
  ThemeListParams,
  ThemeResponse,
  UpdateThemeParams,
  UpdateThemeResponse,
} from '../../types';

export class ThemeResource {
  constructor(private client: CheckoutPageApiClient) {}

  /**
   * List the themes your pages can use, newest first: your own themes and the
   * built-in (`global`) ones. A retired built-in theme is only listed while one
   * of your pages uses it.
   *
   * @example
   * const { data: themes, has_more } = await client.themes.list({ scope: 'seller' });
   */
  async list(args: ThemeListParams = {}): Promise<ThemeList> {
    const query: Record<string, string | undefined> = {
      scope: args.scope,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<ThemeList>({
      method: 'GET',
      path: '/v1/themes/',
      query,
    });
  }

  /**
   * Retrieve one of your themes or a built-in theme.
   *
   * @example
   * const { data: theme } = await client.themes.get(themeId);
   */
  async get(themeId: string): Promise<ThemeResponse> {
    if (!themeId) {
      throw new Error('Theme ID is required');
    }

    return this.client.request<ThemeResponse>({
      method: 'GET',
      path: `/v1/themes/${encodeURIComponent(themeId)}`,
    });
  }

  /**
   * Create a theme. Pass `baseThemeId` to start from a copy of one of your
   * themes or a built-in theme, then set what should differ in `variables`.
   * `variables` takes the same shape as a page's `themeOverrides`. A copy of a
   * built-in theme does not follow your store's brand colour, so set
   * `tokens.colorPrimary` if you want it.
   *
   * @example
   * const { data: theme } = await client.themes.create({
   *   name: 'Brand',
   *   baseThemeId: builtInThemeId,
   *   variables: { tokens: { colorPrimary: { light: '#4f46e5' } } },
   * });
   */
  async create(params: CreateThemeParams): Promise<CreateThemeResponse> {
    return this.client.request<CreateThemeResponse>({
      method: 'POST',
      path: '/v1/themes/',
      body: params,
    });
  }

  /**
   * Update one of your themes. Every page that uses it changes too. Keys left
   * out of `variables` keep their value, and `null` resets a property or
   * everything under a key. Built-in themes are read-only.
   *
   * @example
   * const { data: theme } = await client.themes.update(themeId, {
   *   variables: { tokens: { colorPrimary: { light: '#0f766e' } } },
   * });
   */
  async update(themeId: string, params: UpdateThemeParams): Promise<UpdateThemeResponse> {
    if (!themeId) {
      throw new Error('Theme ID is required');
    }

    return this.client.request<UpdateThemeResponse>({
      method: 'PATCH',
      path: `/v1/themes/${encodeURIComponent(themeId)}`,
      body: params,
    });
  }

  /**
   * Delete one of your themes and return its final state. A theme that any of
   * your pages uses, archived ones included, or that is your store's default
   * theme, can't be deleted (a `ConflictError`): move those pages to another
   * theme with `themeId` first.
   */
  async delete(themeId: string): Promise<DeleteThemeResponse> {
    if (!themeId) {
      throw new Error('Theme ID is required');
    }

    return this.client.request<DeleteThemeResponse>({
      method: 'DELETE',
      path: `/v1/themes/${encodeURIComponent(themeId)}`,
    });
  }
}
