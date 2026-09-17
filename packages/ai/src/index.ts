/**
 * @hustle-ring/ai — utility planner, personalities, difficulty tiers (GDD 4.14, EXTENSIBILITY 12.6).
 * May only import shared, content, engine. Must never read hidden information (CLAUDE.md 1.3).
 *
 * STUB — M2 implements the planner.
 */

export const AI_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type AiDifficulty = (typeof AI_DIFFICULTIES)[number];

export function isAiDifficulty(value: string): value is AiDifficulty {
  return (AI_DIFFICULTIES as readonly string[]).includes(value);
}
