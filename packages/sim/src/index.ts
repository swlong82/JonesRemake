/**
 * @hustle-ring/sim — headless runner, stats aggregation, report writers (BALANCE_SPEC 9.1).
 *
 * STUB — M3 implements the harness. The CLI (`cli.ts`) already parses the gate config so
 * `pnpm sim:gate` is wired end to end and fails loudly once real gates exist without a runner.
 */

export interface GateConfig {
  readonly id: string;
  readonly pack: string;
  readonly seats: number;
  readonly ai: readonly string[];
  readonly goals: number;
  readonly asserts: Readonly<Record<string, { min?: number; max?: number }>>;
}

export interface GatesFile {
  readonly gamesPerConfig: number;
  readonly configs: readonly GateConfig[];
}

export function parseGatesFile(raw: unknown): GatesFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('gates file must be an object');
  const obj = raw as Record<string, unknown>;
  const gamesPerConfig = obj.gamesPerConfig;
  const configs = obj.configs;
  if (typeof gamesPerConfig !== 'number' || gamesPerConfig <= 0) {
    throw new Error('gamesPerConfig must be a positive number');
  }
  if (!Array.isArray(configs)) throw new Error('configs must be an array');
  return { gamesPerConfig, configs: configs as GateConfig[] };
}
