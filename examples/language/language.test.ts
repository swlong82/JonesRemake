/**
 * Recipe: add a language (docs/EXTENDING.md). A translation bundle must use keys the English
 * bundle has and keep every `{{placeholder}}` of the string it translates.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sample from './es-sample.json';

const en = JSON.parse(
  readFileSync(new URL('../../apps/web/src/i18n/en.json', import.meta.url), 'utf8'),
) as Record<string, string>;

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();

/** Problems a translation bundle has against the English source. */
export function bundleProblems(
  source: Record<string, string>,
  bundle: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(bundle)) {
    const src = source[k];
    if (src === undefined) {
      out.push(`${k}: not an English key`);
      continue;
    }
    if (placeholders(src).join() !== placeholders(v).join())
      out.push(`${k}: placeholders ${placeholders(v).join()} ≠ ${placeholders(src).join()}`);
  }
  return out;
}

describe('recipe: add a language', () => {
  it('the sample bundle uses real keys and keeps every placeholder', () => {
    expect(bundleProblems(en, sample)).toEqual([]);
  });

  it('the check catches an unknown key and a dropped placeholder', () => {
    expect(bundleProblems(en, { 'no.such.key': 'x', 'stats.weeks': 'semanas' })).toEqual([
      'no.such.key: not an English key',
      'stats.weeks: placeholders  ≠ n',
    ]);
  });
});
