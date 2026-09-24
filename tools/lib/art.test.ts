import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSvg, planPlaceholders, validateArtSet } from '@hustle-ring/art';
import { catalogFromPacks, drawnReport, listSets, nodeParseXml, readSet, writeSet } from './art.js';

describe('art tooling (ART_SPEC 17.3, 17.8)', () => {
  const { catalog, boardSizes } = catalogFromPacks();

  it('derives one catalog from every bundled pack', () => {
    expect(boardSizes).toEqual([16]);
    const keys = catalog.map((s) => s.key);
    expect(keys).toContain('building:university');
    expect(keys).toContain('host:park');
    expect(keys).toContain('avatar:rival-grinder:walk2:w');
  });

  it('parses SVG in node like the browser does', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><script/></svg>';
    expect(checkSvg(svg, undefined, nodeParseXml).issues.join()).toContain('<script>');
  });

  it('round-trips a set through disk and reports drawn slots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'art-'));
    expect(listSets(join(dir, 'none'))).toEqual([]);
    const plan = planPlaceholders({
      manifest: undefined,
      files: new Map(),
      catalog,
      boardSize: 16,
    });
    writeSet(join(dir, 'default'), plan.manifest, plan.writes);
    mkdirSync(join(dir, 'empty'));
    writeFileSync(join(dir, 'stray.txt'), '');
    expect(listSets(dir)).toEqual(['default', 'empty']);
    expect(readSet(dir, 'empty')).toMatchObject({ manifest: undefined, files: new Map() });

    const drawnFile = plan.manifest.assets['ui:title']!.file;
    writeFileSync(
      join(dir, 'default', 'files', drawnFile),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"/>',
    );
    writeFileSync(join(dir, 'default', 'files', 'notes.txt'), 'ignored');
    const set = readSet(dir, 'default');
    expect(set.files.size).toBe(catalog.length);
    const result = validateArtSet(set.manifest, {
      catalog,
      boardSizes,
      files: set.files,
      parseXml: nodeParseXml,
    });
    expect(result.issues).toEqual([]);
    const ui = drawnReport(result.manifest!, set.files, catalog).find((r) => r.group === 'ui');
    expect(ui).toEqual({ group: 'ui', drawn: 1, total: 3 });
  });

  it('keeps the committed default set valid and free of drift', () => {
    const setsDir = resolve(import.meta.dirname, '..', '..', 'packages/art/sets');
    const set = readSet(setsDir, 'default');
    const result = validateArtSet(set.manifest, {
      catalog,
      boardSizes,
      files: set.files,
      parseXml: nodeParseXml,
    });
    expect(result.issues).toEqual([]);
    const plan = planPlaceholders({
      manifest: result.manifest,
      files: set.files,
      catalog,
      boardSize: 16,
    });
    expect(plan.writes.size).toBe(0);
  });
});
