/**
 * Stage-2 target lock (BALANCE_SPEC 9.5, M6.2). `reports/modern-targets.json` is written once and
 * never edited: these helpers hash it and read back the hash recorded in the ADR, so an edit after
 * the first commit fails `pnpm test` instead of quietly moving the goalposts. Pure functions over
 * already-read text; the test does the I/O.
 */
import { createHash } from 'node:crypto';

export interface ModernTarget {
  readonly id: string;
  readonly gate: string;
  readonly config: string;
  readonly metric: string;
  readonly min?: number;
  readonly max?: number;
  readonly appliesTo?: readonly string[];
  readonly derivation: string;
}

export interface ModernTargets {
  readonly spec: string;
  readonly pack: string;
  readonly lockedAt: string;
  readonly adr: string;
  readonly derivedFrom: { readonly file: string; readonly sha256: string };
  readonly baseline: {
    readonly source: string;
    readonly medianLengthByGoal: Readonly<Record<string, number>>;
  };
  readonly targets: readonly ModernTarget[];
}

/** sha256 of exactly the bytes on disk — the lock is over the file, not over a re-serialisation. */
export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The hash an ADR records for a locked file, read from a `- Locked sha256 (<file>): \`<hex>\`` line
 * inside that ADR's section. Returns null when the ADR or the line is missing.
 */
export function lockedHashFrom(markdown: string, adr: string, file: string): string | null {
  const start = markdown.indexOf(`## ${adr}:`);
  if (start < 0) return null;
  const rest = markdown.slice(start);
  const end = rest.indexOf('\n## ');
  const section = end < 0 ? rest : rest.slice(0, end);
  const re = new RegExp(
    `Locked sha256 \\(${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\): \`([0-9a-f]{64})\``,
  );
  return re.exec(section)?.[1] ?? null;
}

/** ±20% of a baseline median, rounded outward to whole weeks (BALANCE 9.5 "within ±20% of B"). */
export function toleranceBand(baselineMedian: number): { min: number; max: number } {
  return {
    min: Math.floor(baselineMedian * 0.8),
    max: Math.ceil(baselineMedian * 1.2),
  };
}

/**
 * Structural problems in the locked file, as human-readable lines. Empty means the file says what
 * BALANCE 9.5 says: every median target is the baseline's ±20% band, every target names a bound,
 * and ids are unique.
 */
export function targetProblems(
  targets: ModernTargets,
  baselineMedians: Readonly<Record<string, number>>,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const t of targets.targets) {
    if (seen.has(t.id)) problems.push(`duplicate target id ${t.id}`);
    seen.add(t.id);
    if (t.min === undefined && t.max === undefined) problems.push(`${t.id} has no bound`);
    if (t.min !== undefined && t.max !== undefined && t.min > t.max)
      problems.push(`${t.id} has min > max`);
    const goal = /^median-(\d+)$/.exec(t.id)?.[1];
    if (!goal) continue;
    const b = baselineMedians[goal];
    if (b === undefined) {
      problems.push(`${t.id} has no baseline median for goals ${goal}`);
      continue;
    }
    const band = toleranceBand(b);
    if (t.min !== band.min || t.max !== band.max)
      problems.push(
        `${t.id} band ${String(t.min)}–${String(t.max)} is not ±20% of B=${String(b)} (${String(band.min)}–${String(band.max)})`,
      );
  }
  return problems;
}
