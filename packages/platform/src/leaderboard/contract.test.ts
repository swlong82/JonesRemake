import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { ScoreEntry } from '../types.js';
import {
  compareEntries,
  IndexedDbEntryStore,
  LocalLeaderboard,
  parseScope,
  scopes,
  seasonOf,
  type LeaderboardService,
} from './index.js';

let db = 0;
const implementations: [string, () => LeaderboardService][] = [
  ['LocalLeaderboard (memory)', () => new LocalLeaderboard()],
  [
    'LocalLeaderboard (IndexedDB)',
    () => {
      const factory = new IDBFactory();
      return new LocalLeaderboard(new IndexedDbEntryStore(() => factory, `lb-${db++}`));
    },
  ],
];

const entry = (
  playerId: string,
  score: number,
  weeks = 40,
  finishedAt = '2026-01-01',
  packId = 'classic',
): ScoreEntry => ({
  playerId,
  displayName: playerId,
  packId,
  packVersion: '0.1.0',
  engineVersion: '0.0.0',
  scoringVersion: 1,
  seed: 's',
  weeks,
  score,
  finishedAt,
  verified: true,
});

describe.each(implementations)('LeaderboardService contract: %s', (_name, make) => {
  it('submit accepts, stores as unverified in v1, and ranks by score', async () => {
    const lb = make();
    expect(await lb.submit(entry('a', 100))).toMatchObject({ accepted: true });
    await lb.submit(entry('b', 200));
    const page = await lb.query('global', { offset: 0, limit: 10 });
    expect(page.total).toBe(2);
    expect(page.entries.map((e) => e.playerId)).toEqual(['b', 'a']);
    expect(page.entries.every((e) => !e.verified)).toBe(true);
  });
  it('paginates', async () => {
    const lb = make();
    for (let i = 0; i < 5; i++) await lb.submit(entry(`p${i}`, i));
    const page = await lb.query('global', { offset: 2, limit: 2 });
    expect(page.entries.map((e) => e.score)).toEqual([2, 1]);
    expect(page.total).toBe(5);
  });
  it('myRank returns 1-based rank or null', async () => {
    const lb = make();
    await lb.submit(entry('a', 10));
    await lb.submit(entry('b', 20));
    expect(await lb.myRank('global', 'a')).toEqual({ rank: 2, total: 2 });
    expect(await lb.myRank('global', 'zz')).toBeNull();
  });
  it('season, pack and pack-season scopes filter entries; a league scope is empty locally', async () => {
    const lb = make();
    await lb.submit(entry('q1-classic', 10, 40, '2026-02-10T00:00:00Z'));
    await lb.submit(entry('q3-classic', 20, 40, '2026-08-01T00:00:00Z'));
    await lb.submit(entry('q3-modern', 30, 40, '2026-09-23T00:00:00Z', 'modern-western'));
    const ids = async (scope: string) =>
      (await lb.query(scope, { offset: 0, limit: 10 })).entries.map((e) => e.playerId);
    expect(await ids(scopes.global())).toEqual(['q3-modern', 'q3-classic', 'q1-classic']);
    expect(await ids(scopes.season('2026-Q3'))).toEqual(['q3-modern', 'q3-classic']);
    expect(await ids(scopes.pack('classic'))).toEqual(['q3-classic', 'q1-classic']);
    expect(await ids(scopes.packSeason('classic', '2026-Q1'))).toEqual(['q1-classic']);
    expect(await ids(scopes.league('friends'))).toEqual([]);
    expect(await lb.myRank(scopes.pack('classic'), 'q1-classic')).toEqual({ rank: 2, total: 2 });
  });
  it('rejects a scope it cannot parse', async () => {
    await expect(make().query('galaxy', { offset: 0, limit: 1 })).rejects.toThrow(/scope/);
  });
});

describe('tie rules (16.7)', () => {
  it('higher score, then fewer weeks, then earlier finish', () => {
    expect(compareEntries(entry('a', 10), entry('b', 20))).toBeGreaterThan(0);
    expect(compareEntries(entry('a', 10, 30), entry('b', 10, 40))).toBeLessThan(0);
    expect(
      compareEntries(entry('a', 10, 30, '2026-01-02'), entry('b', 10, 30, '2026-01-01')),
    ).toBeGreaterThan(0);
  });
});

describe('scope strings (16.7)', () => {
  it('parses every form and nothing else', () => {
    expect(parseScope('global')).toEqual({ kind: 'global' });
    expect(parseScope('season:2026-Q4')).toEqual({ kind: 'season', season: '2026-Q4' });
    expect(parseScope('pack:modern-western')).toEqual({ kind: 'pack', packId: 'modern-western' });
    expect(parseScope('pack:classic:season:2026-Q1')).toEqual({
      kind: 'pack',
      packId: 'classic',
      season: '2026-Q1',
    });
    expect(parseScope('league:abc12')).toEqual({ kind: 'league', leagueId: 'abc12' });
    expect(parseScope('league:abc12:season:2026-Q2')).toEqual({
      kind: 'league',
      leagueId: 'abc12',
      season: '2026-Q2',
    });
    for (const bad of [
      '',
      'season:2026-Q5',
      'season:26-Q1',
      'pack:',
      'pack:Classic',
      'pack:x:y',
      'x',
    ])
      expect(parseScope(bad)).toBeNull();
  });
  it('maps a timestamp to its calendar quarter', () => {
    expect(seasonOf('2026-01-01T00:00:00Z')).toBe('2026-Q1');
    expect(seasonOf('2026-06-30T23:59:59Z')).toBe('2026-Q2');
    expect(seasonOf('2026-09-23T10:00:00Z')).toBe('2026-Q3');
    expect(seasonOf('2026-12-31')).toBe('2026-Q4');
  });
});
