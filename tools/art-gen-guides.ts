#!/usr/bin/env tsx
/**
 * `pnpm art:gen:guides [--pilot | --group building|interior|avatar|host | --slots a,b]`
 *
 * Step 1 of the realistic art pipeline (GRAPHICS_PLAN, art/gen/README.md). For each chosen slot of
 * the `default` art set it renders the SVG to a PNG at generation size (the silhouette and layout
 * guide for the image model, and later the cut-out mask) and writes `art/gen/work/jobs.json`: one
 * job per slot with the prompt, sizes and file paths. No model and no network are involved, so it
 * runs anywhere Node runs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ArtManifestSchema } from '@hustle-ring/art';
import { catalogFromPacks, readSet } from './lib/art.js';

const root = resolve(import.meta.dirname, '..');
const genDir = join(root, 'art/gen');
const workDir = join(genDir, 'work');
const style = JSON.parse(readFileSync(join(genDir, 'style.json'), 'utf8')) as Style;
const subjects = JSON.parse(readFileSync(join(genDir, 'subjects.json'), 'utf8')) as Subjects;

interface Style {
  preamble: string;
  objectSuffix: string;
  sceneSuffix: string;
  personSuffix: string;
  negative: string;
}
interface Subjects {
  building: Record<string, string>;
  interior: Record<string, string>;
  host: Record<string, string>;
  avatar: Record<string, string>;
  pose: Record<string, string>;
}

/** The slice that proves the pipeline before the whole set is made (see the plan's pilot gate). */
export const PILOT_SLOTS = [
  'building:bank',
  'building:grocery',
  'building:clothing-boutique',
  'interior:clothing-boutique',
  'avatar:player-1:idle:s',
  'avatar:player-1:walk1:e',
  'avatar:player-1:walk2:e',
] as const;

export type Kind = 'building' | 'interior' | 'avatar' | 'host';

export interface Job {
  key: string;
  slug: string;
  kind: Kind;
  /** Cut out with the guide's silhouette (object slots) or keep the full frame (scenes). */
  alpha: boolean;
  guide: string;
  genWidth: number;
  genHeight: number;
  /** Final pixel size of the shipped WebP. */
  outWidth: number;
  outHeight: number;
  /** Logical size from the catalog (what the manifest and the layout use). */
  logicalWidth: number;
  logicalHeight: number;
  prompt: string;
  negative: string;
}

const SIZES: Record<Kind, { genW: number; out: [number, number] }> = {
  building: { genW: 1024, out: [480, 480] },
  interior: { genW: 1280, out: [1280, 800] },
  avatar: { genW: 768, out: [128, 192] },
  host: { genW: 768, out: [400, 600] },
};

/** Rough CLIP token count (words and punctuation); the real tokenizer is checked at generation time. */
export const roughTokens = (text: string): number => (text.match(/\w+|[^\w\s]/g) ?? []).length;

export const slugOf = (key: string): string => key.replaceAll(':', '.');

export function promptFor(key: string): { kind: Kind; prompt: string } | null {
  const [kind, id, pose] = key.split(':') as [Kind, string, string?];
  const s = style;
  if (kind === 'building') {
    const what = subjects.building[id];
    return what ? { kind, prompt: `${what}, ${s.preamble}, ${s.objectSuffix}` } : null;
  }
  if (kind === 'interior') {
    const what = subjects.interior[id];
    return what ? { kind, prompt: `interior of ${what}, ${s.preamble}, ${s.sceneSuffix}` } : null;
  }
  if (kind === 'host') {
    const what = subjects.host.default;
    return what ? { kind, prompt: `${what}, ${s.preamble}, ${s.personSuffix}` } : null;
  }
  const who = subjects.avatar[id];
  const how = subjects.pose[pose ?? 'idle'];
  return who && how ? { kind, prompt: `${who}, ${how}, ${s.preamble}, ${s.personSuffix}` } : null;
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (n: string): string | undefined => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const { catalog } = catalogFromPacks();
  const set = readSet(resolve(root, 'packages/art/sets'), 'default');
  const manifest = ArtManifestSchema.parse(set.manifest);

  let keys: string[];
  if (args.includes('--pilot')) keys = [...PILOT_SLOTS];
  else if (flag('slots')) keys = flag('slots')!.split(',');
  else {
    const group = flag('group');
    keys = catalog
      .map((c) => c.key)
      .filter((k) => promptFor(k) !== null && (group === undefined || k.startsWith(`${group}:`)));
  }

  mkdirSync(join(workDir, 'guides'), { recursive: true });
  const jobs: Job[] = [];
  for (const key of keys) {
    const slot = catalog.find((c) => c.key === key);
    const entry = manifest.assets[key];
    const p = promptFor(key);
    if (!slot || !entry || !p) {
      console.error(`✗ ${key}: not a known slot with a subject description`);
      process.exitCode = 1;
      continue;
    }
    const tokens = roughTokens(p.prompt);
    if (tokens > 70)
      console.warn(
        `! ${key}: prompt is about ${tokens} tokens; CLIP keeps 77. Shorten style.json or subjects.json`,
      );
    const size = SIZES[p.kind];
    const svg = set.files.get(entry.file);
    if (svg === undefined) {
      console.error(`✗ ${key}: file ${entry.file} missing from the default set`);
      process.exitCode = 1;
      continue;
    }
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: size.genW } }).render();
    const slug = slugOf(key);
    writeFileSync(join(workDir, 'guides', `${slug}.png`), png.asPng());
    jobs.push({
      key,
      slug,
      kind: p.kind,
      alpha: p.kind !== 'interior',
      guide: `guides/${slug}.png`,
      genWidth: png.width,
      genHeight: png.height,
      outWidth: size.out[0],
      outHeight: size.out[1],
      logicalWidth: slot.width,
      logicalHeight: slot.height,
      prompt: p.prompt,
      negative: style.negative,
    });
    console.log(`✓ ${key}: guide ${png.width}×${png.height}`);
  }
  writeFileSync(join(workDir, 'jobs.json'), `${JSON.stringify({ jobs }, null, 2)}\n`);
  console.log(`art:gen:guides — ${jobs.length} job(s) → art/gen/work/jobs.json`);
}

main();
