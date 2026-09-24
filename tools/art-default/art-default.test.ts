import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArtManifestSchema, checkSvg, hasTintKey, wireframeSvg } from '@hustle-ring/art';
import { catalogFromPacks, nodeParseXml, readSet } from '../lib/art.js';
import { drawSlot, GENERATED_MARKER, mayRedraw } from './index.js';
import { buildingSvg } from './buildings.js';
import { avatarSvg, hostSvg } from './people.js';
import { dark, light, mix, rng } from './svg.js';

const setsDir = resolve(import.meta.dirname, '..', '..', 'packages/art/sets');
const { catalog } = catalogFromPacks();
const set = readSet(setsDir, 'default');
const manifest = ArtManifestSchema.parse(set.manifest);

describe('default art generator (ART_SPEC 17.3, M9.13)', () => {
  it('draws every catalog slot as clean, correctly sized SVG without text', () => {
    for (const slot of catalog) {
      const art = drawSlot(slot, manifest.board!);
      expect(art, slot.key).not.toBeNull();
      const check = checkSvg(art!, undefined, nodeParseXml);
      expect(check.issues, slot.key).toEqual([]);
      expect(check.viewBox, slot.key).toEqual({ width: slot.width, height: slot.height });
      expect(art, slot.key).not.toMatch(/<text|<tspan/);
      expect(art!.includes(GENERATED_MARKER)).toBe(true);
      if (slot.tint) expect(hasTintKey(art!, manifest.tintKeys.primary), slot.key).toBe(true);
    }
  });

  it('is deterministic and matches the committed default set', () => {
    for (const slot of catalog) {
      const file = manifest.assets[slot.key]!.file;
      expect(set.files.get(file), `${file} is stale: run pnpm art:draw`).toBe(
        drawSlot(slot, manifest.board!),
      );
    }
  });

  it('knows its own keys only and has fallbacks for new content', () => {
    expect(drawSlot({ key: 'moon:base' }, manifest.board!)).toBeNull();
    expect(drawSlot({ key: 'weekend:road-trip' }, manifest.board!)).toBeNull();
    expect(drawSlot({ key: 'frame:other' }, manifest.board!)).toBeNull();
    expect(drawSlot({ key: 'ui:other' }, manifest.board!)).toBeNull();
    expect(buildingSvg('new-place')).toContain('<svg');
    expect(hostSvg('new-place')).toContain('<svg');
    expect(avatarSvg('player-99', 'idle', 's')).toContain('#FF00FF');
  });

  it('redraws wireframes and its own output, never hand-drawn art', () => {
    const slot = catalog[0]!;
    expect(mayRedraw(undefined)).toBe(true);
    expect(mayRedraw(wireframeSvg(slot, manifest.tintKeys))).toBe(true);
    expect(mayRedraw(drawSlot(slot, manifest.board!)!)).toBe(true);
    expect(mayRedraw('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')).toBe(false);
  });

  it('mixes colours and scatters details deterministically', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(dark('#ffffff', 1)).toBe('#000000');
    expect(light('#000000', 1)).toBe('#ffffff');
    const a = rng(3);
    const b = rng(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(0)()).toBeGreaterThanOrEqual(0);
  });
});
