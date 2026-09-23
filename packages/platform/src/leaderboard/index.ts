import type { Page, Rank, Scope, ScoreEntry, ScorePage, SubmitResult } from '../types.js';
import { inScope, parseScope } from './scope.js';

export * from './scope.js';
export { IndexedDbEntryStore } from './indexedDb.js';

export interface LeaderboardService {
  submit(entry: ScoreEntry): Promise<SubmitResult>;
  query(scope: Scope, page: Page): Promise<ScorePage>;
  myRank(scope: Scope, playerId: string): Promise<Rank | null>;
}

/** Tie rule (16.7): higher score, then fewer weeks, then earlier finishedAt. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return b.score - a.score || a.weeks - b.weeks || a.finishedAt.localeCompare(b.finishedAt);
}

/** Where a local board keeps its entries. */
export interface EntryStore {
  load(): Promise<ScoreEntry[]>;
  append(entry: ScoreEntry): Promise<void>;
}

export class MemoryEntryStore implements EntryStore {
  private readonly entries: ScoreEntry[] = [];
  load(): Promise<ScoreEntry[]> {
    return Promise.resolve([...this.entries]);
  }
  append(entry: ScoreEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

/**
 * v1 default (16.7): a device-local board. Every entry is stored `verified: false`; v2 swaps in a
 * remote service that verifies by replaying the command log. An unknown scope is an error, a league
 * scope is empty (leagues need a server), and every other scope filters the same entries.
 */
export class LocalLeaderboard implements LeaderboardService {
  constructor(private readonly store: EntryStore = new MemoryEntryStore()) {}

  async submit(entry: ScoreEntry): Promise<SubmitResult> {
    const stored: ScoreEntry = { ...entry, verified: false };
    await this.store.append(stored);
    const all = (await this.store.load()).sort(compareEntries);
    return { accepted: true, rank: rankOf(all, stored) };
  }

  async query(scope: Scope, page: Page): Promise<ScorePage> {
    const entries = await this.inScope(scope);
    return { entries: entries.slice(page.offset, page.offset + page.limit), total: entries.length };
  }

  async myRank(scope: Scope, playerId: string): Promise<Rank | null> {
    const entries = await this.inScope(scope);
    const i = entries.findIndex((e) => e.playerId === playerId);
    return i < 0 ? null : { rank: i + 1, total: entries.length };
  }

  private async inScope(scope: Scope): Promise<ScoreEntry[]> {
    const parsed = parseScope(scope);
    if (!parsed) throw new Error(`Unknown leaderboard scope "${scope}"`);
    return (await this.store.load()).filter((e) => inScope(e, parsed)).sort(compareEntries);
  }
}

function rankOf(sorted: ScoreEntry[], entry: ScoreEntry): number {
  return (
    sorted.findIndex((e) => compareEntries(e, entry) === 0 && e.playerId === entry.playerId) + 1
  );
}
