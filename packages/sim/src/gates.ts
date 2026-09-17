/**
 * Gate configs (`sim/gates.json`, BALANCE_SPEC 9.7): each config is a RunSpec plus assertions
 * on summary metrics (dotted paths → { min?, max? }). Cross-config assertions (monotone medians,
 * Hard-vs-Easy) are expressed with `compare` entries.
 */
import { z } from 'zod';
import type { RunSpec } from './spec.js';
import { parseSeats } from './spec.js';
import { metric, type Summary } from './metrics.js';

const assertSchema = z
  .object({ min: z.number().optional(), max: z.number().optional(), note: z.string().optional() })
  .strict();

export const gateConfigSchema = z
  .object({
    id: z.string().min(1),
    pack: z.string().min(1),
    seats: z.number().int().min(1).max(4),
    ai: z.string().min(1),
    goals: z.number().int().nonnegative(),
    chaos: z.enum(['off', 'classic', 'modern', 'chaotic']).default('classic'),
    games: z.number().int().positive().optional(),
    seedBase: z.string().optional(),
    stallWeek: z.number().int().positive().default(300),
    asserts: z.record(z.string(), assertSchema).default({}),
  })
  .strict();

export const compareSchema = z
  .object({
    id: z.string().min(1),
    /** `<configId>.<metric>` on both sides. */
    left: z.string().min(1),
    right: z.string().min(1),
    op: z.enum(['<', '<=', '>', '>=']),
    note: z.string().optional(),
  })
  .strict();

export const gatesFileSchema = z
  .object({
    $comment: z.string().optional(),
    gamesPerConfig: z.number().int().positive(),
    configs: z.array(gateConfigSchema),
    compare: z.array(compareSchema).default([]),
  })
  .strict();

export type GateConfig = z.infer<typeof gateConfigSchema>;
export type GatesFile = z.infer<typeof gatesFileSchema>;

export function parseGatesFile(raw: unknown): GatesFile {
  const r = gatesFileSchema.safeParse(raw);
  if (!r.success)
    throw new Error(
      `invalid gates file: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  return r.data;
}

export function gateRunSpec(
  cfg: GateConfig,
  gamesPerConfig: number,
  personalities: readonly string[],
): RunSpec {
  return {
    id: cfg.id,
    packId: cfg.pack,
    games: cfg.games ?? gamesPerConfig,
    seedBase: cfg.seedBase ?? `gate-${cfg.id}`,
    seats: parseSeats(cfg.ai, cfg.seats, personalities),
    goals: cfg.goals,
    chaos: cfg.chaos,
    stallWeek: cfg.stallWeek,
  };
}

export interface GateOutcome {
  id: string;
  metric: string;
  target: string;
  achieved: number | undefined;
  pass: boolean;
  note?: string;
}

export function evaluateGates(file: GatesFile, summaries: Record<string, Summary>): GateOutcome[] {
  const out: GateOutcome[] = [];
  for (const cfg of file.configs) {
    const s = summaries[cfg.id];
    for (const [path, a] of Object.entries(cfg.asserts)) {
      const v = s ? metric(s, path) : undefined;
      const target = [
        a.min !== undefined ? `≥ ${a.min}` : '',
        a.max !== undefined ? `≤ ${a.max}` : '',
      ]
        .filter(Boolean)
        .join(' and ');
      const pass =
        v !== undefined &&
        (a.min === undefined || v >= a.min) &&
        (a.max === undefined || v <= a.max);
      out.push({
        id: cfg.id,
        metric: path,
        target,
        achieved: v,
        pass,
        ...(a.note ? { note: a.note } : {}),
      });
    }
  }
  for (const c of file.compare) {
    const [lc, ...lp] = c.left.split('.');
    const [rc, ...rp] = c.right.split('.');
    const lv = summaries[lc!] ? metric(summaries[lc!]!, lp.join('.')) : undefined;
    const rv = summaries[rc!] ? metric(summaries[rc!]!, rp.join('.')) : undefined;
    const pass =
      lv !== undefined &&
      rv !== undefined &&
      (c.op === '<' ? lv < rv : c.op === '<=' ? lv <= rv : c.op === '>' ? lv > rv : lv >= rv);
    out.push({
      id: c.id,
      metric: `${c.left} ${c.op} ${c.right}`,
      target: `${c.op} ${rv ?? '?'}`,
      achieved: lv,
      pass,
      ...(c.note ? { note: c.note } : {}),
    });
  }
  return out;
}
