/** Cross-file validators (CONTENT_SCHEMAS 6.1 "Validation beyond schema"). */
import type { CityPack } from '../types.js';

export interface Issue {
  readonly path: string;
  readonly message: string;
}

export function crossFileIssues(pack: CityPack): Issue[] {
  const issues: Issue[] = [];
  const loc = (id: string): boolean => id in pack.locationById;

  // Board: every location placed exactly once; exactly 2 home squares (ring).
  const placed = new Set<string>();
  pack.board.locationAt.forEach((l, i) => {
    if (l === null) return;
    if (!loc(l)) issues.push({ path: `board.squares.${i}`, message: `unknown location "${l}"` });
    placed.add(l);
  });
  for (const l of pack.locations) {
    if (!placed.has(l.id))
      issues.push({ path: `locations.${l.id}`, message: 'location not placed on board' });
  }
  const homes = pack.locations.filter((l) => l.kind === 'home');
  if (homes.length !== 2)
    issues.push({
      path: 'locations',
      message: `expected exactly 2 home locations, got ${homes.length}`,
    });
  for (const h of homes) {
    if (!h.homeTier)
      issues.push({ path: `locations.${h.id}`, message: 'home location needs homeTier' });
  }
  for (const tier of ['low', 'high'] as const) {
    const id = pack.homeLocation[tier];
    const l = pack.locationById[id];
    if (!l)
      issues.push({
        path: `rules.housing.tiers.${tier}.locationId`,
        message: `unknown location "${id}"`,
      });
    else if (l.kind !== 'home' || l.homeTier !== tier)
      issues.push({
        path: `rules.housing.tiers.${tier}.locationId`,
        message: `"${id}" is not a ${tier}-tier home`,
      });
  }
  for (const [path, id] of [
    ['rules.items.discountStoreId', pack.rules.items.discountStoreId],
    ['rules.pawn.locationId', pack.rules.pawn.locationId],
    ['rules.lottery.locationId', pack.rules.lottery.locationId],
    ['rules.econ.newsLocationId', pack.rules.econ.newsLocationId],
    ['rules.market.locationId', pack.rules.market.locationId],
    ['rules.cars.usedLocationId', pack.rules.cars.usedLocationId],
    ['rules.cars.newLocationId', pack.rules.cars.newLocationId],
  ] as const) {
    if (!loc(id)) issues.push({ path, message: `unknown location "${id}"` });
  }
  pack.rules.theft.locationIds.forEach((id, i) => {
    if (!loc(id))
      issues.push({ path: `rules.theft.locationIds.${i}`, message: `unknown location "${id}"` });
  });

  // Jobs: workplace exists and is a workplace; degrees exist; wages monotonic with reqs; ids unique.
  const seenJobs = new Set<string>();
  for (const j of pack.jobs) {
    if (seenJobs.has(j.id)) issues.push({ path: `jobs.${j.id}`, message: 'duplicate job id' });
    seenJobs.add(j.id);
    if (!j.isGig) {
      const wp = pack.locationById[j.workplaceId];
      if (!wp)
        issues.push({
          path: `jobs.${j.id}.workplaceId`,
          message: `unknown location "${j.workplaceId}"`,
        });
      else if (!wp.services.includes('work'))
        issues.push({
          path: `jobs.${j.id}.workplaceId`,
          message: `"${j.workplaceId}" has no work service`,
        });
    }
    for (const d of j.reqDegrees) {
      if (!(d in pack.degreeById))
        issues.push({ path: `jobs.${j.id}.reqDegrees`, message: `unknown degree "${d}"` });
    }
    if (j.isGig && j.gigPay === undefined)
      issues.push({ path: `jobs.${j.id}.gigPay`, message: 'gig job needs gigPay' });
  }
  const byWorkplace = new Map<string, typeof pack.jobs>();
  for (const j of pack.jobs) {
    if (j.isGig) continue;
    const arr = byWorkplace.get(j.workplaceId) ?? [];
    arr.push(j);
    byWorkplace.set(j.workplaceId, arr);
  }
  for (const [wp, arr] of byWorkplace) {
    const sorted = [...arr].sort((a, b) => a.baseWage - b.baseWage);
    for (let i = 1; i < sorted.length; i++) {
      const lo = sorted[i - 1]!;
      const hi = sorted[i]!;
      if (hi.reqExperience < lo.reqExperience || hi.reqDependability < lo.reqDependability) {
        issues.push({
          path: `jobs.${hi.id}`,
          message: `requirements not monotonic with wage within "${wp}" (vs ${lo.id})`,
        });
      }
    }
  }

  // Degrees: exactly 11, DAG acyclic, 2 roots, prereqs exist.
  if (pack.degrees.length !== 11)
    issues.push({ path: 'degrees', message: `expected 11 degrees, got ${pack.degrees.length}` });
  const roots = pack.degrees.filter((d) => d.prereqs.length === 0);
  if (pack.degrees.length > 0 && roots.length !== 2)
    issues.push({ path: 'degrees', message: `expected 2 root degrees, got ${roots.length}` });
  const color = new Map<string, number>();
  const visit = (id: string, trail: string[]): void => {
    const c = color.get(id) ?? 0;
    if (c === 1) {
      issues.push({
        path: `degrees.${id}.prereqs`,
        message: `cycle: ${[...trail, id].join(' → ')}`,
      });
      return;
    }
    if (c === 2) return;
    color.set(id, 1);
    const d = pack.degreeById[id];
    for (const p of d?.prereqs ?? []) {
      if (!(p in pack.degreeById))
        issues.push({ path: `degrees.${id}.prereqs`, message: `unknown degree "${p}"` });
      else visit(p, [...trail, id]);
    }
    color.set(id, 2);
  };
  for (const d of pack.degrees) visit(d.id, []);

  // Items: storeIds valid.
  for (const it of pack.items) {
    for (const s of it.storeIds) {
      if (!loc(s))
        issues.push({ path: `items.${it.id}.storeIds`, message: `unknown location "${s}"` });
    }
    if (it.replaces && !(it.replaces in pack.itemById))
      issues.push({ path: `items.${it.id}.replaces`, message: `unknown item "${it.replaces}"` });
  }
  for (const m of pack.meals)
    if (!loc(m.locationId))
      issues.push({
        path: `meals.${m.id}.locationId`,
        message: `unknown location "${m.locationId}"`,
      });
  for (const c of pack.clothing)
    if (!loc(c.storeId))
      issues.push({ path: `clothing.${c.id}.storeId`, message: `unknown location "${c.storeId}"` });
  const tiers = new Set(pack.clothing.map((c) => c.tier));
  for (const t of ['casual', 'dress', 'business'] as const) {
    if (!tiers.has(t))
      issues.push({ path: 'clothing', message: `no clothing entry for tier "${t}"` });
  }
  for (const s of pack.subscriptions)
    if (!loc(s.locationId))
      issues.push({
        path: `subscriptions.${s.id}.locationId`,
        message: `unknown location "${s.locationId}"`,
      });

  // Transport: walk exists; classic pack = walk only.
  if (!pack.transportById.walk)
    issues.push({ path: 'transport', message: 'a "walk" mode is required' });
  if (!pack.flags.transport && pack.transport.length !== 1)
    issues.push({ path: 'transport', message: 'transport flag off → walk only' });

  // Assets: bounded model needs bounds and start inside them.
  for (const a of pack.assets) {
    if (a.model === 'bounded') {
      if (a.minCents === undefined || a.maxCents === undefined)
        issues.push({ path: `assets.${a.id}`, message: 'bounded asset needs minCents/maxCents' });
      else if (a.startCents < a.minCents || a.startCents > a.maxCents)
        issues.push({ path: `assets.${a.id}.startCents`, message: 'start outside bounds' });
    }
    for (const e of a.specialEvents)
      if (!(e in pack.eventById))
        issues.push({ path: `assets.${a.id}.specialEvents`, message: `unknown event "${e}"` });
  }
  if (pack.allAssets.filter((a) => a.set === 'classic').length !== 6)
    issues.push({ path: 'assets', message: 'expected 6 classic instruments' });
  if (pack.flags.modernAssets && pack.allAssets.filter((a) => a.set === 'modern').length !== 6)
    issues.push({ path: 'assets', message: 'modernAssets on → expected 6 modern assets' });
  if (pack.flags.loans && !pack.loans)
    issues.push({ path: 'loans.json', message: 'loans flag on but loans.json missing' });

  // Events: triggers reference locations; effects reference ids; schedule targets exist.
  for (const e of pack.events) {
    const m = /^on(Enter|Exit):(.+)$/.exec(e.trigger);
    if (m && !loc(m[2]!))
      issues.push({ path: `events.${e.id}.trigger`, message: `unknown location "${m[2]}"` });
    for (const [i, ef] of e.effects.entries()) {
      if (ef.op === 'disableItem' && !(ef.itemId in pack.itemById))
        issues.push({
          path: `events.${e.id}.effects.${i}`,
          message: `unknown item "${ef.itemId}"`,
        });
      if (ef.op === 'asset' && ef.assetId !== '*' && !(ef.assetId in pack.assetById))
        issues.push({
          path: `events.${e.id}.effects.${i}`,
          message: `unknown asset "${ef.assetId}"`,
        });
      if (ef.op === 'schedule' && !(ef.eventId in pack.eventById))
        issues.push({
          path: `events.${e.id}.effects.${i}`,
          message: `unknown event "${ef.eventId}"`,
        });
      if (ef.op === 'loseItems' && ef.filter.itemId && !(ef.filter.itemId in pack.itemById))
        issues.push({
          path: `events.${e.id}.effects.${i}`,
          message: `unknown item "${ef.filter.itemId}"`,
        });
    }
    if (e.flag !== undefined && !(e.flag in pack.flags))
      issues.push({ path: `events.${e.id}.flag`, message: `unknown flag "${e.flag}"` });
  }
  if (pack.events.filter((e) => e.trigger === 'weekend').length === 0)
    issues.push({ path: 'events', message: 'at least one weekend event required' });

  if (pack.personalities.length < 1)
    issues.push({ path: 'personalities', message: 'at least one personality required' });

  // Visuals: every location and item key mapped.
  for (const l of pack.locations)
    if (!(`location:${l.id}` in pack.visuals))
      issues.push({ path: `assets.registry.location:${l.id}`, message: 'missing visual' });
  for (const it of pack.items)
    if (!(`item:${it.id}` in pack.visuals))
      issues.push({ path: `assets.registry.item:${it.id}`, message: 'missing visual' });

  return issues;
}
