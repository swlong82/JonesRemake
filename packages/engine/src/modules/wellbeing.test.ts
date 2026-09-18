/** M5.2: the wellbeing module (GDD 4.5) — deltas, weekly drift, the four bands and burnout. */
import { describe, expect, it } from 'vitest';
import type { CityPack } from '@hustle-ring/content';
import { applyCommand, engineFor, previewCommand } from '../index.js';
import { classic, goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import { wellbeingOf, wellbeingBand } from './wellbeing.js';

const off = classic();
/** Classic rules with the modern wellbeing flag on: the module is content-gated, not code-gated. */
const on: CityPack = { ...off, flags: { ...off.flags, wellbeing: true } };
const W = on.rules.wellbeing;

const game = (seed: string, pack: CityPack = on): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, pack);

/** Both seats end their turn, so the week advances and seat 0 sees one start-of-turn pipeline. */
const endWeek = (s: GameState, pack: CityPack = on): GameState =>
  run(run(s, 0, [{ type: 'EndTurn' }], pack), 1, [{ type: 'EndTurn' }], pack);

const value = (s: GameState, seat = 0): number | undefined => wellbeingOf(s.players[seat]!);

/** mulDiv, the engine's rounding: a half session costs half the delta, rounded half away from zero. */
const prorated = (delta: number, half: number, session: number): number =>
  -Math.floor((Math.abs(delta) * half + session / 2) / session);

/** A fridge and food in it, so starvation and spoilage do not drown out what a test measures. */
const fed = (s: GameState, seat = 0): GameState =>
  patch(
    s,
    seat,
    (p) => {
      p.items.push({
        uid: 'fridge',
        itemId: 'refrigerator',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      });
      p.food.fridgeUnits = 30;
    },
    on,
  );

const setWellbeing = (s: GameState, v: number, seat = 0): GameState =>
  patch(
    s,
    seat,
    (p) => {
      (p.modules.wellbeing as { value: number }).value = v;
    },
    on,
  );

/** Hired into the burger-joint cook job, standing in the workplace with a uniform that fits. */
function employed(seed: string, pack: CityPack = on): GameState {
  const s = patch(
    game(seed, pack),
    0,
    (p) => {
      p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
      p.dependability = 50;
    },
    pack,
  );
  return goInside(s, 0, 'burger-joint', pack);
}

describe('wellbeing module (GDD 4.5)', () => {
  it('is absent with the flag off and present with it on, starting at the pack value', () => {
    expect(engineFor(off).moduleIds).not.toContain('wellbeing');
    expect(value(game('off', off))).toBeUndefined();
    expect(engineFor(on).moduleIds).toContain('wellbeing');
    // Modern modules run after every core module (order 100 against core 0–99).
    const ids = engineFor(on).moduleIds;
    expect(ids.indexOf('wellbeing')).toBeGreaterThan(ids.indexOf('core-decay'));
    expect(value(game('on'))).toBe(on.rules.start.wellbeing);
  });

  it('a work session costs the pack delta, pro-rated by the hours actually worked', () => {
    const s = employed('work');
    const before = value(s)!;
    const full = run(s, 0, [{ type: 'Work', hours: on.rules.time.workSessionHours }], on);
    expect(value(full)! - before).toBe(W.workDelta);
    const half = run(s, 0, [{ type: 'Work', hours: on.rules.time.workSessionHours / 2 }], on);
    expect(value(half)! - before).toBe(
      prorated(W.workDelta, on.rules.time.workSessionHours / 2, on.rules.time.workSessionHours),
    );
  });

  it('relaxing at home pays the base plus every comfort durable, capped', () => {
    const bare = run(game('relax'), 0, [{ type: 'Relax' }], on);
    expect(value(bare)! - on.rules.start.wellbeing).toBe(W.relaxBase);
    const comfy = patch(
      game('relax2'),
      0,
      (p) => {
        for (const itemId of ['television', 'stereo', 'media-player', 'computer', 'hot-tub'])
          p.items.push({
            uid: itemId,
            itemId,
            condition: 'ok',
            boughtWeek: 1,
            boughtAt: 'low-housing',
          });
      },
      on,
    );
    const relaxed = run(comfy, 0, [{ type: 'Relax' }], on);
    expect(relaxed.players[0]!.modules.wellbeing).toEqual({
      value: Math.min(100, on.rules.start.wellbeing + W.relaxMax),
    });
  });

  it('a long enough walk is worth a point, a short hop is not', () => {
    const long = run(game('walk'), 0, [{ type: 'Move', to: 'university', mode: 'walk' }], on);
    expect(value(long)!).toBe(on.rules.start.wellbeing + W.walkTripBonus);
    const short = run(game('walk2'), 0, [{ type: 'Move', to: 'rent-office', mode: 'walk' }], on);
    expect(value(short)!).toBe(on.rules.start.wellbeing);
  });

  it('drifts toward the pack target by one step a week and banks unspent hours', () => {
    // Ending the week untouched also pays the unspent-hours bonus, so both land in one step.
    const low = fed(setWellbeing(game('drift'), 30));
    expect(value(endWeek(low))!).toBe(30 + W.unspentBonus + W.driftStep);
    const high = fed(setWellbeing(game('drift2'), 90));
    expect(value(endWeek(high))!).toBe(90 + W.unspentBonus - W.driftStep);
    // Never past the target: the step is capped by the distance left.
    const near = fed(setWellbeing(game('drift3'), W.driftTarget - W.unspentBonus - 1));
    expect(value(endWeek(near))!).toBe(W.driftTarget);
  });

  it('a week spent to the last hour earns no rest bonus', () => {
    const busy = fed(setWellbeing(game('busy'), 40));
    const spent = patch(
      busy,
      0,
      (p) => {
        p.hoursLeft = W.unspentHoursThreshold - 1;
      },
      on,
    );
    expect(value(endWeek(spent))!).toBe(40 + W.driftStep);
  });

  it('thriving pays happiness, burnout costs hours, and a collapse costs the turn', () => {
    // Against a steady control on the same seed, the only difference is the thrive bonus.
    const thriving = fed(setWellbeing(game('thrive'), W.bands.thrive + 10));
    const steady = fed(setWellbeing(game('thrive'), W.bands.burnout + 1));
    expect(endWeek(thriving).players[0]!.happiness - endWeek(steady).players[0]!.happiness).toBe(
      W.thriveHappiness,
    );

    // A week of rest and drift still leaves this seat inside the burnout band.
    const burnt = fed(setWellbeing(game('burn'), W.bands.collapse + 2));
    const burntTurn = endWeek(burnt);
    expect(burntTurn.players[0]!.hoursLeft).toBe(on.rules.time.weekHours - W.burnoutHours);

    // Low enough that a week of rest and drift still leaves the seat under the collapse band.
    const collapsing = fed(setWellbeing(game('collapse'), 1));
    const collapsed = endWeek(collapsing);
    const p = collapsed.players[0]!;
    expect(p.hoursLeft).toBe(0);
    expect(p.stats.collapses).toBe(1);
    expect(value(collapsed)!).toBe(W.collapseReset);
    // The weekly dependability decay lands first, then the collapse takes its own bite.
    expect(p.dependability).toBe(
      Math.max(
        0,
        collapsing.players[0]!.dependability -
          on.rules.stats.dependabilityDecay +
          W.collapseDependability,
      ),
    );
  });

  it('burnout cuts the pay of a work session and puts a lesson at risk', () => {
    const healthy = employed('pay');
    const burnt = setWellbeing(healthy, W.bands.burnout - 1);
    const fullPay = previewCommand(healthy, 0, { type: 'Work', hours: 12 }, on).money;
    const cutPay = previewCommand(burnt, 0, { type: 'Work', hours: 12 }, on).money;
    expect(cutPay).toBeLessThan(fullPay);
    expect(cutPay).toBe(Math.floor((fullPay * (10_000 - W.burnoutPayPenaltyBp) + 5000) / 10_000));
    // The lesson-waste hook is live while burnt out: some seeds lose the lesson.
    // Different seeds, so the waste roll differs: at 20% some of twenty lessons are lost.
    const wasted = Array.from({ length: 20 }, (_, i) => {
      const s = goInside(
        patch(
          setWellbeing(employed(`waste${i}`), W.bands.burnout - 1),
          0,
          (p) => {
            p.enrolled = { 'trade-school': { lessonsLeft: 10 } };
          },
          on,
        ),
        0,
        'university',
        on,
      );
      return applyCommand(s, 0, { type: 'Study', degreeId: 'trade-school' }, on).events.some(
        (e) => e.type === 'Studied' && !e.counted,
      );
    });
    expect(wasted.some(Boolean)).toBe(true);
    expect(wasted.every(Boolean)).toBe(false);
  });

  it('a pack with the flag off runs the core rules untouched', () => {
    const s = employed('clean', off);
    const worked = run(s, 0, [{ type: 'Work', hours: off.rules.time.workSessionHours }], off);
    expect(worked.players[0]!.modules.wellbeing).toBeUndefined();
    expect(previewCommand(s, 0, { type: 'Work', hours: 12 }, off).money).toBeGreaterThan(0);
  });

  it('bands follow the pack table', () => {
    expect(wellbeingBand(W.bands.thrive, on)).toBe('thrive');
    expect(wellbeingBand(W.bands.thrive - 1, on)).toBe('steady');
    expect(wellbeingBand(W.bands.burnout - 1, on)).toBe('burnout');
    expect(wellbeingBand(W.bands.collapse - 1, on)).toBe('collapse');
  });
});
