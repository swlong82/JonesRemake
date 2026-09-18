/**
 * Pack resolution: raw JSON files → validated → overlay-merged → unit-converted `CityPack`.
 * Cross-file validators (CONTENT_SCHEMAS 6.1) run after merge and report path-specific issues.
 */
import type { Chaos, HomeTier, JsonValue, UniformTier } from '@hustle-ring/shared';
import { z } from 'zod';
import { mergeFile } from './overlay.js';
import {
  assetSchema,
  assetsRegistrySchema,
  boardSchema,
  clothingSchema,
  degreeSchema,
  eventSchema,
  itemSchema,
  jobSchema,
  layoutSchema,
  loansSchema,
  locationSchema,
  mealSchema,
  overlayArray,
  personalitySchema,
  subscriptionSchema,
  transportModeSchema,
  type EventSpec,
} from './schemas/entities.js';
import {
  FEATURE_FLAG_IDS,
  PackManifestSchema,
  type FeatureFlags,
  type PackManifest,
} from './schemas/pack.js';
import { rulesSchema, type RulesFile } from './schemas/rules.js';
import type {
  CityPack,
  ResolvedBoard,
  ResolvedItem,
  ResolvedJob,
  ResolvedTransportMode,
} from './types.js';
import { collectI18nIssues } from './validators/i18n.js';
import { crossFileIssues } from './validators/cross.js';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** Raw pack: file name → parsed JSON. `pack.json` is required, everything else optional. */
export type RawPackFiles = Record<string, JsonValue>;

export const ARRAY_FILES = [
  'locations.json',
  'jobs.json',
  'degrees.json',
  'items.json',
  'meals.json',
  'clothing.json',
  'transport.json',
  'subscriptions.json',
  'assets.json',
  'events.json',
  'personalities.json',
] as const;
export const OBJECT_FILES = [
  'rules.json',
  'board.json',
  'loans.json',
  'i18n/en.json',
  'assets.registry.json',
  'layout.json',
] as const;

const FILE_SCHEMAS = {
  'locations.json': overlayArray(locationSchema),
  'jobs.json': overlayArray(jobSchema),
  'degrees.json': overlayArray(degreeSchema),
  'items.json': overlayArray(itemSchema),
  'meals.json': overlayArray(mealSchema),
  'clothing.json': overlayArray(clothingSchema),
  'transport.json': overlayArray(transportModeSchema),
  'subscriptions.json': overlayArray(subscriptionSchema),
  'assets.json': overlayArray(assetSchema),
  'events.json': overlayArray(eventSchema),
  'personalities.json': overlayArray(personalitySchema),
  'board.json': boardSchema,
  'loans.json': loansSchema,
  'i18n/en.json': z.record(z.string(), z.string()),
  'assets.registry.json': assetsRegistrySchema,
  'layout.json': layoutSchema,
} as const;

function zodIssues(prefix: string, error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    path: [prefix, ...i.path.map(String)].join('.'),
    message: i.message,
  }));
}

/** Validate every file of a single (unmerged) pack folder against its schema. Overlay-tolerant: rules.json may be partial. */
export function validateRawFiles(files: RawPackFiles, isOverlay: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const manifest = PackManifestSchema.safeParse(files['pack.json']);
  if (!manifest.success) issues.push(...zodIssues('pack.json', manifest.error));
  for (const [name, schema] of Object.entries(FILE_SCHEMAS)) {
    const raw = files[name];
    if (raw === undefined) continue;
    const r = schema.safeParse(raw);
    if (!r.success) issues.push(...zodIssues(name, r.error));
  }
  // Overlays may carry a partial rules.json; the merged result is validated in full by buildPack.
  const rules = files['rules.json'];
  if (rules !== undefined && !isOverlay) {
    const r = rulesSchema.safeParse(rules);
    if (!r.success) issues.push(...zodIssues('rules.json', r.error));
  }
  for (const name of Object.keys(files)) {
    if (
      name !== 'pack.json' &&
      name !== 'rules.json' &&
      name !== 'world.json' &&
      !(name in FILE_SCHEMAS)
    ) {
      issues.push({ path: name, message: 'unknown pack file' });
    }
  }
  return issues;
}

/** Resolve `extends` chain (root first). Throws on cycles or missing parents. */
export function resolveChain(
  packId: string,
  lookup: (id: string) => RawPackFiles | undefined,
): RawPackFiles[] {
  const chain: RawPackFiles[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = packId;
  while (cur !== undefined) {
    if (seen.has(cur)) throw new Error(`pack extends cycle at "${cur}"`);
    seen.add(cur);
    const files = lookup(cur);
    if (!files) throw new Error(`pack "${cur}" not found (referenced by extends)`);
    chain.unshift(files);
    const m = PackManifestSchema.safeParse(files['pack.json']);
    cur = m.success ? m.data.extends : undefined;
  }
  return chain;
}

export function mergeChain(chain: RawPackFiles[]): RawPackFiles {
  let acc: RawPackFiles = {};
  for (const files of chain) {
    const next: RawPackFiles = { ...acc };
    for (const name of ARRAY_FILES) {
      const m = mergeFile(acc[name], files[name], 'array');
      if (m !== undefined) next[name] = m;
    }
    for (const name of OBJECT_FILES) {
      const m = mergeFile(acc[name], files[name], 'object');
      if (m !== undefined) next[name] = m;
    }
    // Manifest: child wins wholesale except featureFlags which deep-merge.
    const childManifest = files['pack.json'];
    const baseManifest = acc['pack.json'];
    next['pack.json'] =
      baseManifest === undefined
        ? childManifest!
        : mergeFile(baseManifest, childManifest, 'object')!;
    acc = next;
  }
  return acc;
}

const HALF = 2;
function toHalfHours(hours: number, path: string, issues: ValidationIssue[]): number {
  const hh = hours * HALF;
  if (!Number.isInteger(hh))
    issues.push({ path, message: `hours must be a multiple of 0.5, got ${hours}` });
  return Math.round(hh);
}

function convertRules(rules: RulesFile, issues: ValidationIssue[]): RulesFile {
  const t = rules.time;
  const time = {
    ...t,
    weekHours: toHalfHours(t.weekHours, 'rules.time.weekHours', issues),
    enterHours: toHalfHours(t.enterHours, 'rules.time.enterHours', issues),
    workSessionHours: toHalfHours(t.workSessionHours, 'rules.time.workSessionHours', issues),
    lessonHours: toHalfHours(t.lessonHours, 'rules.time.lessonHours', issues),
    relaxHours: toHalfHours(t.relaxHours, 'rules.time.relaxHours', issues),
    applyHours: toHalfHours(t.applyHours, 'rules.time.applyHours', issues),
    raiseHours: toHalfHours(t.raiseHours, 'rules.time.raiseHours', issues),
    extensionHours: toHalfHours(t.extensionHours, 'rules.time.extensionHours', issues),
    starvationHours: toHalfHours(t.starvationHours, 'rules.time.starvationHours', issues),
    doctorHours: toHalfHours(t.doctorHours, 'rules.time.doctorHours', issues),
    deliveryHours: toHalfHours(t.deliveryHours, 'rules.time.deliveryHours', issues),
    gigSignupHours: toHalfHours(t.gigSignupHours, 'rules.time.gigSignupHours', issues),
    gigShiftHours: t.gigShiftHours.map((h, i) =>
      toHalfHours(h, `rules.time.gigShiftHours.${i}`, issues),
    ),
  };
  const w = rules.wellbeing;
  const wellbeing = {
    ...w,
    unspentHoursThreshold: toHalfHours(
      w.unspentHoursThreshold,
      'rules.wellbeing.unspentHoursThreshold',
      issues,
    ),
    burnoutHours: toHalfHours(w.burnoutHours, 'rules.wellbeing.burnoutHours', issues),
  };
  return { ...rules, time, wellbeing };
}

function scale(price: number, pm: number): number {
  return Math.round((price * pm) / 1000);
}

export function buildBoard(
  board: z.infer<typeof boardSchema>,
  issues: ValidationIssue[],
): ResolvedBoard {
  if (board.topology === 'ring') {
    const n = board.squares.length;
    const nodes = board.squares.map((_, i) => `sq${i}`);
    const locationAt = board.squares.map((s) => s.locationId);
    const nodeOf: Record<string, number> = {};
    locationAt.forEach((loc, i) => {
      if (loc === null) return;
      if (loc in nodeOf)
        issues.push({ path: `board.squares.${i}`, message: `location "${loc}" appears twice` });
      nodeOf[loc] = i;
    });
    const dist: number[][] = [];
    for (let a = 0; a < n; a++) {
      const row: number[] = [];
      for (let b = 0; b < n; b++) {
        const cw = (b - a + n) % n;
        row.push(Math.min(cw, n - cw));
      }
      dist.push(row);
    }
    return { topology: 'ring', nodes, locationAt, nodeOf, dist, ringSize: n };
  }
  const nodes = board.nodes.map((nd) => nd.id);
  const index = new Map(nodes.map((id, i) => [id, i]));
  const n = nodes.length;
  const INF = 1_000_000;
  const dist: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)),
  );
  for (const [ei, e] of board.edges.entries()) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined) {
      issues.push({ path: `board.edges.${ei}`, message: `edge references unknown node` });
      continue;
    }
    dist[a]![b] = Math.min(dist[a]![b]!, e.steps);
    dist[b]![a] = Math.min(dist[b]![a]!, e.steps);
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const via = dist[i]![k]! + dist[k]![j]!;
        if (via < dist[i]![j]!) dist[i]![j] = via;
      }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (dist[i]![j]! >= INF)
        issues.push({ path: 'board', message: `graph not connected (${nodes[i]} ↛ ${nodes[j]})` });
  const locationAt = board.nodes.map((nd) => nd.locationId);
  const nodeOf: Record<string, number> = {};
  locationAt.forEach((loc, i) => {
    if (loc !== null) nodeOf[loc] = i;
  });
  return { topology: 'graph', nodes, locationAt, nodeOf, dist, ringSize: 0 };
}

function byId<T extends { id: string }>(arr: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const e of arr) out[e.id] = e;
  return out;
}

function parseArray<S extends z.ZodTypeAny>(
  schema: S,
  raw: JsonValue | undefined,
  name: string,
  issues: ValidationIssue[],
): z.output<S>[] {
  if (raw === undefined) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out: z.output<S>[] = [];
  arr.forEach((e, i) => {
    const r = schema.safeParse(e);
    if (r.success) out.push(r.data as z.output<S>);
    else issues.push(...zodIssues(`${name}.${i}`, r.error));
  });
  return out;
}

export type ResolveResult = { ok: true; pack: CityPack } | { ok: false; issues: ValidationIssue[] };

/** Build a CityPack from an already-merged file set. */
export function buildPack(merged: RawPackFiles): ResolveResult {
  const issues: ValidationIssue[] = [];
  const manifestR = PackManifestSchema.safeParse(merged['pack.json']);
  if (!manifestR.success) return { ok: false, issues: zodIssues('pack.json', manifestR.error) };
  const manifest: PackManifest = manifestR.data;
  const flags = Object.fromEntries(
    FEATURE_FLAG_IDS.map((f) => [f, manifest.featureFlags[f] ?? false]),
  ) as FeatureFlags;

  const rulesR = rulesSchema.safeParse(merged['rules.json']);
  if (!rulesR.success) return { ok: false, issues: zodIssues('rules.json', rulesR.error) };
  const rules = convertRules(rulesR.data, issues);

  const boardR = boardSchema.safeParse(merged['board.json']);
  if (!boardR.success) return { ok: false, issues: zodIssues('board.json', boardR.error) };
  const board = buildBoard(boardR.data, issues);

  const ps = manifest.priceScale;
  const locations = parseArray(locationSchema, merged['locations.json'], 'locations', issues);
  const jobsRaw = parseArray(jobSchema, merged['jobs.json'], 'jobs', issues);
  const degrees = parseArray(degreeSchema, merged['degrees.json'], 'degrees', issues);
  const itemsRaw = parseArray(itemSchema, merged['items.json'], 'items', issues);
  const meals = parseArray(mealSchema, merged['meals.json'], 'meals', issues).map((m) => ({
    ...m,
    price: scale(m.price, ps),
  }));
  const clothing = parseArray(clothingSchema, merged['clothing.json'], 'clothing', issues).map(
    (c) => ({ ...c, price: scale(c.price, ps) }),
  );
  const transportRaw = parseArray(
    transportModeSchema,
    merged['transport.json'],
    'transport',
    issues,
  );
  const subscriptions = parseArray(
    subscriptionSchema,
    merged['subscriptions.json'],
    'subscriptions',
    issues,
  ).map((s) => ({ ...s, weeklyPrice: scale(s.weeklyPrice, ps) }));
  const allAssets = parseArray(assetSchema, merged['assets.json'], 'assets', issues);
  // EXTENSIBILITY 12.4: the modern instruments replace the classic six rather than joining them.
  const assetSet = flags.modernAssets ? 'modern' : 'classic';
  const assets = allAssets.filter((a) => a.set === assetSet);
  const events: EventSpec[] = parseArray(eventSchema, merged['events.json'], 'events', issues);
  const personalities = parseArray(
    personalitySchema,
    merged['personalities.json'],
    'personalities',
    issues,
  );
  let loans = null;
  if (merged['loans.json'] !== undefined) {
    const r = loansSchema.safeParse(merged['loans.json']);
    if (r.success) loans = r.data;
    else issues.push(...zodIssues('loans.json', r.error));
  }
  const i18nR = z.record(z.string(), z.string()).safeParse(merged['i18n/en.json'] ?? {});
  const i18n = i18nR.success ? i18nR.data : {};
  if (!i18nR.success) issues.push(...zodIssues('i18n/en.json', i18nR.error));
  const visualsR = assetsRegistrySchema.safeParse(merged['assets.registry.json'] ?? {});
  const visuals = visualsR.success ? visualsR.data : {};
  if (!visualsR.success) issues.push(...zodIssues('assets.registry.json', visualsR.error));

  // Jobs: tier index within workplace by wage.
  const jobs: ResolvedJob[] = jobsRaw.map((j) => {
    const { automationRisk, ...rest } = j;
    const peers = jobsRaw
      .filter((o) => o.workplaceId === j.workplaceId && !o.isGig)
      .sort((a, b) => a.baseWage - b.baseWage);
    return {
      ...rest,
      automationRiskBp: Math.round(automationRisk * 10_000),
      tierIndex: peers.findIndex((o) => o.id === j.id),
    };
  });
  const items: ResolvedItem[] = itemsRaw.map((it) => {
    const { breakdownPerWeek, ...rest } = it;
    return {
      ...rest,
      price: scale(it.price, ps),
      repairCost: scale(it.repairCost, ps),
      breakdownBp: Math.round(breakdownPerWeek * 100),
    };
  });
  const transport: ResolvedTransportMode[] = transportRaw.map((m) => {
    const { hoursPerStep, fixedHours, noShowHours, delayHours, ...rest } = m;
    return {
      ...rest,
      stepHalfHoursMilli: Math.round(hoursPerStep * 2 * 1000),
      fixedHalfHours: toHalfHours(fixedHours, `transport.${m.id}.fixedHours`, issues),
      noShowHalfHours: toHalfHours(noShowHours, `transport.${m.id}.noShowHours`, issues),
      delayHalfHours: toHalfHours(delayHours, `transport.${m.id}.delayHours`, issues),
    };
  });

  const homeLocation = {
    low: rules.housing.tiers.low?.locationId ?? '',
    high: rules.housing.tiers.high?.locationId ?? '',
  } satisfies Record<HomeTier, string>;

  const pack: CityPack = {
    id: manifest.id,
    version: manifest.version,
    manifest,
    flags,
    wealthPointValue: manifest.wealthPointValue,
    rules,
    board,
    locations,
    locationById: byId(locations),
    jobs,
    jobById: byId(jobs),
    degrees,
    degreeById: byId(degrees),
    items,
    itemById: byId(items),
    meals,
    mealById: byId(meals),
    clothing,
    clothingById: byId(clothing),
    transport,
    transportById: byId(transport),
    subscriptions,
    subscriptionById: byId(subscriptions),
    assets,
    allAssets,
    assetById: byId(assets),
    loans,
    events,
    eventById: byId(events),
    personalities,
    personalityById: byId(personalities),
    i18n,
    visuals,
    homeLocation,
    uniformRank: { none: 0, casual: 1, dress: 2, business: 3 } satisfies Record<
      UniformTier,
      number
    >,
    chaosMultiplier: {
      off: rules.chaos.off ?? 0,
      classic: rules.chaos.classic ?? 1000,
      modern: rules.chaos.modern ?? 1300,
      chaotic: rules.chaos.chaotic ?? 2000,
    } satisfies Record<Chaos, number>,
    econPhases: ['boom', 'stable', 'recession'],
  };

  issues.push(...crossFileIssues(pack));
  issues.push(...collectI18nIssues(pack));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, pack };
}

/** Full pipeline for a pack id given a raw-file lookup. */
export function resolvePack(
  packId: string,
  lookup: (id: string) => RawPackFiles | undefined,
): ResolveResult {
  let chain: RawPackFiles[];
  try {
    chain = resolveChain(packId, lookup);
  } catch (e) {
    return { ok: false, issues: [{ path: 'pack.json.extends', message: (e as Error).message }] };
  }
  const issues: ValidationIssue[] = [];
  chain.forEach((files, i) => issues.push(...validateRawFiles(files, i > 0)));
  if (issues.length > 0) return { ok: false, issues };
  return buildPack(mergeChain(chain));
}
