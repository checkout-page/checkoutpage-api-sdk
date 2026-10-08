import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  ConflictError,
  NotFoundError,
  ValidationError,
  createCheckoutPageClient,
} from '../../index';
import type { Form, Schemas, Theme } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

type ThemedPage = Pick<Form, 'id' | 'themeId' | 'locale' | 'themeOverrides'>;
type PageThemeInput = { themeId?: string; themeOverrides?: Schemas['ThemeOverridesInput'] };
type CreateThemedPageInput = PageThemeInput & { themeId: string; locale: 'de-DE' };

interface PageKind {
  label: string;
  create: (input: CreateThemedPageInput) => Promise<ThemedPage>;
  get: (id: string) => Promise<ThemedPage>;
  update: (id: string, input: PageThemeInput) => Promise<ThemedPage>;
  archive: (id: string) => Promise<unknown>;
}

describe('ThemeResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let baseTheme: Theme;
  let createdThemeIds: string[] = [];
  let createdPages: Array<{ kind: PageKind; id: string }> = [];

  beforeAll(async () => {
    const config = loadIntegrationConfig();
    client = createCheckoutPageClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });

    const { data: globalThemes } = await client.themes.list({ scope: 'global', limit: 100 });
    const base = globalThemes.find((theme) => !theme.deprecated && theme.variables);
    if (!base) {
      throw new Error('No non-deprecated global theme with variables found to copy');
    }
    baseTheme = base;
  });

  // Archiving a page keeps its theme, and a theme any page uses can't be
  // deleted, so pages move back to the built-in theme before they're archived.
  afterEach(async () => {
    for (const { kind, id } of createdPages.splice(0)) {
      await kind.update(id, { themeId: baseTheme.id }).catch(() => undefined);
      await kind.archive(id).catch(() => undefined);
    }
    for (const themeId of createdThemeIds.splice(0)) {
      await client.themes.delete(themeId).catch(() => undefined);
    }
  });

  const themeName = (label: string) => `SDK theme ${label} ${uniqueSuffix()}`;

  const createTheme = async (label: string) => {
    const { data: theme } = await client.themes.create({
      name: themeName(label),
      baseThemeId: baseTheme.id,
      variables: { tokens: { colorPrimary: { light: '#123456' } } },
    });
    createdThemeIds.push(theme.id);
    return theme;
  };

  const forgetTheme = (themeId: string) => {
    createdThemeIds = createdThemeIds.filter((id) => id !== themeId);
  };

  const pageKinds: PageKind[] = [
    {
      label: 'checkout pages',
      create: async (input) => {
        const name = themeName('checkout page');
        const { data } = await client.checkoutPages.create({
          name,
          productData: { title: name, price: { amount: 4900, currency: 'usd' } },
          ...input,
        });
        return data;
      },
      get: async (id) => (await client.checkoutPages.get(id)).data,
      update: async (id, input) => (await client.checkoutPages.update(id, input)).data,
      archive: (id) => client.checkoutPages.delete(id),
    },
    {
      label: 'events',
      create: async (input) => {
        const name = themeName('event');
        const { data } = await client.events.create({
          name,
          title: name,
          eventDetails: {
            type: 'in_person',
            currency: 'usd',
            startDate: '2027-09-01T09:00:00Z',
            endDate: '2027-09-01T17:00:00Z',
            timezone: 'UTC',
            location: 'SDK Theme Venue',
          },
          ...input,
        });
        return data;
      },
      get: async (id) => (await client.events.get(id)).data,
      update: async (id, input) => (await client.events.update(id, input)).data,
      archive: (id) => client.events.delete(id),
    },
    {
      label: 'forms',
      create: async (input) => {
        const name = themeName('form');
        const { data } = await client.forms.create({ name, title: name, ...input });
        return data;
      },
      get: async (id) => (await client.forms.get(id)).data,
      update: async (id, input) => (await client.forms.update(id, input)).data,
      archive: (id) => client.forms.delete(id),
    },
  ];

  it('creates a theme from a global base, gets it, updates it, then deletes it', async () => {
    const name = themeName('crud');
    const { data: created } = await client.themes.create({
      name,
      baseThemeId: baseTheme.id,
      variables: { tokens: { colorPrimary: { light: '#123456' } } },
    });
    createdThemeIds.push(created.id);

    expect(created).toMatchObject({ name, scope: 'seller', deprecated: false });
    expect(created.id).not.toBe(baseTheme.id);
    expect(created.variables).toEqual({
      ...baseTheme.variables,
      tokens: {
        ...baseTheme.variables?.tokens,
        colorPrimary: { ...baseTheme.variables?.tokens?.colorPrimary, light: '#123456' },
      },
    });

    expect(await client.themes.get(created.id)).toEqual({ data: created });

    const renamed = themeName('crud-renamed');
    const { data: updated } = await client.themes.update(created.id, {
      name: renamed,
      variables: { tokens: { colorPrimary: { light: '#654321' } } },
    });

    expect(updated).toMatchObject({ id: created.id, name: renamed, scope: 'seller' });
    expect(updated.variables?.tokens?.colorPrimary?.light).toBe('#654321');
    expect(updated.variables?.layout).toEqual(created.variables?.layout);
    expect(await client.themes.get(created.id)).toEqual({ data: updated });

    const { data: deleted } = await client.themes.delete(created.id);
    expect(deleted).toEqual(updated);
    await expect(client.themes.get(created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists a new theme under the seller scope only', async () => {
    const theme = await createTheme('list');

    const all = await client.themes.list({ limit: 100 });
    expect(typeof all.has_more).toBe('boolean');
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect(all.data.some((t) => t.id === theme.id)).toBe(true);
    expect(all.data.some((t) => t.id === baseTheme.id)).toBe(true);

    const mine = await client.themes.list({ scope: 'seller', limit: 100 });
    expect(mine.data.some((t) => t.id === theme.id)).toBe(true);
    expect(mine.data.every((t) => t.scope === 'seller')).toBe(true);

    const builtIn = await client.themes.list({ scope: 'global', limit: 100 });
    expect(builtIn.data.some((t) => t.id === theme.id)).toBe(false);
    expect(builtIn.data.every((t) => t.scope === 'global')).toBe(true);
  });

  it('pages through themes with starting_after', async () => {
    await createTheme('page');

    const first = await client.themes.list({ limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.has_more).toBe(true);

    const second = await client.themes.list({ limit: 1, starting_after: first.data[0].id });
    expect(second.data).toHaveLength(1);
    expect(second.data[0].id).not.toBe(first.data[0].id);
  });

  it('rejects a name another theme uses with a ConflictError', async () => {
    const first = await createTheme('conflict-a');
    const second = await createTheme('conflict-b');

    await expect(client.themes.create({ name: first.name })).rejects.toBeInstanceOf(ConflictError);
    await expect(client.themes.update(second.id, { name: first.name })).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  it('returns a NotFoundError for an unknown id', async () => {
    const missingId = fakeObjectId('missing');

    await expect(client.themes.get(missingId)).rejects.toThrow('Theme not found');
    await expect(
      client.themes.update(missingId, { name: themeName('missing') })
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(client.themes.delete(missingId)).rejects.toBeInstanceOf(NotFoundError);
  });

  describe.each(pageKinds.map((kind) => [kind.label, kind] as const))('on %s', (_, kind) => {
    const labelOverride = { labels: { payButtonText: 'Jetzt kaufen' } };
    const tokenOverride = { tokens: { colorPrimary: { light: '#abcdef' } } };
    const bothOverrides = { ...labelOverride, ...tokenOverride };

    const createPage = async (input: PageThemeInput & { themeId: string }) => {
      const page = await kind.create({ locale: 'de-DE', ...input });
      createdPages.push({ kind, id: page.id });
      return page;
    };

    it('creates the page with a theme the seller made', async () => {
      const theme = await createTheme(`${kind.label} create`);

      const page = await createPage({ themeId: theme.id });

      expect(page.themeId).toBe(theme.id);
      expect((await kind.get(page.id)).themeId).toBe(theme.id);
    });

    it('clears the page overrides but keeps its locale when the theme changes', async () => {
      const theme = await createTheme(`${kind.label} switch`);
      const page = await createPage({ themeId: theme.id, themeOverrides: bothOverrides });
      expect(page).toMatchObject({ locale: 'de-DE', themeOverrides: bothOverrides });

      const switched = await kind.update(page.id, { themeId: baseTheme.id });

      const expected = { themeId: baseTheme.id, locale: 'de-DE', themeOverrides: null };
      expect(switched).toMatchObject(expected);
      expect(await kind.get(page.id)).toMatchObject(expected);
    });

    it('merges the overrides when themeId is the theme the page already uses', async () => {
      const theme = await createTheme(`${kind.label} merge`);
      const page = await createPage({ themeId: theme.id, themeOverrides: labelOverride });

      const updated = await kind.update(page.id, {
        themeId: theme.id,
        themeOverrides: tokenOverride,
      });

      const expected = { themeId: theme.id, locale: 'de-DE', themeOverrides: bothOverrides };
      expect(updated).toMatchObject(expected);
      expect(await kind.get(page.id)).toMatchObject(expected);
    });

    it('rejects a null themeId and keeps the page theme', async () => {
      const theme = await createTheme(`${kind.label} null`);
      const page = await createPage({ themeId: theme.id });

      // The types already forbid null; this checks the API refuses it too.
      await expect(kind.update(page.id, { themeId: null as never })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect((await kind.get(page.id)).themeId).toBe(theme.id);
    });

    it('refuses to delete a theme the page uses until the page moves off it', async () => {
      const theme = await createTheme(`${kind.label} in use`);
      const page = await createPage({ themeId: theme.id });

      await expect(client.themes.delete(theme.id)).rejects.toBeInstanceOf(ConflictError);

      expect((await kind.update(page.id, { themeId: baseTheme.id })).themeId).toBe(baseTheme.id);

      await client.themes.delete(theme.id);
      forgetTheme(theme.id);
      await expect(client.themes.get(theme.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
