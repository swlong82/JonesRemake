/** M5.3: transport modes, the transit pass, car ownership, upkeep, depreciation and trip risks. */
import { describe, expect, it } from 'vitest';
import { loadPack, type CityPack } from '@hustle-ring/content';
import { applyCommand, engineFor, legalCommands, previewCommand } from '../index.js';
import type { Command } from '../commands/commands.generated.js';
import type { ErrorCode } from '@hustle-ring/shared';
import { goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import { carOf, carResale, transportOf } from './transport.js';

const classicPack = loadPack('classic');
const modern = loadPack('modern-western');
const RULES = modern.rules;

/** The code a command would be rejected with, or null when it is legal. */
const why = (s: GameState, cmd: Command, pack: CityPack = modern): ErrorCode | null => {
  const rej = applyCommand(s, 0, cmd, pack).events.find((e) => e.type === 'CommandRejected');
  return rej?.type === 'CommandRejected' ? rej.code : null;
};

/** Enough of a Ctx for `carResale`, which only reads the pack, its rules and the week. */
const resaleCtx = (week: number): Parameters<typeof carResale>[0] =>
  ({ pack: modern, rules: modern.rules, week }) as never;

const game = (seed: string, pack: CityPack = modern): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, pack);

const endWeek = (s: GameState, pack: CityPack = modern): GameState =>
  run(run(s, 0, [{ type: 'EndTurn' }], pack), 1, [{ type: 'EndTurn' }], pack);

const rich = (s: GameState, cash = 20_000): GameState =>
  patch(
    s,
    0,
    (p) => {
      p.cash = cash;
    },
    modern,
  );

const withPhone = (s: GameState): GameState =>
  patch(
    s,
    0,
    (p) => {
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

/** Buys a used car at the pack's resale kiosk with money to spare. */
function withCar(seed: string, kind: 'used' | 'new' = 'used'): GameState {
  const where = kind === 'new' ? RULES.cars.newLocationId : RULES.cars.usedLocationId;
  const at = goInside(rich(game(seed)), 0, where, modern);
  return run(at, 0, [{ type: 'BuyCar', source: kind }], modern);
}

describe('transport module (GDD 4.3)', () => {
  it('classic stays walk-only: the module and its commands are absent', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('transport');
    expect(transportOf(game('c', classicPack).players[0]!)).toBeUndefined();
    const types = new Set(legalCommands(game('c', classicPack), 0, classicPack).map((c) => c.type));
    expect(types.has('BuyCar')).toBe(false);
    expect(types.has('BuyTransitPass')).toBe(false);
    expect(
      why(game('c', classicPack), { type: 'Move', to: 'bank', mode: 'car' }, classicPack),
    ).toBe('ERR_UNKNOWN_ID');
  });

  it('modern offers every mode but gates the ones you have not unlocked', () => {
    const s = game('gate');
    expect(modern.transport.map((m) => m.id)).toEqual(['walk', 'transit', 'ride-hail', 'car']);
    expect(why(s, { type: 'Move', to: 'bank', mode: 'walk' }, modern)).toBeNull();
    // Transit always runs; without a pass you pay the fare.
    expect(why(s, { type: 'Move', to: 'bank', mode: 'transit' }, modern)).toBeNull();
    expect(why(s, { type: 'Move', to: 'bank', mode: 'ride-hail' }, modern)).toBe(
      'ERR_UNLOCK_MISSING',
    );
    expect(why(s, { type: 'Move', to: 'bank', mode: 'car' }, modern)).toBe('ERR_NO_CAR');
    expect(why(withPhone(s), { type: 'Move', to: 'bank', mode: 'ride-hail' }, modern)).toBeNull();
  });

  it('a faster mode costs money and saves hours', () => {
    const s = withPhone(rich(game('speed')));
    const walk = previewCommand(s, 0, { type: 'Move', to: 'university', mode: 'walk' }, modern);
    const ride = previewCommand(
      s,
      0,
      { type: 'Move', to: 'university', mode: 'ride-hail' },
      modern,
    );
    expect(walk.money).toBe(0);
    expect(ride.money).toBeLessThan(0);
    expect(-ride.hours).toBeLessThan(-walk.hours);
  });

  it('the transit pass replaces the fare for the weeks it lasts', () => {
    const s = rich(game('pass'));
    const fare = -previewCommand(s, 0, { type: 'Move', to: 'bank', mode: 'transit' }, modern).money;
    expect(fare).toBeGreaterThan(0);
    // The rent office only opens on a rent week (STATE_MODEL 13.5).
    const onRentWeek = patch(s, 0, (_p, st) => (st.week = RULES.housing.rentWeeks), modern);
    const bought = run(
      goInside(onRentWeek, 0, 'rent-office', modern),
      0,
      [{ type: 'BuyTransitPass' }],
      modern,
    );
    expect(transportOf(bought.players[0]!)!.passWeeks).toBe(RULES.housing.rentWeeks);
    expect(
      previewCommand(bought, 0, { type: 'Move', to: 'bank', mode: 'transit' }, modern).money,
    ).toBe(0);
    let s2 = bought;
    for (let i = 0; i < RULES.housing.rentWeeks; i++) s2 = endWeek(s2);
    expect(transportOf(s2.players[0]!)!.passWeeks).toBe(0);
    expect(
      -previewCommand(s2, 0, { type: 'Move', to: 'bank', mode: 'transit' }, modern).money,
    ).toBe(fare);
  });

  it('buys a car once, unlocks driving, and cannot buy a second', () => {
    const s = withCar('car');
    const car = carOf(s.players[0]!)!;
    expect(car.kind).toBe('used');
    expect(car.value).toBeGreaterThanOrEqual(RULES.cars.usedMin);
    expect(car.value).toBeLessThanOrEqual(RULES.cars.usedMax);
    expect(why(s, { type: 'Move', to: 'bank', mode: 'car' }, modern)).toBeNull();
    expect(why(s, { type: 'BuyCar', source: 'used' }, modern)).toBe('ERR_HAS_CAR');
  });

  it('charges weekly upkeep, depreciates the car and counts it as wealth', () => {
    const s = withCar('upkeep');
    const before = s.players[0]!;
    const valueBefore = carOf(before)!.value;
    const cashBefore = before.cash;
    const next = endWeek(s);
    const car = carOf(next.players[0]!)!;
    expect(car.value).toBe(
      valueBefore - Math.floor((valueBefore * RULES.cars.depreciationBp) / 10_000),
    );
    expect(next.players[0]!.cash).toBeLessThan(cashBefore);
    // The resale value is part of liquid assets, so the wealth goal sees it.
    expect(carResale(resaleCtx(next.week), car)).toBeGreaterThan(0);
  });

  it('sells the car back at the pack rate and ends the unlock', () => {
    const s = withCar('sell');
    const expected = carResale(resaleCtx(s.week), carOf(s.players[0]!)!);
    const sold = run(s, 0, [{ type: 'SellCar' }], modern);
    expect(carOf(sold.players[0]!)).toBeNull();
    expect(sold.players[0]!.cash - s.players[0]!.cash).toBe(expected);
    expect(why(sold, { type: 'Move', to: 'bank', mode: 'car' }, modern)).toBe('ERR_NO_CAR');
  });

  it('a broken car cannot be driven until it is repaired', () => {
    const s = patch(
      withCar('broken'),
      0,
      (p) => {
        transportOf(p)!.car!.broken = true;
      },
      modern,
    );
    expect(why(s, { type: 'Move', to: 'bank', mode: 'car' }, modern)).toBe('ERR_ITEM_BROKEN');
    // The car was bought here, so the seat is already inside the kiosk.
    const fixed = run(s, 0, [{ type: 'RepairCar' }], modern);
    expect(carOf(fixed.players[0]!)!.broken).toBe(false);
    expect(fixed.players[0]!.cash).toBe(s.players[0]!.cash - RULES.cars.repairCost);
    expect(why(fixed, { type: 'RepairCar' }, modern)).toBe('ERR_INVALID_AMOUNT');
  });

  it('driving can break the car down over enough trips', () => {
    let broke = false;
    for (let i = 0; i < 40 && !broke; i++) {
      const s = withCar(`trip${i}`);
      const r = applyCommand(s, 0, { type: 'Move', to: 'bank', mode: 'car' }, modern);
      broke = r.events.some((e) => e.type === 'EventFired' && e.eventId === 'core:car-breakdown');
    }
    expect(broke).toBe(true);
  });

  it('prices a ride the same in the preview and the trip that follows it', () => {
    for (let i = 0; i < 25; i++) {
      const s = withPhone(rich(game(`surge${i}`)));
      const cmd = { type: 'Move', to: 'university', mode: 'ride-hail' } as const;
      const quoted = -previewCommand(s, 0, cmd, modern).money;
      const after = applyCommand(s, 0, cmd, modern).state;
      expect(s.players[0]!.cash - after.players[0]!.cash).toBe(quoted);
    }
  });
});
