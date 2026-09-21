/** M5.7: modern instruments with correlated returns, and loans end to end. */
import { describe, expect, it } from 'vitest';
import { loadPack, type CityPack } from '@hustle-ring/content';
import {
  applyCommand,
  cloneState,
  computeGoals,
  Ctx,
  engineFor,
  previewCommand,
} from '../index.js';
import type { Command } from '../commands/commands.generated.js';
import type { ErrorCode } from '@hustle-ring/shared';
import { goInside, humanSeat, newGame, patch, run } from '../testing.js';
import type { GameState } from '../core/state.js';
import {
  aprBpFor,
  defaultDebtOf,
  loansOf,
  totalOwed,
  weeklyInterest,
  weeklyPayment,
} from './loans.js';
import { idioWeightBp, stepDrift } from './modern-assets.js';
import { transportOf } from './transport.js';
import { Rng } from '../core/rng.js';

const classicPack = loadPack('classic');
const modern = loadPack('modern-western');
const SPEC = modern.loans!;

const game = (seed: string, pack: CityPack = modern): GameState =>
  newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }, pack);

const why = (s: GameState, cmd: Command, pack: CityPack = modern): ErrorCode | null => {
  const rej = applyCommand(s, 0, cmd, pack).events.find((e) => e.type === 'CommandRejected');
  return rej?.type === 'CommandRejected' ? rej.code : null;
};

const endWeek = (s: GameState): GameState =>
  run(run(s, 0, [{ type: 'EndTurn' }], modern), 1, [{ type: 'EndTurn' }], modern);

/** Run only the real loans turn-start hook, isolating its ledger effects from weekend events. */
function collectLoanPayment(s: GameState): GameState {
  const next = cloneState(s);
  next.week += 1;
  const engine = engineFor(modern);
  const ctx = new Ctx(next, modern, 0, true);
  ctx.engine = engine;
  ctx.setListeners(engine.hooks.onDomainEvent.map((h) => h.fn));
  engine.hooks.onTurnStart.find((h) => h.module === 'loans')!.fn(ctx);
  return next;
}

/** At the bank, with a job good enough to borrow against and food in the fridge. */
function borrower(seed: string, wage = 20): GameState {
  const s = patch(
    game(seed),
    0,
    (p) => {
      p.job = { jobId: 'factory-general-manager', wage, raises: 0, hiredWeek: 1 };
      p.dependability = 60;
      p.experience = 60;
      p.cash = 200;
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
  return goInside(s, 0, 'bank', modern);
}

/** The closed-form amortised payment, in dollars, for comparison with the engine's integer one. */
function closedForm(principal: number, aprBp: number, termWeeks: number): number {
  const r = aprBp / 10_000 / 52;
  return (principal * r) / (1 - Math.pow(1 + r, -termWeeks));
}

describe('modern instruments (GDD 4.12)', () => {
  it('the flag swaps the six classic instruments for the six modern ones', () => {
    expect(classicPack.assets.map((a) => a.set)).toEqual(Array(6).fill('classic'));
    expect(modern.assets.map((a) => a.id)).toEqual([
      'savings',
      'bonds',
      'index-etf',
      'tech-stock',
      'crypto',
      'gold-modern',
    ]);
    expect(modern.allAssets).toHaveLength(12);
  });

  it('savings only ever accrues', () => {
    const savings = modern.assetById.savings!;
    const ctx = { rules: modern.rules, state: { econ: { lastChangePm: -50 } } } as never;
    expect(stepDrift(ctx, savings, 10_000)).toBe(10_005);
  });

  it('idiosyncratic weight is √(1 − corr²), so the realised correlation is the content value', () => {
    expect(idioWeightBp(0)).toBe(10_000);
    expect(idioWeightBp(10_000)).toBe(0);
    expect(idioWeightBp(6_000)).toBe(8_000);
    expect(idioWeightBp(-8_000)).toBe(6_000);
  });

  it('AC: simulated returns correlate with the economy within ±0.1 of the spec', () => {
    const WEEKS = 50_000;
    for (const asset of modern.assets.filter((a) => a.volBp > 0)) {
      const rng = new Rng({}, `corr:${asset.id}`);
      const state = { econ: { lastChangePm: 0 } };
      const ctx = { rules: modern.rules, state, rng } as never;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let w = 0; w < WEEKS; w++) {
        state.econ.lastChangePm = rng.normal('economy', modern.rules.econ.noiseSigma);
        const price = 1_000_000;
        ys.push(stepDrift(ctx, asset, price) - price);
        xs.push(state.econ.lastChangePm);
      }
      const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
      const mx = mean(xs);
      const my = mean(ys);
      let cov = 0;
      let vx = 0;
      let vy = 0;
      for (let i = 0; i < WEEKS; i++) {
        const dx = xs[i]! - mx;
        const dy = ys[i]! - my;
        cov += dx * dy;
        vx += dx * dx;
        vy += dy * dy;
      }
      const corr = cov / Math.sqrt(vx * vy);
      expect(Math.abs(corr - asset.econCorrBp / 10_000)).toBeLessThan(0.1);
    }
  }, 30_000);
});

describe('loans module (GDD 4.12)', () => {
  it('classic cannot borrow at all', () => {
    expect(engineFor(classicPack).moduleIds).not.toContain('loans');
    expect(classicPack.loans).toBeNull();
  });

  it('rounds the fixed weekly payment up to whole dollars and interest half-up', () => {
    for (const principal of [500, 1500, 5000, 15_000])
      for (const termWeeks of SPEC.terms)
        for (const aprBp of [600, 1000, 1800]) {
          const engineValue = weeklyPayment(principal, aprBp, termWeeks);
          const exact = closedForm(principal, aprBp, termWeeks);
          expect(engineValue).toBe(Math.ceil(exact));
        }
    // 260 × 10% / 52 = exactly $0.50; 259 is just below the half-dollar boundary.
    expect(weeklyInterest(260, 1000)).toBe(1);
    expect(weeklyInterest(259, 1000)).toBe(0);
  });

  it('approves against income, refuses without it, and takes a car as collateral', () => {
    const rich = borrower('approve', 25);
    expect(
      why(rich, { type: 'TakeLoan', principal: SPEC.min, termWeeks: SPEC.terms[0]! }),
    ).toBeNull();
    const jobless = patch(borrower('poor'), 0, (p) => (p.job = null), modern);
    expect(why(jobless, { type: 'TakeLoan', principal: SPEC.max, termWeeks: SPEC.terms[0]! })).toBe(
      'ERR_LOAN_DENIED',
    );
    const withCar = patch(
      jobless,
      0,
      (p) => {
        transportOf(p)!.car = { kind: 'new', value: 12_000, boughtWeek: 1, broken: false };
      },
      modern,
    );
    expect(
      why(withCar, {
        type: 'TakeLoan',
        principal: SPEC.max,
        termWeeks: SPEC.terms[0]!,
        collateral: 'car',
      }),
    ).toBeNull();
  });

  it('charges more when the economy is dear or the seat is unreliable', () => {
    const steady = borrower('apr');
    const shaky = patch(steady, 0, (p) => (p.dependability = SPEC.lowDepThreshold - 1), modern);
    const ctxOf = (s: GameState): number =>
      previewCommand(s, 0, { type: 'TakeLoan', principal: 1000, termWeeks: 52 }, modern)
        .notes.map((n) => Number(n.split(':')[1]))
        .at(0) ?? 0;
    expect(ctxOf(shaky)).toBe(ctxOf(steady) + SPEC.aprLowDepBp);
  });

  it('pays the loan down weekly and counts the balance against wealth', () => {
    const s = run(
      borrower('repay'),
      0,
      [{ type: 'TakeLoan', principal: 1000, termWeeks: 52 }],
      modern,
    );
    const loan = loansOf(s.players[0]!)[0]!;
    expect(loan.balance).toBe(1000);
    expect(s.players[0]!.cash).toBe(1200);
    // Borrowed cash is not wealth: the balance cancels it out.
    const engine = engineFor(modern);
    let moduleWealth = 0;
    for (const h of engine.hooks.contributeWealth)
      moduleWealth += h.fn(
        {
          state: s,
          pack: modern,
          playerAt: () => s.players[0]!,
          rules: modern.rules,
          week: s.week,
        } as never,
        0,
      );
    expect(computeGoals(s.players[0]!, s, modern, moduleWealth).wealth).toBe(
      computeGoals(s.players[0]!, s, modern, 0).wealth - 10,
    );
    const next = endWeek(s);
    expect(loansOf(next.players[0]!)[0]!.balance).toBeLessThan(1000);
  });

  it('matches an independently calculated principal-and-interest schedule', () => {
    let s = run(
      borrower('schedule'),
      0,
      [{ type: 'TakeLoan', principal: 1500, termWeeks: 52 }],
      modern,
    );
    const original = loansOf(s.players[0]!)[0]!;
    const payment = Math.ceil(closedForm(1500, original.aprBp, 52));
    expect(original.weeklyPayment).toBe(payment);

    let expectedBalance = 1500;
    for (let installment = 1; installment <= 52; installment++) {
      const interest = Math.floor((expectedBalance * original.aprBp + 260_000) / 520_000);
      const balanceWithInterest = expectedBalance + interest;
      const expectedPaid =
        installment === 52 ? balanceWithInterest : Math.min(payment, balanceWithInterest);
      expectedBalance = balanceWithInterest - expectedPaid;
      s = endWeek(patch(s, 0, (p) => (p.cash = 1000), modern));
      expect(loansOf(s.players[0]!)[0]?.balance ?? 0).toBe(expectedBalance);
    }
    expect(expectedBalance).toBe(0);
    expect(totalOwed(s.players[0]!)).toBe(0);
  });

  it('credits a partial scheduled payment before adding the missed-payment fee', () => {
    let s = run(
      borrower('partial-scheduled'),
      0,
      [{ type: 'TakeLoan', principal: 1000, termWeeks: 52 }],
      modern,
    );
    const loan = loansOf(s.players[0]!)[0]!;
    const paid = Math.floor(loan.weeklyPayment / 2);
    s = collectLoanPayment(
      patch(
        s,
        0,
        (p) => {
          p.cash = paid;
          p.bank = 0;
        },
        modern,
      ),
    );
    const after = loansOf(s.players[0]!)[0]!;
    expect(after.balance).toBe(1000 + weeklyInterest(1000, loan.aprBp) - paid + SPEC.missedFee);
    expect(after.missed).toBe(1);
    expect(s.players[0]!.cash).toBe(0);
  });

  it('default preserves the debt in wealth and wage garnishment repays it', () => {
    let s = run(
      borrower('miss'),
      0,
      [{ type: 'TakeLoan', principal: 1000, termWeeks: 52 }],
      modern,
    );
    s = patch(
      s,
      0,
      (p) => {
        p.cash = 0;
        p.bank = 0;
        p.job = null;
        transportOf(p)!.car = { kind: 'used', value: 3000, boughtWeek: 1, broken: false };
        loansOf(p)[0]!.collateral = 'car';
      },
      modern,
    );
    const owedBefore = totalOwed(s.players[0]!);
    const once = endWeek(s);
    expect(totalOwed(once.players[0]!)).toBeGreaterThan(owedBefore);
    expect(loansOf(once.players[0]!)[0]!.missed).toBe(1);
    let defaulted = once;
    for (let i = 1; i < SPEC.defaultAfter; i++)
      defaulted = endWeek(
        patch(
          defaulted,
          0,
          (p) => {
            p.cash = 0;
            p.bank = 0;
          },
          modern,
        ),
      );
    expect(loansOf(defaulted.players[0]!)).toHaveLength(0);
    expect(transportOf(defaulted.players[0]!)!.car).toBeNull();
    const defaultDebt = totalOwed(defaulted.players[0]!);
    expect(defaultDebt).toBeGreaterThan(0);
    expect(defaultDebtOf(defaulted.players[0]!)).toBe(defaultDebt);

    const engine = engineFor(modern);
    const wealth = engine.hooks.contributeWealth.reduce(
      (sum, h) =>
        sum +
        h.fn(
          {
            state: defaulted,
            pack: modern,
            playerAt: () => defaulted.players[0]!,
            rules: modern.rules,
            week: defaulted.week,
          } as never,
          0,
        ),
      0,
    );
    expect(wealth).toBe(-defaultDebt);

    const readyToWork = patch(
      defaulted,
      0,
      (p) => {
        p.cash = 0;
        p.location = 'burger-joint';
        p.inside = true;
        p.job = { jobId: 'burger-joint-cook', wage: 10, raises: 0, hiredWeek: 1 };
        p.home.debt = 0;
        p.home.debtSinceWeek = null;
      },
      modern,
    );
    const worked = run(readyToWork, 0, [{ type: 'Work', hours: 12 }], modern);
    const grossPay = modern.rules.jobs.payPerSession * 10;
    const garnished = Math.floor((grossPay * SPEC.garnishBp + 5000) / 10_000);
    expect(worked.players[0]!.cash).toBe(grossPay - garnished);
    expect(totalOwed(worked.players[0]!)).toBe(defaultDebt - garnished);

    const remaining = totalOwed(worked.players[0]!);
    const atBank = patch(
      worked,
      0,
      (p) => {
        p.cash = remaining;
        p.location = 'bank';
        p.inside = true;
      },
      modern,
    );
    const cleared = run(atBank, 0, [{ type: 'RepayLoan', amount: remaining }], modern);
    expect(totalOwed(cleared.players[0]!)).toBe(0);
    expect(cleared.players[0]!.cash).toBe(0);
  });

  it('credits partial early repayment and can then be repaid in full with no penalty', () => {
    const s = run(
      borrower('early'),
      0,
      [{ type: 'TakeLoan', principal: 1000, termWeeks: 104 }],
      modern,
    );
    const partial = run(s, 0, [{ type: 'RepayLoan', amount: 123 }], modern);
    expect(totalOwed(partial.players[0]!)).toBe(877);
    expect(s.players[0]!.cash - partial.players[0]!.cash).toBe(123);
    const owed = totalOwed(partial.players[0]!);
    const cleared = run(partial, 0, [{ type: 'RepayLoan', amount: owed }], modern);
    expect(loansOf(cleared.players[0]!)).toHaveLength(0);
    expect(partial.players[0]!.cash - cleared.players[0]!.cash).toBe(owed);
    expect(why(cleared, { type: 'RepayLoan', amount: 10 })).toBe('ERR_NO_LOAN');
  });

  it('APR rises with the economy', () => {
    const s = borrower('econ');
    const dear = patch(s, 0, (_p, st) => (st.econ.index = 1500), modern);
    const cheap = patch(s, 0, (_p, st) => (st.econ.index = 1000), modern);
    const apr = (g: GameState): number =>
      aprBpFor(
        { pack: modern, rules: modern.rules, state: g, playerAt: () => g.players[0]! } as never,
        0,
      );
    expect(apr(dear)).toBeGreaterThan(apr(cheap));
  });
});
