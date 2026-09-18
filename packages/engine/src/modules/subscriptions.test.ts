/** M5.5–M5.6: subscriptions (billing, drift, cancel-where-you-started) and online study. */
import { describe, expect, it } from 'vitest';
import { loadPack, type CityPack } from '@hustle-ring/content';
import { applyCommand, engineFor, legalCommands, previewCommand } from '../index.js';
import type { Command } from '../commands/commands.generated.js';
import type { ErrorCode } from '@hustle-ring/shared';
import { goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import { activeSubs, weeklySubTotal } from './subscriptions.js';

const classicPack = loadPack('classic');
const modern = loadPack('modern-western');
const RULES = modern.rules;
const INTERNET = modern.subscriptionById['home-internet']!;
const GYM = modern.subscriptionById.gym!;

const game = (seed: string, pack: CityPack = modern): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, pack);

const why = (s: GameState, cmd: Command, pack: CityPack = modern): ErrorCode | null => {
  const rej = applyCommand(s, 0, cmd, pack).events.find((e) => e.type === 'CommandRejected');
  return rej?.type === 'CommandRejected' ? rej.code : null;
};

const endWeek = (s: GameState): GameState =>
  run(run(s, 0, [{ type: 'EndTurn' }], modern), 1, [{ type: 'EndTurn' }], modern);

const funded = (s: GameState, cash = 2000): GameState =>
  patch(
    s,
    0,
    (p) => {
      p.cash = cash;
      p.items.push({
        uid: 'fridge',
        itemId: 'refrigerator',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      });
      p.food.fridgeUnits = 40;
    },
    modern,
  );

/** Subscribed to home internet at the desk that sells it. */
function subscribed(seed: string, subId = 'home-internet'): GameState {
  const spec = modern.subscriptionById[subId]!;
  const at = goInside(funded(game(seed)), 0, spec.locationId, modern);
  return run(at, 0, [{ type: 'Subscribe', subId }], modern);
}

describe('subscriptions module (GDD 4.11)', () => {
  it('classic has none of it', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('subscriptions');
    const types = new Set(legalCommands(game('c', classicPack), 0, classicPack).map((c) => c.type));
    expect(types.has('Subscribe')).toBe(false);
  });

  it('signs up at the desk that sells it, and nowhere else', () => {
    const elsewhere = goInside(funded(game('where')), 0, 'grocery', modern);
    expect(why(elsewhere, { type: 'Subscribe', subId: 'home-internet' })).toBe(
      'ERR_NOT_AT_LOCATION',
    );
    const wrongDesk = goInside(funded(game('where2')), 0, GYM.locationId, modern);
    expect(why(wrongDesk, { type: 'Subscribe', subId: 'home-internet' })).toBe(
      'ERR_SUB_WRONG_LOCATION',
    );
    const s = subscribed('sign');
    expect(activeSubs(s.players[0]!)).toEqual(['home-internet']);
    expect(weeklySubTotal(s.players[0]!)).toBe(INTERNET.weeklyPrice);
    expect(why(s, { type: 'Subscribe', subId: 'home-internet' })).toBe('ERR_SUB_ACTIVE');
  });

  it('bills every week and pays out what the subscription is worth', () => {
    const s = subscribed('bill', 'gym');
    const before = s.players[0]!;
    const next = endWeek(s);
    const after = next.players[0]!;
    expect(before.cash - after.cash).toBeGreaterThanOrEqual(GYM.weeklyPrice);
    // Against the same week without the gym, the difference is exactly what the gym pays.
    const control = endWeek(funded(game('bill'))).players[0]!;
    const wb = (p: typeof after): number => (p.modules.wellbeing as { value: number }).value;
    expect(wb(after) - wb(control)).toBe(GYM.wellbeingPerWeek);
  });

  it('a subscription you cannot pay for cancels itself, and it hurts', () => {
    const broke = patch(
      subscribed('broke', 'gym'),
      0,
      (p) => {
        p.cash = 0;
        p.bank = 0;
      },
      modern,
    );
    const happyBefore = broke.players[0]!.happiness;
    const next = endWeek(broke);
    expect(activeSubs(next.players[0]!)).toEqual([]);
    expect(next.players[0]!.happiness).toBeLessThan(happyBefore);
  });

  it('cancelling means going back to where you signed up', () => {
    const s = subscribed('cancel');
    // Another subscription desk is still the wrong desk for this subscription.
    const away = run(
      s,
      0,
      [{ type: 'Exit' }, { type: 'Move', to: 'burger-joint', mode: 'walk' }, { type: 'Enter' }],
      modern,
    );
    expect(why(away, { type: 'Unsubscribe', subId: 'home-internet' })).toBe(
      'ERR_SUB_WRONG_LOCATION',
    );
    const cancelled = run(s, 0, [{ type: 'Unsubscribe', subId: 'home-internet' }], modern);
    expect(activeSubs(cancelled.players[0]!)).toEqual([]);
    expect(why(cancelled, { type: 'Unsubscribe', subId: 'home-internet' })).toBe(
      'ERR_SUB_INACTIVE',
    );
  });

  it('prices drift up on the pack schedule, never down', () => {
    let s = subscribed('drift');
    const start = weeklySubTotal(s.players[0]!);
    for (let i = 0; i < RULES.subscriptions.driftEveryWeeks * 6; i++) s = funded(endWeek(s));
    const now = weeklySubTotal(s.players[0]!);
    expect(now).toBeGreaterThanOrEqual(start);
    expect(activeSubs(s.players[0]!)).toEqual(['home-internet']);
  });
});

describe('online study module (GDD 4.7)', () => {
  /** A laptop, home internet and a course to study. */
  function student(seed: string, extraSub?: string): GameState {
    let s = subscribed(seed);
    if (extraSub) {
      const spec = modern.subscriptionById[extraSub]!;
      const at = run(s, 0, [{ type: 'Exit' }], modern);
      s = run(
        goInside(at, 0, spec.locationId, modern),
        0,
        [{ type: 'Subscribe', subId: extraSub }],
        modern,
      );
    }
    return patch(
      s,
      0,
      (p) => {
        p.items.push({
          uid: 'laptop',
          itemId: 'laptop',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'electronics-store',
        });
        p.enrolled = { 'trade-school': { lessonsLeft: 10 } };
        p.location = modern.homeLocation[p.home.tier];
        p.inside = true;
      },
      modern,
    );
  }

  it('needs the laptop, the internet and to be at home', () => {
    const bare = patch(
      subscribed('needs'),
      0,
      (p) => {
        p.enrolled = { 'trade-school': { lessonsLeft: 10 } };
        p.location = modern.homeLocation[p.home.tier];
        p.inside = true;
      },
      modern,
    );
    expect(why(bare, { type: 'StudyOnline', degreeId: 'trade-school' })).toBe('ERR_UNLOCK_MISSING');
    const away = patch(student('away'), 0, (p) => (p.location = 'grocery'), modern);
    expect(why(away, { type: 'StudyOnline', degreeId: 'trade-school' })).toBe(
      'ERR_NOT_AT_LOCATION',
    );
    expect(why(student('ok'), { type: 'StudyOnline', degreeId: 'trade-school' })).toBeNull();
  });

  it('counts as a lesson, costs the same hours and is gentler on wellbeing', () => {
    const s = student('lesson');
    const before = s.players[0]!;
    const after = run(s, 0, [{ type: 'StudyOnline', degreeId: 'trade-school' }], modern)
      .players[0]!;
    expect(before.hoursLeft - after.hoursLeft).toBe(RULES.time.lessonHours);
    const wb = (p: typeof before): number => (p.modules.wellbeing as { value: number }).value;
    expect(wb(before) - wb(after)).toBe(-RULES.wellbeing.onlineStudyDelta);
    // Either the lesson counted or it was doomscrolled; both are possible, nothing else is.
    expect([before.enrolled['trade-school']!.lessonsLeft - 1, 10]).toContain(
      after.enrolled['trade-school']?.lessonsLeft ?? 0,
    );
  });

  it('doomscrolls some of the lessons, and the focus app cuts that down', () => {
    const risk = (s: GameState): number =>
      previewCommand(s, 0, { type: 'StudyOnline', degreeId: 'trade-school' }, modern).riskBp ?? 0;
    expect(risk(student('risk'))).toBe(RULES.onlineStudy.wasteBp);
    expect(risk(student('focus', 'focus-app'))).toBe(RULES.onlineStudy.focusWasteBp);
    let wasted = 0;
    for (let i = 0; i < 40; i++) {
      const r = applyCommand(
        student(`waste${i}`),
        0,
        { type: 'StudyOnline', degreeId: 'trade-school' },
        modern,
      );
      if (r.events.some((e) => e.type === 'Studied' && !e.counted)) wasted += 1;
    }
    expect(wasted).toBeGreaterThan(0);
    expect(wasted).toBeLessThan(40);
  });
});
