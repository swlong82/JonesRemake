import { catalogFor, type ArtManifest } from '@hustle-ring/art';
import { loadPack } from '@hustle-ring/content';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PALETTE_HEX } from '../AssetRegistry';
import { ArtRegistry, artRegistryFor, DEFAULT_ART_SET, type ArtRegistryDeps } from './artRegistry';
import { useArtUrl } from './useArtUrl';

const pack = loadPack('classic');
const catalog = catalogFor({
  locationIds: pack.board.locationAt.filter((l): l is string => l !== null),
  personalityIds: pack.personalities.map((p) => p.id),
});
const AVATAR = 'avatar:player-1:idle:s';
const TINTABLE = '<svg viewBox="0 0 64 96"><rect fill="#FF00FF"/><rect fill="#00ffff"/></svg>';

function setup(overrides: Partial<ArtRegistryDeps> = {}, user?: ArtManifest) {
  const fileUrls = new Map<string, string>();
  for (const e of Object.values(DEFAULT_ART_SET.assets))
    fileUrls.set(`default/${e.file}`, `/art/${e.file}`);
  if (user)
    for (const e of Object.values(user.assets))
      fileUrls.set(`${user.id}/${e.file}`, `blob:${e.file}`);
  const deps: ArtRegistryDeps = {
    fileUrls,
    fetchText: vi.fn(() => Promise.resolve(TINTABLE)),
    makeObjectUrl: vi.fn(
      (svg: string) => `blob:tinted:${svg.length}:${svg.includes('#FF00FF') ? 'key' : 'ok'}`,
    ),
    preload: vi.fn(),
    ...overrides,
  };
  const sets = new Map([['default', DEFAULT_ART_SET]]);
  if (user) sets.set(user.id, user);
  return { registry: new ArtRegistry(sets, user?.id ?? 'default', catalog, deps), deps };
}

describe('ArtRegistry (ART_SPEC 17.5)', () => {
  it('knows every catalog slot of the bundled default set, with board and theme', () => {
    const { registry } = setup();
    for (const slot of catalog) expect(registry.has(slot.key), slot.key).toBe(true);
    expect(registry.has('moon:base')).toBe(false);
    expect(registry.board()?.slots).toHaveLength(pack.board.locationAt.length);
    expect(registry.theme()?.font).toBe('nunito');
  });

  it('serves plain files by URL and falls back to the wireframe for unknown keys', async () => {
    const { registry } = setup();
    await expect(registry.url('building:bank')).resolves.toBe('/art/building.bank.svg');
    // A tint request for a slot that is not tintable is ignored.
    await expect(registry.url('building:bank', 'p2')).resolves.toBe('/art/building.bank.svg');
    const wf = await registry.url('moon:base');
    expect(wf).toBe(registry.wireframe('moon:base'));
    expect(decodeURIComponent(wf)).toContain('moon:base');
  });

  it('resolves optional overrides to their fallback slot', async () => {
    const { registry } = setup();
    await expect(registry.url('weekend:road-trip')).resolves.toBe('/art/weekend.neutral.svg');
  });

  it('tints avatars by key colour once per (file, colour) and caches the blob', async () => {
    const { registry, deps } = setup();
    const url = await registry.url(AVATAR, 'p1');
    expect(url).toBe(`blob:tinted:${TINTABLE.length}:ok`);
    await registry.url(AVATAR, 'p1');
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
    const made = vi.mocked(deps.makeObjectUrl).mock.calls[0]![0];
    expect(made).toContain(PALETTE_HEX.p1.toLowerCase());
    await registry.url(AVATAR, 'p2');
    expect(deps.fetchText).toHaveBeenCalledTimes(2);
    await expect(registry.url(AVATAR)).resolves.toBe('/art/avatar.player-1.idle.s.svg');
  });

  it('falls back to the wireframe when a fetch fails, and retries later', async () => {
    const fetchText = vi
      .fn<(url: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(TINTABLE);
    const { registry } = setup({ fetchText });
    await expect(registry.url(AVATAR, 'p3')).resolves.toBe(registry.wireframe(AVATAR));
    await expect(registry.url(AVATAR, 'p3')).resolves.toMatch(/^blob:tinted/);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it('prefers a user set and falls back per key to the default set', async () => {
    const user: ArtManifest = {
      ...DEFAULT_ART_SET,
      id: 'mine',
      extends: 'default',
      theme: undefined,
      board: undefined,
      assets: { 'building:bank': { file: 'bank.svg', width: 240, height: 240 } },
    };
    const { registry } = setup({}, user);
    await expect(registry.url('building:bank')).resolves.toBe('blob:bank.svg');
    await expect(registry.url('building:park')).resolves.toBe('/art/building.park.svg');
    expect(registry.board()).toBe(DEFAULT_ART_SET.board);
  });

  it('shows the wireframe when a resolved file has no URL', async () => {
    const { registry } = setup({ fileUrls: new Map() });
    await expect(registry.url('building:bank')).resolves.toBe(registry.wireframe('building:bank'));
  });

  it('builds one registry per pack from the bundled files', async () => {
    const a = artRegistryFor(pack);
    expect(artRegistryFor(pack)).toBe(a);
    // Vitest inlines `?url` imports; the build keeps them as files (checked in the build output).
    const url = await a.url('building:bank');
    expect(url).not.toBe(a.wireframe('building:bank'));
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('prefetch (ART_SPEC 17.8)', () => {
  it('preloads plain files, warms tinted blobs and skips wireframes', async () => {
    const { registry, deps } = setup();
    await registry.prefetch([
      { key: 'interior:bank' },
      { key: AVATAR, tint: 'p2' },
      { key: 'moon:base' },
    ]);
    expect(deps.preload).toHaveBeenCalledTimes(1);
    expect(deps.preload).toHaveBeenCalledWith('/art/interior.bank.svg');
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
    // The tinted blob is cached: rendering it later does not fetch again.
    await registry.url(AVATAR, 'p2');
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
  });

  it('tells its own keys from optional fallbacks', () => {
    const { registry } = setup();
    expect(registry.hasOwn('weekend:neutral')).toBe(true);
    expect(registry.hasOwn('weekend:road-trip')).toBe(false);
    expect(registry.has('weekend:road-trip')).toBe(true);
  });
});

describe('useArtUrl', () => {
  it('shows the wireframe first, then the loaded URL, and never a stale key', async () => {
    const { registry } = setup();
    const { result, rerender } = renderHook(({ k }) => useArtUrl(registry, k), {
      initialProps: { k: 'building:bank' },
    });
    expect(result.current).toBe(registry.wireframe('building:bank'));
    await waitFor(() => expect(result.current).toBe('/art/building.bank.svg'));
    act(() => rerender({ k: 'building:park' }));
    expect(result.current).toBe(registry.wireframe('building:park'));
    await waitFor(() => expect(result.current).toBe('/art/building.park.svg'));
  });
});
