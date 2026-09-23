/**
 * Leaderboard scopes (ROADMAP_SCAFFOLDS 16.7). Every scope is one string, so adding one is a parser
 * change only:
 *
 *   global | season:<YYYY-Qn> | pack:<packId> | pack:<packId>:season:<YYYY-Qn>
 *   league:<leagueId> | league:<leagueId>:season:<YYYY-Qn>
 *
 * Seasons are calendar quarters of `finishedAt`. Leagues need a server that knows who is in them
 * (invite codes, up to 50 members), so a local board parses league scopes and returns no entries
 * (ADR-0037).
 */
import type { Scope, ScoreEntry } from '../types.js';

export type ParsedScope =
  | { kind: 'global' }
  | { kind: 'season'; season: string }
  | { kind: 'pack'; packId: string; season?: string }
  | { kind: 'league'; leagueId: string; season?: string };

const SEASON = /^\d{4}-Q[1-4]$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;

/** Parse a scope string; null when it is not one of the forms above. */
export function parseScope(scope: Scope): ParsedScope | null {
  if (scope === 'global') return { kind: 'global' };
  const parts = scope.split(':');
  const [head, id, tag, season] = parts;
  if (head === 'season' && parts.length === 2 && id && SEASON.test(id))
    return { kind: 'season', season: id };
  if ((head === 'pack' || head === 'league') && id && ID.test(id)) {
    if (parts.length === 2)
      return head === 'pack' ? { kind: 'pack', packId: id } : { kind: 'league', leagueId: id };
    if (parts.length === 4 && tag === 'season' && season && SEASON.test(season))
      return head === 'pack'
        ? { kind: 'pack', packId: id, season }
        : { kind: 'league', leagueId: id, season };
  }
  return null;
}

/** The season an ISO timestamp falls in, e.g. `2026-09-23T…` → `2026-Q3`. */
export function seasonOf(iso: string): string {
  const year = iso.slice(0, 4);
  const month = Number(iso.slice(5, 7));
  return `${year}-Q${Math.floor((Math.max(1, Math.min(12, month)) - 1) / 3) + 1}`;
}

/** Scope string builders, so callers never assemble one by hand. */
export const scopes = {
  global: (): Scope => 'global',
  season: (season: string): Scope => `season:${season}`,
  pack: (packId: string): Scope => `pack:${packId}`,
  packSeason: (packId: string, season: string): Scope => `pack:${packId}:season:${season}`,
  league: (leagueId: string): Scope => `league:${leagueId}`,
};

/** Whether a local entry belongs in the scope. League scopes hold nothing locally. */
export function inScope(entry: ScoreEntry, scope: ParsedScope): boolean {
  switch (scope.kind) {
    case 'global':
      return true;
    case 'season':
      return seasonOf(entry.finishedAt) === scope.season;
    case 'pack':
      return (
        entry.packId === scope.packId &&
        (scope.season === undefined || seasonOf(entry.finishedAt) === scope.season)
      );
    case 'league':
      return false;
  }
}
