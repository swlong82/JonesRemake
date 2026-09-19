/**
 * loans (order 170, flag `loans`): GDD 4.12. Borrow at the bank against what you earn or against
 * the car, pay a level weekly amount that is debited at the start of your turn, and find out what
 * missing it costs. The balance counts against liquid assets, so a loan never flatters the wealth
 * goal.
 *
 * The weekly payment is the textbook amortised one, computed in fixed point: `P·r/(1−(1+r)^−n)`
 * with `r` the weekly rate. `(1+r)^n` is built by repeated multiplication rather than `Math.pow`,
 * so the engine stays free of floating point for game values (STATE_MODEL 13.1). ADR-0029 fixes
 * the whole-dollar rounding rules for the payment, weekly interest and final instalment.
 */
import { z } from 'zod';
import type { Ctx } from '../core/ctx.js';
import type { BaseCommand, CommandHandler, Engine, RuleModule } from '../core/module.js';
import type { PlayerState } from '../core/state.js';
import { mulDiv } from '../core/math.js';
import { requireService } from '../commands/common.js';
import { carOf } from './transport.js';

export const LOANS_MODULE_ID = 'loans';

/** Fixed-point scale for the rate arithmetic: 1.0 = 1e9, which keeps a cent exact over 104 weeks. */
const SCALE = 1_000_000_000;

interface Loan {
  principal: number;
  /** Outstanding balance in whole dollars. */
  balance: number;
  weeklyPayment: number;
  aprBp: number;
  termWeeks: number;
  missed: number;
  collateral: 'car' | null;
  takenWeek: number;
  defaulted: boolean;
}

interface LoansSlice {
  loans: Loan[];
  /** Outstanding default debt. Kept under its original save-field name for compatibility. */
  garnished: number;
}

const loanSchema = z
  .object({
    principal: z.number().int().positive(),
    balance: z.number().int().nonnegative(),
    weeklyPayment: z.number().int().positive(),
    aprBp: z.number().int().nonnegative(),
    termWeeks: z.number().int().positive(),
    missed: z.number().int().nonnegative(),
    collateral: z.enum(['car']).nullable(),
    takenWeek: z.number().int().positive(),
    defaulted: z.boolean(),
  })
  .strict();

const sliceSchema = z
  .object({ loans: z.array(loanSchema), garnished: z.number().int().nonnegative() })
  .strict();

function sliceOf(p: PlayerState): LoansSlice | undefined {
  return p.modules[LOANS_MODULE_ID] as LoansSlice | undefined;
}

export function loansOf(p: PlayerState): Loan[] {
  return sliceOf(p)?.loans ?? [];
}

function activeOwed(p: PlayerState): number {
  return loansOf(p).reduce((sum, l) => sum + l.balance, 0);
}

export function totalOwed(p: PlayerState): number {
  const slice = sliceOf(p);
  return activeOwed(p) + (slice?.garnished ?? 0);
}

/** APR in basis points for this seat right now (GDD 4.12). */
export function aprBpFor(ctx: Ctx, seat: number): number {
  const spec = ctx.pack.loans;
  if (!spec) return 0;
  const econAdjust = mulDiv(spec.aprPerEconBp, ctx.state.econ.index - 1000, 1000);
  const lowDep = ctx.playerAt(seat).dependability < spec.lowDepThreshold ? spec.aprLowDepBp : 0;
  return Math.max(0, spec.aprBaseBp + econAdjust + lowDep);
}

/** `P·r/(1−(1+r)^−n)`, rounded up to the whole dollar the ledger uses. */
export function weeklyPayment(principal: number, aprBp: number, termWeeks: number): number {
  if (termWeeks <= 0) return principal;
  // Weekly rate in fixed point; APR is nominal, divided across 52 weeks.
  const rate = Math.round((aprBp * SCALE) / (10_000 * 52));
  if (rate === 0) return Math.ceil(principal / termWeeks);
  let compound = SCALE; // (1 + r)^n
  for (let i = 0; i < termWeeks; i++) compound = compound + Math.round((compound * rate) / SCALE);
  // payment = P·r·(1+r)^n / ((1+r)^n − 1)
  const numerator = Math.round((principal * rate * 100) / SCALE) * compound;
  const denominator = compound - SCALE;
  return Math.max(1, Math.ceil(numerator / denominator / 100));
}

/** One week's simple interest, rounded to the nearest whole dollar with halves rounded up. */
export function weeklyInterest(balance: number, aprBp: number): number {
  return mulDiv(balance, aprBp, 10_000 * 52);
}

/** What a seat is reckoned to earn a week: the job plus whatever modules add (a gig). */
export function weeklyIncomeEstimate(ctx: Ctx, seat: number): number {
  const p = ctx.playerAt(seat);
  const job = p.job ? ctx.pack.jobById[p.job.jobId] : undefined;
  const fromJob = job ? p.job!.wage * ctx.rules.jobs.payPerSession * 6 : 0;
  let extra = 0;
  // Whatever other modules report (a gig shift): `apply.ts` puts the engine on the ctx.
  const engine = ctx.engine as Engine | null;
  for (const h of engine?.hooks.contributeIncome ?? []) extra += h.fn(ctx, seat);
  return fromJob + extra;
}

export interface TakeLoanCommand extends BaseCommand {
  type: 'TakeLoan';
  principal: number;
  termWeeks: number;
  collateral?: 'car' | undefined;
}
export interface RepayLoanCommand extends BaseCommand {
  type: 'RepayLoan';
  amount: number;
}

const takeLoanHandler: CommandHandler<TakeLoanCommand> = {
  type: 'TakeLoan',
  schema: z
    .object({
      type: z.literal('TakeLoan'),
      principal: z.number().int().positive(),
      termWeeks: z.number().int().positive(),
      collateral: z.literal('car').optional(),
    })
    .strict(),
  cost: () => ({ hours: 0, money: 0 }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'loans');
    if (svc) return svc;
    const spec = ctx.pack.loans;
    const slice = sliceOf(ctx.player);
    if (!spec || !slice) return 'ERR_FEATURE_OFF';
    if (cmd.principal < spec.min || cmd.principal > spec.max) return 'ERR_INVALID_AMOUNT';
    if (!spec.terms.includes(cmd.termWeeks)) return 'ERR_INVALID_AMOUNT';
    if (slice.loans.length >= spec.maxActive) return 'ERR_LOAN_LIMIT';
    if (cmd.collateral === 'car' && !carOf(ctx.player)) return 'ERR_NO_CAR';
    const capacity = mulDiv(
      weeklyIncomeEstimate(ctx, ctx.seat) * spec.approvalIncomeWeeks,
      spec.approvalIncomeBp,
      10_000,
    );
    if (cmd.collateral !== 'car' && capacity < cmd.principal) return 'ERR_LOAN_DENIED';
    return null;
  },
  apply: (ctx, cmd) => {
    const slice = sliceOf(ctx.player)!;
    const aprBp = aprBpFor(ctx, ctx.seat);
    slice.loans.push({
      principal: cmd.principal,
      balance: cmd.principal,
      weeklyPayment: weeklyPayment(cmd.principal, aprBp, cmd.termWeeks),
      aprBp,
      termWeeks: cmd.termWeeks,
      missed: 0,
      collateral: cmd.collateral ?? null,
      takenWeek: ctx.week,
      defaulted: false,
    });
    ctx.addMoney(ctx.seat, 'cash', cmd.principal, 'loan');
    ctx.emit({ type: 'LoanTaken', seat: ctx.seat });
  },
  preview: (ctx, cmd) => ({
    money: cmd.principal,
    notes: [
      `apr:${aprBpFor(ctx, ctx.seat)}`,
      `weekly:${weeklyPayment(cmd.principal, aprBpFor(ctx, ctx.seat), cmd.termWeeks)}`,
    ],
  }),
  candidates: (ctx) => {
    const spec = ctx.pack.loans;
    if (!spec) return [];
    const out: TakeLoanCommand[] = [];
    // A short ladder of round principals, so the AI and the UI have something to pick from.
    const steps = [spec.min, Math.round((spec.min + spec.max) / 2), spec.max];
    for (const principal of steps)
      for (const termWeeks of spec.terms) out.push({ type: 'TakeLoan', principal, termWeeks });
    return out;
  },
  zeroTime: true,
  ai: { category: 'finance' },
};

const repayLoanHandler: CommandHandler<RepayLoanCommand> = {
  type: 'RepayLoan',
  schema: z.object({ type: z.literal('RepayLoan'), amount: z.number().int().positive() }).strict(),
  cost: (ctx, cmd) => ({ hours: 0, money: Math.min(cmd.amount, totalOwed(ctx.player)) }),
  validate: (ctx, cmd) => {
    const svc = requireService(ctx, 'loans');
    if (svc) return svc;
    const slice = sliceOf(ctx.player);
    if (!slice || totalOwed(ctx.player) === 0) return 'ERR_NO_LOAN';
    if (ctx.player.cash < Math.min(cmd.amount, totalOwed(ctx.player))) return 'ERR_NOT_ENOUGH_CASH';
    return null;
  },
  apply: (ctx, cmd) => {
    const slice = sliceOf(ctx.player)!;
    let left = Math.min(cmd.amount, totalOwed(ctx.player));
    const paid = left;
    ctx.addMoney(ctx.seat, 'cash', -paid, 'loan-repay');

    // Clear default debt first: it is the balance that otherwise garnishes every pay cheque.
    const defaultPaid = Math.min(slice.garnished, left);
    slice.garnished -= defaultPaid;
    left -= defaultPaid;
    for (const loan of slice.loans) {
      if (left <= 0) break;
      const principalPaid = Math.min(loan.balance, left);
      loan.balance -= principalPaid;
      left -= principalPaid;
    }
    slice.loans = slice.loans.filter((l) => l.balance > 0);
    if (totalOwed(ctx.player) === 0) ctx.emit({ type: 'LoanPaid', seat: ctx.seat });
  },
  candidates: (ctx) => {
    const owed = totalOwed(ctx.player);
    if (owed <= 0) return [];
    const out: RepayLoanCommand[] = [{ type: 'RepayLoan', amount: owed }];
    const weekly = loansOf(ctx.player)[0]?.weeklyPayment ?? 0;
    if (weekly > 0 && weekly < owed) out.push({ type: 'RepayLoan', amount: weekly });
    return out;
  },
  zeroTime: true,
  ai: { category: 'finance' },
};

/** Debits every loan at the start of the turn, and handles the ones that go unpaid. */
function collect(ctx: Ctx): void {
  const spec = ctx.pack.loans;
  const slice = sliceOf(ctx.player);
  if (!spec || !slice) return;
  for (const loan of slice.loans) {
    const balanceWithInterest = loan.balance + weeklyInterest(loan.balance, loan.aprBp);
    const finalInstalment = ctx.week - loan.takenWeek >= loan.termWeeks;
    const due = finalInstalment
      ? balanceWithInterest
      : Math.min(loan.weeklyPayment, balanceWithInterest);
    const shortfall = ctx.takeMoneyCascade(ctx.seat, due, 'loan-payment');
    const paid = due - shortfall;
    loan.balance = balanceWithInterest - paid;
    if (shortfall > 0) {
      // A partial payment reduces the debt first; one fee is then added for the shortfall.
      loan.balance += spec.missedFee;
      loan.missed += 1;
      ctx.emit({ type: 'LoanMissed', seat: ctx.seat });
      if (loan.missed >= spec.defaultAfter && !loan.defaulted) {
        loan.defaulted = true;
        if (loan.collateral === 'car') {
          const transport = ctx.player.modules.transport as { car: unknown } | undefined;
          if (transport) transport.car = null;
        }
        slice.garnished += loan.balance;
        loan.balance = 0;
        ctx.emit({ type: 'LoanDefaulted', seat: ctx.seat });
      }
      continue;
    }
    if (loan.balance === 0) ctx.emit({ type: 'LoanPaid', seat: ctx.seat });
  }
  slice.loans = slice.loans.filter((l) => l.balance > 0 && !l.defaulted);
}

/** Default debt takes the pack-defined share of earned pay until it is gone. */
function garnishDefaultDebt(ctx: Ctx, seat: number, pay: number): void {
  const spec = ctx.pack.loans;
  const slice = sliceOf(ctx.playerAt(seat));
  if (!spec || !slice || slice.garnished === 0 || pay <= 0) return;
  const amount = Math.min(slice.garnished, mulDiv(pay, spec.garnishBp, 10_000));
  if (amount === 0) return;
  slice.garnished -= amount;
  ctx.addMoney(seat, 'cash', -amount, 'loan-garnish');
  if (slice.garnished === 0) ctx.emit({ type: 'LoanPaid', seat });
}

export const loans: RuleModule = {
  id: LOANS_MODULE_ID,
  flag: 'loans',
  order: 170,
  commands: [takeLoanHandler, repayLoanHandler],
  stateSlice: {
    key: LOANS_MODULE_ID,
    schema: sliceSchema,
    version: 1,
    initialPlayer: () => ({ loans: [], garnished: 0 }),
  },
  hooks: {
    onTurnStart(ctx) {
      if (ctx.week > 1) collect(ctx);
    },
    contributeWealth(ctx, seat) {
      // Debt is negative wealth, so a loan cannot inflate the wealth goal (GDD 4.4).
      return -totalOwed(ctx.playerAt(seat));
    },
    onDomainEvent(ctx, event) {
      if (event.type === 'Worked' || event.type === 'GigWorked')
        garnishDefaultDebt(ctx, event.seat, event.pay);
    },
  },
};
