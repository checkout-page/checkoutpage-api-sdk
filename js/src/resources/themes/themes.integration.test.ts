import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CheckoutPageClient,
  ConflictError,
  NotFoundError,
  createCheckoutPageClient,
} from '../../index';
import type { Theme } from '../../types';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';
import { fakeObjectId, uniqueSuffix } from '../../test-helpers/test-lib';

describe('ThemeResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let baseTheme: Theme;
  let createdThemeIds: string[] = [];
  let createdFormIds: string[] = [];

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

  // Archiving a form keeps its theme, and a theme any page uses can't be
  // deleted, so forms move back to the built-in theme before they're archived.
  afterEach(async () => {
    for (const formId of createdFormIds.splice(0)) {
      try {
        await client.forms.update(formId, { themeId: baseTheme.id });
        await client.forms.delete(formId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
    }
    for (const themeId of createdThemeIds.splice(0)) {
      try {
        await client.themes.delete(themeId);
      } catch {
        // Best-effort cleanup for integration tests.
      }
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

  it('sets a page theme with themeId and refuses to delete a theme in use', async () => {
    const theme = await createTheme('page-theme');
    const suffix = uniqueSuffix();

    const { data: form } = await client.forms.create({
      name: `SDK theme form ${suffix}`,
      title: `SDK theme form ${suffix}`,
      themeId: theme.id,
    });
    createdFormIds.push(form.id);

    expect(form.themeId).toBe(theme.id);
    expect((await client.forms.get(form.id)).data.themeId).toBe(theme.id);

    await expect(client.themes.delete(theme.id)).rejects.toBeInstanceOf(ConflictError);

    const { data: moved } = await client.forms.update(form.id, { themeId: baseTheme.id });
    expect(moved.themeId).toBe(baseTheme.id);

    await client.forms.delete(form.id);
    createdFormIds = createdFormIds.filter((id) => id !== form.id);

    await client.themes.delete(theme.id);
    createdThemeIds = createdThemeIds.filter((id) => id !== theme.id);
    await expect(client.themes.get(theme.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
