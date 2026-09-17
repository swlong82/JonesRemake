/**
 * @hustle-ring/ai — utility planner, personalities, difficulty tiers (GDD 4.14, EXTENSIBILITY 12.6).
 * May only import shared, content, engine. Never reads hidden information (see view.ts).
 */
export const AI_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type AiDifficulty = (typeof AI_DIFFICULTIES)[number];

export function isAiDifficulty(value: string): value is AiDifficulty {
  return (AI_DIFFICULTIES as readonly string[]).includes(value);
}

export * from './config.js';
export * from './view.js';
export * from './scorers.js';
export * from './planner.js';
