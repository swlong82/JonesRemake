/**
 * Sim configuration types (BALANCE_SPEC 9.1). A `RunSpec` describes one batch of seeded games;
 * `GameSpec` is one game. Everything is JSON so worker threads can receive it verbatim.
 */
import type { Chaos, Difficulty } from '@hustle-ring/shared';

export type SeatSpec =
  { kind: 'ai'; difficulty: Difficulty; personality: string } | { kind: 'bot'; bot: string };

export interface RunSpec {
  id: string;
  packId: string;
  games: number;
  seedBase: string;
  seats: SeatSpec[];
  /** All four goals equal (BALANCE 9.3); 0 = keep the AI's random goals. */
  goals: number;
  chaos: Chaos;
  /** Game stops without a winner at this week (9.1: 300). */
  stallWeek: number;
}

export interface GameSpec {
  runId: string;
  packId: string;
  seed: string;
  seats: SeatSpec[];
  goals: number;
  chaos: Chaos;
  stallWeek: number;
}

/** Deterministic per-game seed: `<seedBase>-<i>` (9.1). */
export function gameSpecs(run: RunSpec): GameSpec[] {
  const out: GameSpec[] = [];
  for (let i = 0; i < run.games; i++) {
    out.push({
      runId: run.id,
      packId: run.packId,
      seed: `${run.seedBase}-${i}`,
      seats: run.seats,
      goals: run.goals,
      chaos: run.chaos,
      stallWeek: run.stallWeek,
    });
  }
  return out;
}

const DIFFS = new Set(['easy', 'normal', 'hard']);

/** Parse `--ai normal,hard` / `--ai bot:StudyFirst,normal` into seat specs (personalities rotate). */
export function parseSeats(
  ai: string,
  seats: number,
  personalities: readonly string[],
): SeatSpec[] {
  const parts = ai
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: SeatSpec[] = [];
  for (let i = 0; i < seats; i++) {
    const raw = parts[i % Math.max(1, parts.length)] ?? 'normal';
    if (raw.startsWith('bot:')) {
      out.push({ kind: 'bot', bot: raw.slice(4) });
      continue;
    }
    const [d, p] = raw.split(':');
    if (!d || !DIFFS.has(d)) throw new Error(`unknown AI difficulty "${raw}"`);
    out.push({
      kind: 'ai',
      difficulty: d as Difficulty,
      personality: p ?? personalities[i % personalities.length] ?? 'balanced',
    });
  }
  return out;
}
