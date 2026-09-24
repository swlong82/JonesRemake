import { describe, expect, it } from 'vitest';
import { catalogFor, slotSpecFor, avatarIds } from './catalog.js';
import { DEFAULT_THEME, fileNameFor, planPlaceholders } from './generate.js';
import {
  defaultBoardLayout,
  isPlaceholder,
  wireframeDataUrl,
  wireframeSvg,
} from './placeholder.js';
import { boardOf, resolveAsset, setChain, themeOf } from './resolve.js';
import { checkSvg } from './sanitize.js';
import type { ArtManifest } from './schema.js';
import { hasTintKey } from './tint.js';
import { validateArtSet, type ValidateOptions } from './validate.js';

const catalog = catalogFor({ locationIds: ['bank', 'park', 'bank'], personalityIds: ['grinder'] });

function baseSet(boardSize = 4): { manifest: ArtManifest; files: Map<string, string> } {
  const plan = planPlaceholders({ manifest: undefined, files: new Map(), catalog, boardSize });
  return { manifest: plan.manifest, files: plan.writes };
}

function opts(files: Map<string, string>, extra: Partial<ValidateOptions> = {}): ValidateOptions {
  return { catalog, boardSizes: [4], files, ...extra };
}

describe('slot catalog (ART_SPEC 17.3)', () => {
  it('derives slots from locations and personalities, deduplicated and ordered', () => {
    const keys = catalog.map((s) => s.key);
    expect(keys.filter((k) => k === 'building:bank')).toHaveLength(1);
    expect(keys.indexOf('building:bank')).toBeLessThan(keys.indexOf('building:park'));
    expect(avatarIds(['grinder'])).toEqual([
      'player-1',
      'player-2',
      'player-3',
      'player-4',
      'player-5',
      'player-6',
      'rival-grinder',
    ]);
    // 1 board + 2×3 location slots + 7 avatars × 14 frames + 3 weekend + 3 ui + 2 frames
    expect(catalog).toHaveLength(1 + 6 + 7 * 14 + 3 + 3 + 2);
    expect(catalog.filter((s) => s.tint).every((s) => s.group === 'avatar')).toBe(true);
  });

  it('knows optional weekend overrides and rejects unknown keys', () => {
    expect(slotSpecFor('weekend:road-trip', catalog)?.optional?.fallback).toBe('weekend:neutral');
    expect(slotSpecFor('building:bank', catalog)?.width).toBe(240);
    expect(slotSpecFor('building:moon-base', catalog)).toBeUndefined();
  });
});

describe('wireframes and layout', () => {
  it('generates sanitizer-clean, marked, correctly sized wireframes', () => {
    for (const slot of catalog) {
      const svg = wireframeSvg(slot, { primary: '#FF00FF', secondary: '#00FFFF' });
      const check = checkSvg(svg);
      expect(check.issues, slot.key).toEqual([]);
      expect(check.viewBox).toEqual({ width: slot.width, height: slot.height });
      expect(isPlaceholder(svg)).toBe(true);
      expect(hasTintKey(svg, '#FF00FF')).toBe(slot.tint);
    }
    const url = wireframeDataUrl(catalog[0]!, { primary: '#FF00FF', secondary: '#00FFFF' });
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('lays out n slots inside the stage with the path through the doors', () => {
    const layout = defaultBoardLayout(16);
    expect(layout.slots).toHaveLength(16);
    expect(layout.path).toEqual(layout.slots.map((s) => s.door));
    expect(layout.slots[0]!.rect.x).toBeCloseTo(50);
    const r = validateArtSet(
      { ...baseSet(16).manifest },
      opts(baseSet(16).files, { boardSizes: [16] }),
    );
    expect(r.issues).toEqual([]);
  });
});

describe('planPlaceholders (ART_SPEC 17.3)', () => {
  it('creates a complete base set that validates', () => {
    const { manifest, files } = baseSet();
    expect(manifest.theme).toEqual(DEFAULT_THEME);
    expect(files.size).toBe(catalog.length);
    expect(Object.keys(manifest.assets)).toEqual([...Object.keys(manifest.assets)].sort());
    expect(validateArtSet(manifest, opts(files))).toMatchObject({ ok: true, issues: [] });
  });

  it('is byte-stable and never overwrites drawn art', () => {
    const { manifest, files } = baseSet();
    const drawnFile = fileNameFor('building:bank');
    const drawn =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="1" height="1"/></svg>';
    const next = new Map(files);
    next.set(drawnFile, drawn);
    const again = planPlaceholders({ manifest, files: next, catalog, boardSize: 4 });
    expect(again.writes.size).toBe(0);
    expect(again.drawn).toEqual(['building:bank']);
    expect(again.manifest).toEqual(manifest);
    // A stale wireframe is refreshed; drawn art stays out of the write set.
    next.set(fileNameFor('building:park'), `${files.get(fileNameFor('building:park'))!} `);
    const refreshed = planPlaceholders({ manifest, files: next, catalog, boardSize: 4 });
    expect([...refreshed.writes.keys()]).toEqual([fileNameFor('building:park')]);
  });
});

describe('validateArtSet (ART_SPEC 17.2, 17.8)', () => {
  it('reports schema errors with manifest paths', () => {
    const r = validateArtSet({ schemaVersion: 1, id: 'Bad Id' }, opts(new Map()));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.path)).toContain('manifest.id');
    expect(r.issues.map((i) => i.path)).toContain('manifest.assets');
  });

  it('requires a base set to cover every slot and carry theme and board', () => {
    const { manifest, files } = baseSet();
    const { ['host:park']: _gone, ...assets } = manifest.assets;
    const r = validateArtSet(
      { ...manifest, theme: undefined, board: undefined, assets },
      opts(files),
    );
    const paths = r.issues.map((i) => i.path);
    expect(paths).toContain('manifest.assets.host:park');
    expect(paths).toContain('manifest.theme');
    expect(paths).toContain('manifest.board');
    expect(paths).toContain('files/host.park.svg'); // now unreferenced
  });

  it('lets a set that extends another stay partial', () => {
    const { files } = baseSet();
    const file = fileNameFor('building:bank');
    const r = validateArtSet(
      {
        schemaVersion: 1,
        id: 'mine',
        name: 'Mine',
        version: '1',
        extends: 'default',
        stage: { width: 1600, height: 1000 },
        tintKeys: { primary: '#FF00FF', secondary: '#00FFFF' },
        assets: {
          'building:bank': { file, width: 240, height: 240 },
          'weekend:road-trip': { file: 'trip.svg', width: 1600, height: 1000 },
        },
      },
      opts(
        new Map([
          [file, files.get(file)!],
          ['trip.svg', files.get(fileNameFor('weekend:neutral'))!],
        ]),
      ),
    );
    expect(r.issues).toEqual([]);
  });

  it('checks sizes, files, sanitizer, tint keys, layout, contrast and budgets', () => {
    const { manifest, files } = baseSet();
    const bad = structuredClone(manifest);
    bad.assets['building:bank'] = { file: 'building.bank.svg', width: 100, height: 240 };
    bad.assets['moon:base'] = { file: 'x.svg', width: 1, height: 1 };
    bad.assets['host:bank'] = { file: 'nope.svg', width: 400, height: 600 };
    bad.theme!.palette.ink = '#eeeeee';
    bad.board!.slots.push(bad.board!.slots[0]!);
    bad.board!.path[0] = { x: -5, y: 0 };
    bad.board!.slots[1]!.label = { x: 5000, y: 0 };
    bad.theme!.frames = { panel: 'ui:title' };
    const f = new Map(files);
    f.set(
      fileNameFor('avatar:player-1:idle:n'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96"><script/></svg>',
    );
    f.set(
      fileNameFor('interior:bank'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
    );
    const r = validateArtSet(bad, opts(f, { maxTotalBytes: 10 }));
    const text = r.issues.map((i) => `${i.path}: ${i.message}`).join('\n');
    expect(text).toContain('manifest.assets.building:bank: size 100×240');
    expect(text).toContain('manifest.assets.moon:base: unknown slot key');
    expect(text).toContain('files/nope.svg: missing');
    expect(text).toContain('ink on surface');
    expect(text).toContain('manifest.board.slots: has 5 slots; a pack board has 4');
    expect(text).toContain('manifest.board.path: has 4 waypoints for 5 slots');
    expect(text).toContain('manifest.board.path.0: lies outside the stage');
    expect(text).toContain('manifest.board.slots.1.label: lies outside the stage');
    expect(text).toContain('manifest.theme.frames.panel: must be a frame:* key');
    expect(text).toContain('<script> is not on the allowlist');
    expect(text).toContain('uses no primary key colour');
    expect(text).toContain('viewBox is 10×10');
    expect(text).toContain('files: set is');
  });
});

describe('set chain resolution (ART_SPEC 17.5)', () => {
  const { manifest } = baseSet();
  const user: ArtManifest = {
    ...manifest,
    id: 'mine',
    extends: 'middle',
    theme: undefined,
    board: undefined,
    assets: { 'building:bank': { file: 'b.svg', width: 240, height: 240 } },
  };
  const middle: ArtManifest = { ...user, id: 'middle', extends: 'mine', assets: {} };
  const sets = new Map([
    ['default', manifest],
    ['mine', user],
    ['middle', middle],
  ]);

  it('walks extends, stops on cycles and always ends at default', () => {
    expect(setChain('mine', sets).map((s) => s.id)).toEqual(['mine', 'middle', 'default']);
    expect(setChain('default', sets).map((s) => s.id)).toEqual(['default']);
    expect(setChain('missing', sets).map((s) => s.id)).toEqual(['default']);
  });

  it('resolves keys through the chain and optional fallbacks', () => {
    const chain = setChain('mine', sets);
    expect(resolveAsset('building:bank', chain, catalog)?.setId).toBe('mine');
    expect(resolveAsset('building:park', chain, catalog)?.setId).toBe('default');
    expect(resolveAsset('weekend:road-trip', chain, catalog)?.key).toBe('weekend:neutral');
    expect(resolveAsset('moon:base', chain, catalog)).toBeUndefined();
    expect(boardOf(chain)).toBe(manifest.board);
    expect(themeOf(chain)).toBe(manifest.theme);
  });
});
