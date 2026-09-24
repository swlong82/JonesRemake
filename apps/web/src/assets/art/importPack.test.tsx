import { MemoryArtPackStore } from '@hustle-ring/platform';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFlags } from '../../flags/appFlags';
import { ServicesProvider } from '../../platform/Services';
import { useSettings } from '../../store/settings';
import { SettingsScreen } from '../../ui/screens/SettingsScreen';
import { createLocalServices } from '@hustle-ring/platform';
import {
  deleteArtPack,
  importArtPack,
  importContext,
  refreshLibrary,
  useArtPackLibrary,
  usablePacks,
} from './artPackLibrary';
import { artRegistryFor, DEFAULT_ART_SET, installArtSets, useArtSets } from './artRegistry';
import { MAX_ENTRIES, readArtPackZip } from './importPack';
import { loadPack } from '@hustle-ring/content';

const BANK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="9" height="9" fill="#123456"/></svg>';

function manifest(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'mine',
    name: 'My City',
    version: '1',
    stage: { width: 1600, height: 1000 },
    tintKeys: { primary: '#FF00FF', secondary: '#00FFFF' },
    assets: { 'building:bank': { file: 'bank.svg', width: 240, height: 240 } },
    ...extra,
  };
}

/** Bytes in this realm: jsdom's `Uint8Array` differs from the one `strToU8` returns. */
const bytes = (s: string): Uint8Array => Uint8Array.from(strToU8(s));

function zip(entries: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, bytes(v)])));
}

const ctx = importContext();

describe('readArtPackZip (ART_SPEC 17.6)', () => {
  it('accepts a partial pack, defaulting extends to the bundled set', () => {
    const r = readArtPackZip(
      zip({
        'manifest.json': JSON.stringify(manifest()),
        'files/bank.svg': BANK,
        'README.txt': 'hi',
      }),
      ctx,
    );
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.pack?.manifest.extends).toBe('default');
    expect(r.pack?.files['bank.svg']).toBe(BANK);
    expect(r.ignored).toEqual(['README.txt']);
  });

  it('strips one shared top-level folder', () => {
    const r = readArtPackZip(
      zip({ 'mine/manifest.json': JSON.stringify(manifest()), 'mine/files/bank.svg': BANK }),
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it.each([
    ['not a zip', new Uint8Array([1, 2, 3]), 'zip'],
    ['no manifest', zip({ 'files/bank.svg': BANK }), 'manifest.json'],
    ['bad JSON', zip({ 'manifest.json': '{', 'files/bank.svg': BANK }), 'manifest.json'],
    [
      'reserved id',
      zip({ 'manifest.json': JSON.stringify(manifest({ id: 'default' })), 'files/bank.svg': BANK }),
      'manifest.id',
    ],
    [
      'a script in an SVG',
      zip({
        'manifest.json': JSON.stringify(manifest()),
        'files/bank.svg': BANK.replace('<rect', '<script>x</script><rect'),
      }),
      'files/bank.svg',
    ],
    ['a missing file', zip({ 'manifest.json': JSON.stringify(manifest()) }), 'files/bank.svg'],
  ])('refuses %s with a pointed report', (_n, bytes, path) => {
    const r = readArtPackZip(bytes, ctx);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.path)).toContain(path);
  });

  it('refuses too many entries before inflating them', () => {
    const many: Record<string, string> = { 'manifest.json': JSON.stringify(manifest()) };
    for (let i = 0; i <= MAX_ENTRIES; i++) many[`files/x${i}.svg`] = BANK;
    const r = readArtPackZip(zip(many), ctx);
    expect(r.issues[0]?.message).toContain('entries');
  });

  it('refuses non-UTF-8 text', () => {
    const raw = zipSync({
      'manifest.json': bytes(JSON.stringify(manifest())),
      'files/bank.svg': Uint8Array.from([0xff, 0xfe]),
    });
    expect(readArtPackZip(raw, ctx).issues.map((i) => i.message)).toContain('not UTF-8 text');
  });
});

describe('installed art sets (ART_SPEC 17.5)', () => {
  afterEach(() =>
    installArtSets(
      [],
      'default',
      () => 'blob:x',
      () => undefined,
    ),
  );

  it('resolves user keys first, falls back per key, and revokes old URLs', async () => {
    const revoked: string[] = [];
    const pack = loadPack('classic');
    const m = readArtPackZip(
      zip({ 'manifest.json': JSON.stringify(manifest()), 'files/bank.svg': BANK }),
      ctx,
    ).pack!;
    installArtSets(
      [{ manifest: m.manifest, files: m.files }],
      'mine',
      (svg) => `blob:${svg.length}`,
      (u) => revoked.push(u),
    );
    expect(useArtSets.getState().active).toBe('mine');
    const r = artRegistryFor(pack);
    await expect(r.url('building:bank')).resolves.toBe(`blob:${BANK.length}`);
    await expect(r.url('building:park')).resolves.not.toBe(r.wireframe('building:park'));
    installArtSets(
      [],
      'mine',
      () => 'blob:y',
      (u) => revoked.push(u),
    );
    expect(revoked).toEqual([`blob:${BANK.length}`]);
    // An unknown active id falls back to the bundled set.
    expect(useArtSets.getState().active).toBe('default');
    expect(artRegistryFor(pack)).not.toBe(r);
  });

  it('never lets a pack replace the bundled default', () => {
    installArtSets([{ manifest: { ...DEFAULT_ART_SET, name: 'fake' }, files: {} }], 'default');
    expect(useArtSets.getState().sets.get('default')?.name).toBe(DEFAULT_ART_SET.name);
  });
});

describe('art-pack library (M9.12)', () => {
  beforeEach(() => {
    useSettings.getState().resetData();
    useArtPackLibrary.setState({ packs: [], loaded: false });
  });

  it('imports into the store, activates the pack and deletes it again', async () => {
    const store = new MemoryArtPackStore();
    const ok = await importArtPack(
      zip({ 'manifest.json': JSON.stringify(manifest()), 'files/bank.svg': BANK }),
      store,
      () => 'now',
    );
    expect(ok.ok).toBe(true);
    expect((await store.get('mine'))?.importedAt).toBe('now');
    expect(useArtPackLibrary.getState().packs).toHaveLength(1);
    expect(useSettings.getState().settings.artSet).toBe('mine');
    const bad = await importArtPack(new Uint8Array([0]), store);
    expect(bad.ok).toBe(false);
    await deleteArtPack('mine', store);
    expect(await store.list()).toEqual([]);
    expect(useSettings.getState().settings.artSet).toBe('default');
  });

  it('skips stored packs whose manifest no longer parses', async () => {
    const store = new MemoryArtPackStore();
    await store.put({
      id: 'old',
      name: 'Old',
      manifest: { nope: true },
      files: {},
      importedAt: 'x',
    });
    expect(usablePacks(await store.list())).toEqual([]);
    await refreshLibrary(store);
    expect(useArtPackLibrary.getState().loaded).toBe(true);
  });
});

describe('Settings → Art packs', () => {
  afterEach(() => useFlags.getState().reset({ env: {}, search: '' }));

  it('imports a zip from the file input and reports refusals', async () => {
    useSettings.getState().resetData();
    useFlags.getState().set('sceneUi', true);
    const services = createLocalServices({
      newId: () => 'id',
      platform: { open: () => undefined },
    });
    services.artPacks = new MemoryArtPackStore();
    render(
      <ServicesProvider services={services}>
        <SettingsScreen />
      </ServicesProvider>,
    );
    const input = screen.getByTestId<HTMLInputElement>('artpack-file');
    // jsdom's File does not read this realm's byte arrays; a minimal stand-in does.
    const file = (name: string, data: Uint8Array) =>
      ({ name, arrayBuffer: () => Promise.resolve(data.slice().buffer) }) as unknown as File;
    const good = zip({ 'manifest.json': JSON.stringify(manifest()), 'files/bank.svg': BANK });
    act(() => {
      fireEvent.change(input, { target: { files: [file('mine.zip', good)] } });
    });
    await waitFor(() => expect(screen.getByTestId('artpack-report').dataset.ok).toBe('true'));
    expect(screen.getByTestId<HTMLInputElement>('artset-mine').checked).toBe(true);
    act(() => {
      fireEvent.change(input, { target: { files: [file('junk.zip', Uint8Array.from([1]))] } });
    });
    await waitFor(() => expect(screen.getByTestId('artpack-report').dataset.ok).toBe('false'));
    fireEvent.click(screen.getByTestId('artset-default'));
    expect(useSettings.getState().settings.artSet).toBe('default');
  });
});
