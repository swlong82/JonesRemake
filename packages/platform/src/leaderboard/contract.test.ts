import { describe, expect, it } from 'vitest';
import type { ScoreEntry } from '../types.js';
import { compareEntries, LocalLeaderboard, type LeaderboardService } from './index.js';

const implementations: [string, () => LeaderboardService][] = [
  ['LocalLeaderboard', () => new LocalLeaderboard()],
];

const entry = (
  playerId: string,
  score: number,
  weeks = 40,
  finishedAt = '2026-01-01',
): ScoreEntry => ({
  playerId,
  displayName: playerId,
  packId: 'classic',
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
  it.todo('scope parsing: season / pack / league scopes filter entries (M8.1)');
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
