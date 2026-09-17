/** M5.6: delivery, rent hikes and the co-living roommate. */
import { describe, expect, it } from 'vitest';
import { loadPack, type CityPack } from '@hustle-ring/content';
import { applyCommand, engineFor, previewCommand } from '../index.js';
import type { Command } from '../commands/commands.generated.js';
import type { ErrorCode } from '@hustle-ring/shared';
import { goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import { deliveryPrice } from './delivery.js';
import { rentHikeNotice } from './rent-hikes.js';

const classicPack = loadPack('classic');
const modern = loadPack('modern-western');
const RULES = modern.rules;
const MEAL = modern.meals.find((m) => m.deliveryEligible)!;

const game = (seed: string, pack: CityPack = modern, chaos: 'off' | 'modern' = 'off'): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos }, pack);

const why = (s: GameState, cmd: Command, pack: CityPack = modern): ErrorCode | null => {
  const rej = applyCommand(s, 0, cmd, pack).events.find((e) => e.type === 'CommandRejected');
  return rej?.type === 'CommandRejected' ? rej.code : null;
};

const endWeek = (s: GameState): GameState =>
  run(run(s, 0, [{ type: 'EndTurn' }], modern), 1, [{ type: 'EndTurn' }], modern);

const withPhone = (s: GameState, cash = 500): GameState =>
  patch(
    s,
    0,
    (p) => {
      p.cash = cash;
      p.items.push({
        uid: 'phone',
        itemId: 'smartphone',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
    },
    modern,
  );

describe('delivery module (GDD 4.11)', () => {
  it('needs a phone, and classic has no delivery at all', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('delivery');
    expect(why(game('nophone'), { type: 'OrderDelivery', mealId: MEAL.id })).toBe(
      'ERR_UNLOCK_MISSING',
    );
  });

  it('costs the markup and half an hour, wherever you are', () => {
    const s = withPhone(game('order'));
    const price = deliveryPrice(
      {
        pack: modern,
        rules: RULES,
        econ: (n: number) => n,
        playerAt: () => s.players[0]!,
      } as never,
      0,
      MEAL.id,
    );
    expect(price).toBeGreaterThan(MEAL.price);
    const pv = previewCommand(s, 0, { type: 'OrderDelivery', mealId: MEAL.id }, modern);
    expect(-pv.hours).toBe(RULES.time.deliveryHours);
    expect(-pv.money).toBe(price);
    expect(pv.riskBp).toBe(RULES.food.deliveryLostBp);
    const fed = run(s, 0, [{ type: 'OrderDelivery', mealId: MEAL.id }], modern);
    // Either the meal is waiting for next turn or the order was lost; both are the rule.
    const p = fed.players[0]!;
    expect(p.food.mealPending === MEAL.id || p.cash > s.players[0]!.cash - price).toBe(true);
  });

  it('a food-club subscription takes the discount off the markup', () => {
    const plain = withPhone(game('plain'));
    const club = run(
      goInside(
        withPhone(game('club')),
        0,
        modern.subscriptionById['food-club']!.locationId,
        modern,
      ),
      0,
      [{ type: 'Subscribe', subId: 'food-club' }],
      modern,
    );
    const cost = (s: GameState): number =>
      -previewCommand(s, 0, { type: 'OrderDelivery', mealId: MEAL.id }, modern).money;
    expect(cost(club)).toBeLessThan(cost(plain));
    expect(cost(club)).toBeGreaterThanOrEqual(MEAL.price);
  });

  it('loses some orders and refunds part of the money', () => {
    let lost = 0;
    for (let i = 0; i < 80; i++) {
      const r = applyCommand(
        withPhone(game(`lost${i}`)),
        0,
        { type: 'OrderDelivery', mealId: MEAL.id },
        modern,
      );
      if (r.events.some((e) => e.type === 'EventFired' && e.eventId === 'core:delivery-lost')) {
        lost += 1;
        expect(r.state.players[0]!.food.mealPending).toBeNull();
      }
    }
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(80);
  });
});

describe('modern housing (GDD 4.10)', () => {
  it('classic keeps its rent locked forever', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('rent-hikes');
  });

  it('gives notice a week before a renewal, then raises the locked rent', () => {
    for (let i = 0; i < 40; i++) {
      let s = game(`hike${i}`, modern, 'modern');
      let noticed: { bp: number; week: number } | null = null;
      for (let w = 0; w < RULES.housing.rentWeeks * 2 && !noticed; w++) {
        s = endWeek(s);
        noticed = rentHikeNotice(s.players[0]!);
      }
      if (!noticed) continue;
      expect(noticed.bp).toBeGreaterThanOrEqual(RULES.housing.rentHike.minBp);
      expect(noticed.bp).toBeLessThanOrEqual(RULES.housing.rentHike.maxBp);
      expect(noticed.week % RULES.housing.rentWeeks).toBe(0);
      const rentBefore = s.players[0]!.home.rentLocked;
      while (s.week < noticed.week) s = endWeek(s);
      expect(s.players[0]!.home.rentLocked).toBeGreaterThan(rentBefore);
      expect(rentHikeNotice(s.players[0]!)).toBeNull();
      return;
    }
    throw new Error('no rent hike in 40 seeds');
  });

  it('the roommate borrows food from a co-living fridge', () => {
    let borrowed = false;
    for (let i = 0; i < 40 && !borrowed; i++) {
      const s = patch(
        game(`room${i}`, modern, 'modern'),
        0,
        (p) => {
          p.food.fridgeUnits = 6;
          p.items.push({
            uid: 'fridge',
            itemId: 'refrigerator',
            condition: 'ok',
            boughtWeek: 1,
            boughtAt: 'appliance-depot',
          });
        },
        modern,
      );
      const next = endWeek(s);
      borrowed = next.players[0]!.food.fridgeUnits < 5; // one eaten at turn start, one borrowed
    }
    expect(borrowed).toBe(true);
  });
});
