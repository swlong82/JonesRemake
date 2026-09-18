/** M5.4: gig work — signup requirements, shift pay, dual employment and what a gig does not pay. */
import { describe, expect, it } from 'vitest';
import { loadPack, type CityPack } from '@hustle-ring/content';
import { applyCommand, computeGoals, engineFor, legalCommands, previewCommand } from '../index.js';
import type { Command } from '../commands/commands.generated.js';
import type { ErrorCode } from '@hustle-ring/shared';
import { goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import { gigDemandPm, gigOf, gigPay } from './gig.js';
import { transportOf } from './transport.js';

const classicPack = loadPack('classic');
const modern = loadPack('modern-western');
const RULES = modern.rules;
const [SHORT, LONG] = RULES.time.gigShiftHours as [number, number];

const game = (seed: string, pack: CityPack = modern): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, pack);

const why = (s: GameState, cmd: Command, pack: CityPack = modern): ErrorCode | null => {
  const rej = applyCommand(s, 0, cmd, pack).events.find((e) => e.type === 'CommandRejected');
  return rej?.type === 'CommandRejected' ? rej.code : null;
};

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

const withCar = (s: GameState): GameState =>
  patch(
    s,
    0,
    (p) => {
      transportOf(p)!.car = { kind: 'used', value: 3000, boughtWeek: 1, broken: false };
    },
    modern,
  );

/** At the employment office, signed up as a delivery rider. */
function rider(seed: string): GameState {
  const at = goInside(withPhone(game(seed)), 0, 'employment-office', modern);
  return run(at, 0, [{ type: 'GigSignup', gigId: 'gig-delivery-rider' }], modern);
}

describe('gig module (GDD 4.6)', () => {
  it('classic has no gigs at all', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('gig');
    const types = new Set(legalCommands(game('c', classicPack), 0, classicPack).map((c) => c.type));
    expect(types.has('GigSignup')).toBe(false);
    expect(classicPack.jobs.some((j) => j.isGig)).toBe(false);
  });

  it('signing up needs the gig requirements and costs the pack hours', () => {
    const office = goInside(game('req'), 0, 'employment-office', modern);
    expect(why(office, { type: 'GigSignup', gigId: 'gig-delivery-rider' })).toBe(
      'ERR_GIG_REQUIREMENT',
    );
    expect(why(withPhone(office), { type: 'GigSignup', gigId: 'gig-ride-hail-driver' })).toBe(
      'ERR_NO_CAR',
    );
    const ready = goInside(withPhone(game('sign')), 0, 'employment-office', modern);
    const signed = run(ready, 0, [{ type: 'GigSignup', gigId: 'gig-delivery-rider' }], modern);
    expect(gigOf(signed.players[0]!)).toBe('gig-delivery-rider');
    expect(signed.players[0]!.hoursLeft).toBe(
      ready.players[0]!.hoursLeft - RULES.time.gigSignupHours,
    );
    expect(why(signed, { type: 'GigSignup', gigId: 'gig-delivery-rider' })).toBe(
      'ERR_ALREADY_HAVE_JOB',
    );
  });

  it('a shift pays by the block, anywhere on the board, and only in the pack blocks', () => {
    const s = rider('shift');
    expect(why(s, { type: 'GigShift', hours: 5 })).toBe('ERR_INVALID_AMOUNT');
    const quoted = previewCommand(s, 0, { type: 'GigShift', hours: LONG }, modern).money;
    const worked = run(s, 0, [{ type: 'GigShift', hours: LONG }], modern);
    expect(worked.players[0]!.cash - s.players[0]!.cash).toBe(quoted);
    expect(quoted).toBeGreaterThan(0);
    // A short block pays proportionally less.
    const short = previewCommand(s, 0, { type: 'GigShift', hours: SHORT }, modern).money;
    expect(short).toBeLessThan(quoted);
    // Outside a location too: a gig is worked wherever the seat happens to be.
    const outside = run(s, 0, [{ type: 'Exit' }, { type: 'GigShift', hours: SHORT }], modern);
    expect(outside.players[0]!.cash).toBeGreaterThan(s.players[0]!.cash);
  });

  it('pays no experience, no dependability and no career', () => {
    const s = rider('stats');
    const before = s.players[0]!;
    const after = run(s, 0, [{ type: 'GigShift', hours: LONG }], modern).players[0]!;
    expect(after.experience).toBe(before.experience);
    expect(after.dependability).toBe(before.dependability);
    expect(computeGoals(after, s, modern, 0).career).toBe(0);
  });

  it('a gig and a regular job can be held at once, and career follows the regular job', () => {
    const employed = patch(
      rider('dual'),
      0,
      (p) => {
        p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
        p.dependability = 40;
      },
      modern,
    );
    expect(gigOf(employed.players[0]!)).toBe('gig-delivery-rider');
    expect(computeGoals(employed.players[0]!, employed, modern, 0).career).toBeGreaterThan(0);
  });

  it('demand is rolled once a week and scales every shift that week', () => {
    let s = rider('demand');
    const first = gigDemandPm(s);
    expect(first).toBeGreaterThanOrEqual(RULES.gig.demandMinPm);
    expect(first).toBeLessThanOrEqual(RULES.gig.demandMaxPm);
    const a = previewCommand(s, 0, { type: 'GigShift', hours: LONG }, modern).money;
    const b = previewCommand(s, 0, { type: 'GigShift', hours: LONG }, modern).money;
    expect(a).toBe(b);
    const seen = new Set<number>();
    for (let i = 0; i < 12; i++) {
      s = run(run(s, 0, [{ type: 'EndTurn' }], modern), 1, [{ type: 'EndTurn' }], modern);
      seen.add(gigDemandPm(s));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('driving for a living wears the car out, at the rate the pack sets', () => {
    // The wear chance is a content value, so the two ends of it are what a test can pin down.
    const withWear = (bp: number): CityPack => ({
      ...modern,
      rules: { ...RULES, gig: { ...RULES.gig, carWearBp: bp } },
    });
    const driverAt = (pack: CityPack): GameState => {
      const at = goInside(withCar(withPhone(game('wear', pack))), 0, 'employment-office', pack);
      return run(at, 0, [{ type: 'GigSignup', gigId: 'gig-ride-hail-driver' }], pack);
    };
    const always = withWear(10_000);
    const broken = applyCommand(driverAt(always), 0, { type: 'GigShift', hours: LONG }, always);
    expect(transportOf(broken.state.players[0]!)!.car!.broken).toBe(true);
    expect(
      broken.events.some((e) => e.type === 'EventFired' && e.eventId === 'core:car-breakdown'),
    ).toBe(true);
    const never = withWear(0);
    const fine = applyCommand(driverAt(never), 0, { type: 'GigShift', hours: LONG }, never);
    expect(transportOf(fine.state.players[0]!)!.car!.broken).toBe(false);
    expect(RULES.gig.carWearBp).toBeGreaterThan(0);
  });

  it('a gig shift is worth something to anything that asks what a seat earns', () => {
    const s = rider('income');
    expect(
      gigPay(
        {
          pack: modern,
          rules: RULES,
          state: s,
          playerAt: () => s.players[0]!,
          econ: (n: number) => n,
        } as never,
        0,
        LONG,
      ),
    ).toBeGreaterThan(0);
  });
});
