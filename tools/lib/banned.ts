import { readFileSync } from 'node:fs';
import fg from 'fast-glob';

export interface BannedConfig {
  readonly terms: readonly string[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

export interface Hit {
  readonly file: string;
  readonly line: number;
  readonly term: string;
  readonly text: string;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One regex per term: case-insensitive, whole word (`\b` boundaries), spaces match any whitespace run. */
export function compileTerms(terms: readonly string[]): { term: string; re: RegExp }[] {
  return terms.map((term) => ({
    term,
    re: new RegExp(`\\b${escape(term).replace(/\s+/g, '\\s+')}\\b`, 'i'),
  }));
}

export function scanText(
  text: string,
  file: string,
  compiled: ReturnType<typeof compileTerms>,
): Hit[] {
  const hits: Hit[] = [];
  text.split('\n').forEach((line, i) => {
    for (const { term, re } of compiled) {
      if (re.test(line)) hits.push({ file, line: i + 1, term, text: line.trim().slice(0, 120) });
    }
  });
  return hits;
}

export async function scanFiles(config: BannedConfig, cwd: string): Promise<Hit[]> {
  const files = await fg([...config.include], {
    cwd,
    ignore: [...config.exclude],
    dot: false,
    onlyFiles: true,
  });
  const compiled = compileTerms(config.terms);
  const hits: Hit[] = [];
  for (const file of files.sort()) {
    hits.push(...scanText(readFileSync(`${cwd}/${file}`, 'utf8'), file, compiled));
  }
  return hits;
}
