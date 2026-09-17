/** Classic pack anchor tests (M2.2 AC; ORIGINAL_REFERENCE 3.x, SEED_DATA 14.x). */
import { describe, expect, it } from 'vitest';
import { loadPack } from './index.js';

const pack = loadPack('classic');

describe('classic pack anchors', () => {
  it('Professor: $20/hr, exp 50, dep 60, Research degree, dress uniform', () => {
    const p = pack.jobById['university-professor']!;
    expect(p.baseWage).toBe(20);
    expect(p.reqExperience).toBe(50);
    expect(p.reqDependability).toBe(60);
    expect(p.reqDegrees).toEqual(['research']);
    expect(p.uniformTier).toBe('dress');
  });
  it('General Manager (factory) has the highest wage and needs two degrees', () => {
    const gm = pack.jobById['factory-general-manager']!;
    expect(gm.baseWage).toBe(25);
    expect(gm.reqDegrees).toHaveLength(2);
    for (const j of pack.jobs) expect(j.baseWage).toBeLessThanOrEqual(gm.baseWage);
  });
  it('Cook always hires, no requirements; Broker needs BA + Academic; Engineer needs two degrees', () => {
    const cook = pack.jobById['burger-joint-cook']!;
    expect(cook.alwaysHire).toBe(true);
    expect(cook.reqExperience).toBe(0);
    expect(cook.reqDependability).toBe(0);
    expect(pack.jobById['bank-broker']!.reqDegrees.sort()).toEqual(['academic', 'business-admin']);
    expect(pack.jobById['factory-engineer']!.reqDegrees).toHaveLength(2);
  });
  it('10 workplaces with 2–9 jobs each, 46 jobs, wages $4–$25', () => {
    const byWp = new Map<string, number>();
    for (const j of pack.jobs) byWp.set(j.workplaceId, (byWp.get(j.workplaceId) ?? 0) + 1);
    expect(byWp.size).toBe(10);
    for (const n of byWp.values()) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(9);
    }
    expect(pack.jobs).toHaveLength(46);
    expect(Math.min(...pack.jobs.map((j) => j.baseWage))).toBe(4);
  });
  it('degree DAG shape: 11 degrees, roots TS + JC, chain AC→GS→PD→RE→PU, EN needs PE', () => {
    expect(pack.degrees).toHaveLength(11);
    const roots = pack.degrees
      .filter((d) => d.prereqs.length === 0)
      .map((d) => d.id)
      .sort();
    expect(roots).toEqual(['junior-college', 'trade-school']);
    expect(pack.degreeById.engineering!.prereqs).toEqual(['pre-engineering']);
    expect(pack.degreeById.publishing!.prereqs).toEqual(['research']);
    expect(pack.degreeById.research!.prereqs).toEqual(['post-doctoral']);
    expect(pack.degreeById['business-admin']!.prereqs).toEqual(['junior-college']);
    for (const d of pack.degrees) expect(d.lessons).toBe(10);
  });
  it('board: 16 squares, homes at 1 and 13, one lap = 10h (16 × 0.625)', () => {
    expect(pack.board.ringSize).toBe(16);
    expect(pack.board.locationAt[0]).toBe('low-housing');
    expect(pack.board.locationAt[12]).toBe('secure-apartments');
    expect(pack.transportById.walk!.stepHalfHoursMilli * 16).toBe(20_000);
  });
  it('items: 17 entries, fridge unlocks freshFood, computer unlocks weekendIncome, hot tub stops relax decay', () => {
    expect(pack.items).toHaveLength(17);
    expect(pack.itemById.refrigerator!.unlocks).toContain('freshFood');
    expect(pack.itemById.computer!.unlocks).toContain('weekendIncome');
    expect(pack.itemById['hot-tub']!.unlocks).toContain('noRelaxDecay');
    expect(pack.items.filter((i) => i.extraCredit)).toHaveLength(4);
  });
  it('market: 6 bounded instruments, T-Bills and Gold crash-immune', () => {
    expect(pack.assets).toHaveLength(6);
    expect(pack.assetById['t-bills']!.crashImmune).toBe(true);
    expect(pack.assetById.gold!.crashImmune).toBe(true);
    expect(pack.assetById['penny-stocks']!.maxMoveBp).toBe(1500);
  });
  it('weekend event weights sum to 100; econ events present', () => {
    const weekend = pack.events.filter((e) => e.trigger === 'weekend');
    expect(weekend.reduce((s, e) => s + (e.weight as number), 0)).toBe(100);
    expect(pack.eventById['market-crash-3']!.effects.some((e) => e.op === 'loseJob')).toBe(true);
  });
  it('rules: 60h week, rent $325/$475, start cash $200, flags all off', () => {
    expect(pack.rules.time.weekHours).toBe(120);
    expect(pack.rules.housing.tiers.low!.rent).toBe(325);
    expect(pack.rules.housing.tiers.high!.rent).toBe(475);
    expect(pack.rules.start.cash).toBe(200);
    expect(Object.values(pack.flags).every((f) => !f)).toBe(true);
  });
  it('i18n: 3 greetings + 3 farewells per location, 5 headlines per phase', () => {
    for (const l of pack.locations) {
      for (let i = 1; i <= 3; i++) {
        expect(pack.i18n[`location.${l.id}.greeting.${i}`]).toBeTruthy();
        expect(pack.i18n[`location.${l.id}.farewell.${i}`]).toBeTruthy();
      }
    }
    for (const ph of ['boom', 'stable', 'recession'])
      for (let i = 1; i <= 5; i++) expect(pack.i18n[`news.${ph}.${i}`]).toBeTruthy();
  });
  it('loadPack caches and throws on invalid id', () => {
    expect(loadPack('classic')).toBe(pack);
    expect(() => loadPack('atlantis')).toThrow(/invalid/);
  });
});
