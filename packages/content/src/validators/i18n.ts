/**
 * i18n validation (CONTENT_SCHEMAS 6.1, 6.3): every referenced key exists, no unused keys,
 * ≥ 3 greetings + 3 farewells per location, news headline variants per econ phase,
 * ≥ 2 text variants per event.
 */
import type { CityPack } from '../types.js';
import type { Issue } from './cross.js';

export const MIN_GREETINGS = 3;
export const MIN_FAREWELLS = 3;
export const NEWS_VARIANTS = 5;
export const EVENT_VARIANTS = 2;

/** Compute the set of keys a pack's content requires (exact) and key prefixes allowed for extras. */
export function requiredKeys(pack: CityPack): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>();
  // `asset.` is a prefix rather than an exact set: a pack carries both instrument sets and the
  // `modernAssets` flag decides which six are live, so the other six keep their names (12.4).
  const prefixes: string[] = ['tutorial.', 'quip.', 'name.', 'title.', 'asset.'];
  if (pack.manifest.titleKey) exact.add(pack.manifest.titleKey);
  for (const l of pack.locations) {
    exact.add(`location.${l.id}.name`);
    for (let i = 1; i <= MIN_GREETINGS; i++) exact.add(`location.${l.id}.greeting.${i}`);
    for (let i = 1; i <= MIN_FAREWELLS; i++) exact.add(`location.${l.id}.farewell.${i}`);
    prefixes.push(`location.${l.id}.greeting.`, `location.${l.id}.farewell.`);
  }
  for (const j of pack.jobs) exact.add(j.titleKey);
  for (const d of pack.degrees) exact.add(d.nameKey);
  for (const it of pack.items) {
    exact.add(it.nameKey);
    if (it.descKey) exact.add(it.descKey);
  }
  for (const m of pack.meals) exact.add(m.nameKey);
  for (const c of pack.clothing) exact.add(c.nameKey);
  for (const t of pack.transport) exact.add(t.nameKey);
  for (const s of pack.subscriptions) exact.add(s.nameKey);
  for (const a of pack.assets) exact.add(a.nameKey);
  for (const p of pack.personalities) {
    exact.add(p.nameKey);
    exact.add(p.taglineKey);
  }
  for (const e of pack.events) {
    exact.add(`${e.textKey}.title`);
    for (let i = 1; i <= EVENT_VARIANTS; i++) exact.add(`${e.textKey}.text.${i}`);
    prefixes.push(`${e.textKey}.text.`);
  }
  for (const phase of pack.econPhases) {
    for (let i = 1; i <= NEWS_VARIANTS; i++) exact.add(`news.${phase}.${i}`);
    prefixes.push(`news.${phase}.`);
  }
  return { exact, prefixes };
}

export function collectI18nIssues(pack: CityPack): Issue[] {
  const issues: Issue[] = [];
  const { exact, prefixes } = requiredKeys(pack);
  const present = new Set(Object.keys(pack.i18n));
  for (const k of exact)
    if (!present.has(k))
      issues.push({ path: `i18n/en.json.${k}`, message: 'missing key referenced by content' });
  for (const k of present) {
    if (exact.has(k)) continue;
    if (prefixes.some((p) => k.startsWith(p))) continue;
    issues.push({ path: `i18n/en.json.${k}`, message: 'unused key' });
  }
  for (const [k, v] of Object.entries(pack.i18n))
    if (v.trim() === '') issues.push({ path: `i18n/en.json.${k}`, message: 'empty string' });
  return issues;
}
