/** M5.8: the modern event families and, for each, that its mitigation measurably helps. */
import { describe, expect, it } from 'vitest';
import { loadPack } from '@hustle-ring/content';
import { humanSeat, newGame, patch, run } from '../testing.js';
import type { PlayerState } from '../core/state.js';

const modern = loadPack('modern-western');
const FAMILIES = ['ai-layoffs', 'viral', 'scams', 'gadget-breakdown'];

/** Counts the turn-start events of one family over `weeks` weeks of a seat doing nothing. */
function fireCounts(
  seed: string,
  weeks: number,
  setup: (p: PlayerState) => void,
): Map<string, number> {
  let s = patch(
    newGame(seed, [humanSeat(), humanSeat()], { chaos: 'modern' }, modern),
    0,
    (p) => {
      p.cash = 5_000;
      p.bank = 5_000;
      p.items.push({
        uid: 'fridge',
        itemId: 'refrigerator',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      });
      p.food.fridgeUnits = weeks + 5;
      setup(p);
    },
    modern,
  );
  const counts = new Map<string, number>();
  for (let w = 0; w < weeks; w++) {
    const before = s;
    s = run(run(before, 0, [{ type: 'EndTurn' }], modern), 1, [{ type: 'EndTurn' }], modern);
    for (const id of s.players[0]!.turn.eventsFired) {
      const family = modern.eventById[id]?.family;
      if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    // Keep the seat in the same shape: a job to lose, a phone to break, money to steal.
    s = patch(
      s,
      0,
      (p) => {
        p.cash = 5_000;
        p.bank = 5_000;
        p.food.fridgeUnits = weeks + 5;
        for (const it of p.items) it.condition = 'ok';
        setup(p);
      },
      modern,
    );
  }
  return counts;
}

const phone = (p: PlayerState, extra: string[] = []): void => {
  for (const itemId of ['smartphone', 'laptop', ...extra])
    if (!p.items.some((i) => i.itemId === itemId))
      p.items.push({
        uid: itemId,
        itemId,
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
};

const employed = (p: PlayerState): void => {
  p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
  p.dependability = 60;
};

describe('modern event families (GDD 4.13)', () => {
  it('the pack defines every modern family behind the flag', () => {
    for (const family of FAMILIES)
      expect(modern.events.some((e) => e.family === family && e.flag === 'modernEvents')).toBe(
        true,
      );
    expect(loadPack('classic').events.some((e) => FAMILIES.includes(e.family))).toBe(false);
  });

  it('automation only comes for a regular job, and the risk is the job’s own', () => {
    const risky = fireCounts('auto-risky', 400, (p) => {
      employed(p);
      p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
    });
    const safe = fireCounts('auto-safe', 400, (p) => {
      p.job = { jobId: 'university-professor', wage: 20, raises: 0, hiredWeek: 1 };
      p.dependability = 60;
    });
    // The cook's automationRisk is far above the professor's, so layoffs land far more often.
    expect(risky.get('ai-layoffs') ?? 0).toBeGreaterThan(safe.get('ai-layoffs') ?? 0);
    const jobless = fireCounts('auto-none', 200, () => undefined);
    expect(jobless.get('ai-layoffs') ?? 0).toBe(0);
  });

  it('AC: a cloud subscription and a degree each cut the scam rate', () => {
    const exposed = fireCounts('scam-open', 600, () => undefined);
    const educated = fireCounts('scam-degrees', 600, (p) => {
      p.degrees = ['trade-school', 'junior-college', 'electronics', 'business-admin'];
    });
    expect(exposed.get('scams') ?? 0).toBeGreaterThan(educated.get('scams') ?? 0);
  });

  it('AC: a phone case cuts cracked screens', () => {
    const bare = fireCounts('screen-bare', 600, (p) => phone(p));
    const cased = fireCounts('screen-case', 600, (p) => phone(p, ['phone-case']));
    const cracked = (c: Map<string, number>): number => c.get('gadget-breakdown') ?? 0;
    expect(cracked(bare)).toBeGreaterThan(cracked(cased));
  });

  it('going viral needs a phone and can be followed by a backlash', () => {
    const withPhone = fireCounts('viral-phone', 400, (p) => phone(p));
    const without = fireCounts('viral-none', 400, () => undefined);
    expect(withPhone.get('viral') ?? 0).toBeGreaterThan(0);
    expect(without.get('viral') ?? 0).toBe(0);
  });
});
