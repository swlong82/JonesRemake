import type { JsonValue } from '@hustle-ring/shared';
import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  buildPack,
  lookupRawPack,
  mergeChain,
  PACK_IDS,
  RAW_PACKS,
  resolveBundledPack,
  resolveChain,
  resolvePack,
  validateRawFiles,
  WORLD,
  type RawPackFiles,
} from './index.js';

const classicFiles = (): RawPackFiles => structuredClone(RAW_PACKS.classic!);
const withClassic = (files: RawPackFiles) => (id: string) =>
  id === 'x' ? files : lookupRawPack(id);

function mutate(path: string, value: JsonValue | undefined): RawPackFiles {
  const files = classicFiles();
  const [file, ...rest] = path.split('/');
  let cur = files[file!] as Record<string, JsonValue> | JsonValue[];
  for (let i = 0; i < rest.length - 1; i++) {
    const k = rest[i]!;
    cur = (Array.isArray(cur) ? cur[Number(k)] : cur[k]) as Record<string, JsonValue>;
  }
  const last = rest[rest.length - 1]!;
  if (value === undefined) {
    if (Array.isArray(cur)) cur.splice(Number(last), 1);
    else delete cur[last];
  } else if (Array.isArray(cur)) cur[Number(last)] = value;
  else cur[last] = value;
  return files;
}

function issuesOf(files: RawPackFiles): string[] {
  const r = resolvePack(
    'x',
    withClassic({
      ...files,
      'pack.json': { ...(files['pack.json'] as object), id: 'x' },
    }),
  );
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
}

describe('bundled packs', () => {
  it.each(PACK_IDS)('%s resolves without issues', (id) => {
    const r = resolveBundledPack(id);
    expect(r.ok, JSON.stringify(!r.ok && r.issues, null, 1)).toBe(true);
  });
  it('world lists only bundled packs', () => {
    for (const c of WORLD.cities) expect(PACK_IDS).toContain(c.packId);
  });
  it('extends chain resolves root first and merges', () => {
    const chain = resolveChain('modern-western', lookupRawPack);
    expect(chain).toHaveLength(2);
    const merged = mergeChain(chain);
    expect((merged['pack.json'] as { id: string }).id).toBe('modern-western');
    expect((merged['pack.json'] as { extends: string }).extends).toBe('classic');
    expect(Array.isArray(merged['jobs.json'])).toBe(true);
  });
  it('detects extends cycles and missing parents', () => {
    const a: RawPackFiles = {
      'pack.json': {
        id: 'a',
        version: '0.0.1',
        currency: { symbol: '$', code: 'USD' },
        featureFlags: {},
        wealthPointValue: 100,
        extends: 'b',
      },
    };
    const b: RawPackFiles = {
      'pack.json': {
        id: 'b',
        version: '0.0.1',
        currency: { symbol: '$', code: 'USD' },
        featureFlags: {},
        wealthPointValue: 100,
        extends: 'a',
      },
    };
    const lookup = (id: string) => (id === 'a' ? a : id === 'b' ? b : undefined);
    expect(() => resolveChain('a', lookup)).toThrow(/cycle/);
    const r = resolvePack('a', lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.path).toBe('pack.json.extends');
    const r2 = resolvePack('nope', lookup);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.issues[0]!.message).toMatch(/not found/);
  });
});

describe('unit conversion', () => {
  const pack = resolveBundledPack('classic');
  it('hours → half-hours, percents → bp, priceScale applied', () => {
    expect(pack.ok).toBe(true);
    if (!pack.ok) return;
    expect(pack.pack.rules.time.weekHours).toBe(120);
    expect(pack.pack.rules.time.enterHours).toBe(4);
    expect(pack.pack.rules.time.deliveryHours).toBe(1);
    expect(pack.pack.transportById.walk!.stepHalfHoursMilli).toBe(1250);
    expect(pack.pack.itemById.microwave!.breakdownBp).toBe(150);
    expect(pack.pack.jobById['burger-joint-cook']!.automationRiskBp).toBe(4500);
    expect(pack.pack.board.dist[0]![8]).toBe(8);
    expect(pack.pack.board.dist[0]![15]).toBe(1);
    expect(pack.pack.board.nodeOf.bank).toBe(10);
  });
  it('priceScale scales meals, clothing, items', () => {
    const files = classicFiles();
    (files['pack.json'] as Record<string, JsonValue>).priceScale = 1500;
    const r = buildPack(files);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pack.mealById.burger!.price).toBe(12);
      expect(r.pack.itemById.atlas!.price).toBe(90);
      expect(r.pack.clothingById.casual!.price).toBe(90);
    }
  });
  it('rejects non-half-hour values', () => {
    expect(issuesOf(mutate('rules.json/time/enterHours', 1.3))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^rules.time.enterHours: hours must be a multiple/),
      ]),
    );
  });
});

describe('invalid fixtures → path-specific messages (M2.1 AC)', () => {
  it('unknown feature flag', () => {
    const files = classicFiles();
    (
      (files['pack.json'] as Record<string, JsonValue>).featureFlags as Record<string, JsonValue>
    ).jetpacks = true;
    expect(issuesOf(files)[0]).toMatch(/^pack.json.featureFlags.jetpacks/);
  });
  it('unknown pack file', () => {
    const files = classicFiles();
    files['bogus.json'] = {};
    expect(issuesOf(files)).toContain('bogus.json: unknown pack file');
  });
  it('board must have 16 squares and unique locations', () => {
    expect(issuesOf(mutate('board.json/squares/15', undefined))[0]).toMatch(/^board.json.squares/);
    const dup = mutate('board.json/squares/15', { locationId: 'bank' });
    expect(issuesOf(dup)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^board.squares.15: location "bank" appears twice/),
        expect.stringMatching(/^locations.park: location not placed/),
      ]),
    );
  });
  it('job with unknown workplace / degree / non-monotonic requirements', () => {
    expect(issuesOf(mutate('jobs.json/0/workplaceId', 'moon'))).toContain(
      'jobs.burger-joint-cook.workplaceId: unknown location "moon"',
    );
    expect(issuesOf(mutate('jobs.json/0/reqDegrees', ['alchemy']))).toContain(
      'jobs.burger-joint-cook.reqDegrees: unknown degree "alchemy"',
    );
    expect(issuesOf(mutate('jobs.json/2/reqExperience', 5))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^jobs.burger-joint-shift-lead: requirements not monotonic/),
      ]),
    );
    expect(issuesOf(mutate('jobs.json/0/workplaceId', 'park'))).toContain(
      'jobs.burger-joint-cook.workplaceId: "park" has no work service',
    );
  });
  it('degree DAG: cycle, count, roots, unknown prereq', () => {
    expect(issuesOf(mutate('degrees.json/0/prereqs', ['electronics']))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/cycle/),
        expect.stringMatching(/expected 2 root/),
      ]),
    );
    expect(issuesOf(mutate('degrees.json/10', undefined))).toContain(
      'degrees: expected 11 degrees, got 10',
    );
    expect(issuesOf(mutate('degrees.json/2/prereqs', ['nope']))).toContain(
      'degrees.electronics.prereqs: unknown degree "nope"',
    );
  });
  it('items: unknown store, missing visual; i18n: missing and unused keys', () => {
    expect(issuesOf(mutate('items.json/0/storeIds', ['mars']))).toContain(
      'items.refrigerator.storeIds: unknown location "mars"',
    );
    const files = classicFiles();
    delete (files['assets.registry.json'] as Record<string, JsonValue>)['item:atlas'];
    expect(issuesOf(files)).toContain('assets.registry.item:atlas: missing visual');
    const f2 = classicFiles();
    delete (f2['i18n/en.json'] as Record<string, JsonValue>)['item.atlas.name'];
    (f2['i18n/en.json'] as Record<string, JsonValue>)['item.zzz.name'] = 'x';
    (f2['i18n/en.json'] as Record<string, JsonValue>)['location.park.greeting.4'] = '  ';
    const issues = issuesOf(f2);
    expect(issues).toContain('i18n/en.json.item.atlas.name: missing key referenced by content');
    expect(issues).toContain('i18n/en.json.item.zzz.name: unused key');
    expect(issues).toContain('i18n/en.json.location.park.greeting.4: empty string');
  });
  it('events: bad trigger, unknown effect targets, missing weekend', () => {
    expect(issuesOf(mutate('events.json/0/trigger', 'onSneeze'))[0]).toMatch(
      /^events.json.0.trigger/,
    );
    expect(issuesOf(mutate('events.json/0/trigger', 'onEnter:nowhere'))).toContain(
      'events.quiet-weekend.trigger: unknown location "nowhere"',
    );
    expect(
      issuesOf(
        mutate('events.json/0/effects/0', {
          op: 'disableItem',
          itemId: 'ghost',
          untilRepaired: true,
        }),
      ),
    ).toContain('events.quiet-weekend.effects.0: unknown item "ghost"');
    expect(
      issuesOf(
        mutate('events.json/0/effects/0', {
          op: 'asset',
          assetId: 'tulips',
          multiply: { min: 1, max: 2 },
        }),
      ),
    ).toContain('events.quiet-weekend.effects.0: unknown asset "tulips"');
    expect(
      issuesOf(
        mutate('events.json/0/effects/0', {
          op: 'schedule',
          eventId: 'never',
          inWeeks: 1,
          chance: 100,
        }),
      ),
    ).toContain('events.quiet-weekend.effects.0: unknown event "never"');
    expect(
      issuesOf(
        mutate('events.json/0/effects/0', {
          op: 'loseItems',
          filter: { itemId: 'ghost' },
          count: 'all',
        }),
      ),
    ).toContain('events.quiet-weekend.effects.0: unknown item "ghost"');
    expect(issuesOf(mutate('events.json/0/flag', 'warp'))).toContain(
      'events.quiet-weekend.flag: unknown flag "warp"',
    );
    const files = classicFiles();
    files['events.json'] = (files['events.json'] as JsonValue[]).filter(
      (e) => (e as { trigger: string }).trigger !== 'weekend',
    );
    expect(issuesOf(files)).toContain('events: at least one weekend event required');
  });
  it('assets: bounds, classic count; transport: walk required, classic walk-only', () => {
    expect(issuesOf(mutate('assets.json/0/startCents', 1))).toContain(
      'assets.t-bills.startCents: start outside bounds',
    );
    expect(issuesOf(mutate('assets.json/0/minCents', undefined))).toContain(
      'assets.t-bills: bounded asset needs minCents/maxCents',
    );
    expect(issuesOf(mutate('assets.json/5', undefined))).toContain(
      'assets: expected 6 classic instruments',
    );
    expect(issuesOf(mutate('assets.json/0/specialEvents', ['nope']))).toContain(
      'assets.t-bills.specialEvents: unknown event "nope"',
    );
    expect(issuesOf(mutate('transport.json/0/id', 'hover'))).toContain(
      'transport: a "walk" mode is required',
    );
    const files = classicFiles();
    (files['transport.json'] as JsonValue[]).push({
      id: 'bus',
      nameKey: 'transport.walk.name',
      hoursPerStep: 0.5,
      fixedHours: 0,
      cost: { type: 'free' },
      unlock: 'always',
    });
    expect(issuesOf(files)).toContain('transport: transport flag off → walk only');
  });
  it('rules location refs, home tiers, clothing tiers, meals, personalities', () => {
    expect(issuesOf(mutate('rules.json/pawn/locationId', 'void'))).toContain(
      'rules.pawn.locationId: unknown location "void"',
    );
    expect(issuesOf(mutate('rules.json/theft/locationIds', ['void']))).toContain(
      'rules.theft.locationIds.0: unknown location "void"',
    );
    expect(issuesOf(mutate('rules.json/housing/tiers/low/locationId', 'bank'))).toContain(
      'rules.housing.tiers.low.locationId: "bank" is not a low-tier home',
    );
    expect(issuesOf(mutate('rules.json/housing/tiers/low/locationId', 'void'))).toContain(
      'rules.housing.tiers.low.locationId: unknown location "void"',
    );
    expect(issuesOf(mutate('locations.json/0/kind', 'filler'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/expected exactly 2 home locations/)]),
    );
    expect(issuesOf(mutate('locations.json/0/homeTier', undefined))).toContain(
      'locations.low-housing: home location needs homeTier',
    );
    expect(issuesOf(mutate('meals.json/0/locationId', 'void'))).toContain(
      'meals.burger.locationId: unknown location "void"',
    );
    expect(issuesOf(mutate('clothing.json/0/storeId', 'void'))).toContain(
      'clothing.casual.storeId: unknown location "void"',
    );
    const files = classicFiles();
    files['clothing.json'] = (files['clothing.json'] as JsonValue[]).filter(
      (c) => (c as { tier: string }).tier !== 'business',
    );
    expect(issuesOf(files)).toContain('clothing: no clothing entry for tier "business"');
    const f2 = classicFiles();
    f2['personalities.json'] = [];
    expect(issuesOf(f2)).toContain('personalities: at least one personality required');
  });
  it('schema failures in rules/board short-circuit with file-prefixed paths', () => {
    expect(issuesOf(mutate('rules.json/time', undefined))[0]).toMatch(/^rules.json.time/);
    const files = classicFiles();
    files['board.json'] = { topology: 'ring', squares: [] };
    const r = buildPack(files);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.path).toMatch(/^board.json.squares/);
    const f3 = classicFiles();
    delete f3['pack.json'];
    const r3 = buildPack(f3);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.issues[0]!.path).toBe('pack.json');
    const f4 = classicFiles();
    f4['loans.json'] = { min: -1 };
    expect(issuesOf(f4)[0]).toMatch(/^loans.json/);
    const f5 = classicFiles();
    f5['i18n/en.json'] = { a: 1 };
    expect(issuesOf(f5)[0]).toMatch(/^i18n\/en.json/);
  });
  it('overlay validation is partial for rules.json', () => {
    expect(
      validateRawFiles(
        {
          'pack.json': RAW_PACKS['modern-western']!['pack.json']!,
          'rules.json': { time: { enterHours: 3 } },
        },
        true,
      ),
    ).toEqual([]);
    expect(
      validateRawFiles(
        {
          'pack.json': RAW_PACKS['modern-western']!['pack.json']!,
          'rules.json': { time: { enterHours: 3 } },
        },
        false,
      ).length,
    ).toBeGreaterThan(0);
  });
  it('modern flags require modern content', () => {
    const files = classicFiles();
    (
      (files['pack.json'] as Record<string, JsonValue>).featureFlags as Record<string, JsonValue>
    ).modernAssets = true;
    (
      (files['pack.json'] as Record<string, JsonValue>).featureFlags as Record<string, JsonValue>
    ).loans = true;
    const issues = issuesOf(files);
    expect(issues).toContain('assets: modernAssets on → expected 6 modern assets');
    expect(issues).toContain('loans.json: loans flag on but loans.json missing');
  });
  it('gig jobs need gigPay; duplicate job ids flagged; replaces must exist', () => {
    const files = classicFiles();
    (files['jobs.json'] as JsonValue[]).push({
      id: 'rider',
      workplaceId: 'park',
      titleKey: 'job.burger-joint-cook.title',
      baseWage: 5,
      reqExperience: 0,
      reqDependability: 0,
      reqDegrees: [],
      uniformTier: 'none',
      automationRisk: 0.1,
      isGig: true,
    });
    expect(issuesOf(files)).toContain('jobs.rider.gigPay: gig job needs gigPay');
    const f2 = classicFiles();
    (f2['jobs.json'] as JsonValue[]).push(structuredClone((f2['jobs.json'] as JsonValue[])[0]!));
    expect(issuesOf(f2)).toContain('jobs.burger-joint-cook: duplicate job id');
    expect(issuesOf(mutate('items.json/0/replaces', 'ghost'))).toContain(
      'items.refrigerator.replaces: unknown item "ghost"',
    );
  });
});

describe('graph topology', () => {
  it('Floyd–Warshall distances and connectivity check', () => {
    const issues: { path: string; message: string }[] = [];
    const b = buildBoard(
      {
        topology: 'graph',
        nodes: [
          { id: 'a', locationId: 'la' },
          { id: 'b', locationId: 'lb' },
          { id: 'c', locationId: null },
        ],
        edges: [
          { from: 'a', to: 'b', steps: 5 },
          { from: 'b', to: 'c', steps: 1 },
          { from: 'a', to: 'c', steps: 2 },
        ],
      },
      issues,
    );
    expect(issues).toEqual([]);
    expect(b.dist[0]![1]).toBe(3);
    expect(b.nodeOf.lb).toBe(1);
    const bad: { path: string; message: string }[] = [];
    buildBoard(
      {
        topology: 'graph',
        nodes: [
          { id: 'a', locationId: null },
          { id: 'b', locationId: null },
        ],
        edges: [{ from: 'a', to: 'zz', steps: 1 }],
      },
      bad,
    );
    expect(bad.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unknown node/),
        expect.stringMatching(/not connected/),
      ]),
    );
  });
});
