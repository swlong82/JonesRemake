import type { Page, Rank, Scope, ScoreEntry, ScorePage, SubmitResult } from '../types.js';

export interface LeaderboardService {
  submit(entry: ScoreEntry): Promise<SubmitResult>;
  query(scope: Scope, page: Page): Promise<ScorePage>;
  myRank(scope: Scope, playerId: string): Promise<Rank | null>;
}

/** Tie rule (16.7): higher score, then fewer weeks, then earlier finishedAt. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return b.score - a.score || a.weeks - b.weeks || a.finishedAt.localeCompare(b.finishedAt);
}

/** v1 default: in-memory, `verified: false` always. M8.1 moves storage to IndexedDB. */
export class LocalLeaderboard implements LeaderboardService {
  private readonly entries: ScoreEntry[] = [];

  submit(entry: ScoreEntry): Promise<SubmitResult> {
    const stored: ScoreEntry = { ...entry, verified: false };
    this.entries.push(stored);
    this.entries.sort(compareEntries);
    return Promise.resolve({ accepted: true, rank: this.entries.indexOf(stored) + 1 });
  }
  query(_scope: Scope, page: Page): Promise<ScorePage> {
    return Promise.resolve({
      entries: this.entries.slice(page.offset, page.offset + page.limit),
      total: this.entries.length,
    });
  }
  myRank(_scope: Scope, playerId: string): Promise<Rank | null> {
    const i = this.entries.findIndex((e) => e.playerId === playerId);
    return Promise.resolve(i < 0 ? null : { rank: i + 1, total: this.entries.length });
  }
}
