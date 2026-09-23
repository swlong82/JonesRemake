/**
 * Strategy bots for exploit detection (BALANCE_SPEC 9.4). Each bot is the Normal planner with a
 * command filter (and optional forced personality) so it plays a deliberately narrow strategy.
 * Classic-applicable: StudyFirst, NoRelax. Modern: GigOnly, CryptoAllIn, DeliveryOnly, LoanMax —
 * each one exists to find the exploit in a single modern system by playing only that system.
 */
import type { CityPack } from '@hustle-ring/content';
import { educationGoal, type Command, type GameState } from '@hustle-ring/engine';
import type { PlanOptions } from '@hustle-ring/ai';

export interface Bot {
  id: string;
  personality: string;
  /** Return false to forbid a command for this bot. */
  allow(cmd: Command, state: GameState, seat: number, pack: CityPack): boolean;
  /** Optional preference for commands the strategy must actually play (ADR-0044). */
  prefer?(cmd: Command, state: GameState, seat: number, pack: CityPack): number;
}

const bots = new Map<string, Bot>();

/** The instrument LoanMax invests in (9.4). */
export const LOANMAX_ETF = 'index-etf';

export function registerBot(bot: Bot): void {
  bots.set(bot.id, bot);
}

export function getBot(id: string): Bot {
  const b = bots.get(id);
  if (!b) throw new Error(`unknown bot "${id}" (known: ${[...bots.keys()].join(', ')})`);
  return b;
}

export function botIds(): string[] {
  return [...bots.keys()].sort();
}

export function botPlanOptions(bot: Bot, pack: CityPack): PlanOptions {
  return {
    difficulty: 'normal',
    personality: bot.personality,
    forbid: (cmd, state, seat) => !bot.allow(cmd, state, seat, pack),
    ...(bot.prefer
      ? {
          bias: (cmd: Command, state: GameState, seat: number) =>
            bot.prefer!(cmd, state, seat, pack),
        }
      : {}),
  };
}

/**
 * All the degrees its education goal needs before any regular work (9.4 StudyFirst, ADR-0041):
 * "all degrees" read as every pack degree would spend 100+ weeks on degrees no goal asks for.
 */
registerBot({
  id: 'StudyFirst',
  personality: 'scholar',
  allow: (cmd, state, seat, pack) => {
    const p = state.players[seat]!;
    const done = educationGoal(p, pack) >= p.goals.education;
    if (done) return true;
    return cmd.type !== 'Work' && cmd.type !== 'ApplyJob' && cmd.type !== 'AskRaise';
  },
  // With regular work off the table, a student loan is how the study gets paid for (ADR-0044).
  prefer: (cmd, state, seat, pack) => {
    const p = state.players[seat]!;
    const student = pack.loans?.studentMax ?? 0;
    if (student === 0 || educationGoal(p, pack) >= p.goals.education || p.cash + p.bank >= 300)
      return 0;
    if (cmd.type === 'TakeLoan') return cmd.principal === student ? 1 : 0;
    if (cmd.type === 'Move') return pack.locationById[cmd.to]?.services.includes('loans') ? 0.8 : 0;
    return 0;
  },
});

/** Never relaxes (9.4 NoRelax). */
registerBot({
  id: 'NoRelax',
  personality: 'grinder',
  allow: (cmd) => cmd.type !== 'Relax',
});

/** Gig work only: never takes a regular job (9.4 GigOnly). */
registerBot({
  id: 'GigOnly',
  personality: 'hustler',
  allow: (cmd) => cmd.type !== 'ApplyJob' && cmd.type !== 'AskRaise' && cmd.type !== 'Work',
});

/** Every spare dollar into the most volatile instrument the pack has (9.4 CryptoAllIn). */
registerBot({
  id: 'CryptoAllIn',
  personality: 'hustler',
  allow: (cmd, _state, _seat, pack) => {
    if (cmd.type !== 'BuyAsset') return cmd.type !== 'SellAsset';
    return cmd.assetId === wildest(pack)?.id;
  },
  // "Every spare dollar": allowed alone, the planner rarely chose crypto and the bot played as an
  // ordinary seat, so the strategy is stated as a preference for the big buys (ADR-0044).
  prefer: (cmd, state, seat, pack) => {
    if (cmd.type !== 'BuyAsset' || cmd.assetId !== wildest(pack)?.id) return 0;
    const p = state.players[seat];
    // Spare means past the rent: the bot gambles its savings, not its roof.
    const spare = p ? p.cash - p.home.rentLocked : 0;
    if (process.env.CRYPTO_MODE === 'all')
      return cmd.amount * 2 >= (p?.cash ?? 0) ? CRYPTO_PREFERENCE : 0;
    return cmd.amount * 2 >= spare && cmd.amount <= spare ? CRYPTO_PREFERENCE : 0;
  },
});

/** How strongly CryptoAllIn prefers its big buys (ADR-0044). */
const CRYPTO_PREFERENCE = Number(process.env.CRYPTO_PREF ?? 0.25);

/** The pack's most volatile instrument. */
function wildest(pack: CityPack): CityPack['assets'][number] | undefined {
  return [...pack.assets].sort((a, b) => b.volBp - a.volBp || b.maxMoveBp - a.maxMoveBp)[0];
}

/** Never cooks and never walks to a counter: everything arrives (9.4 DeliveryOnly). */
registerBot({
  id: 'DeliveryOnly',
  personality: 'balanced',
  allow: (cmd) => cmd.type !== 'EatMeal' && cmd.type !== 'BuyFood',
});

/**
 * Borrows the most it can, as often as it can, never repays early, and puts its spare cash in the
 * index ETF and leaves it there (9.4 LoanMax: "max loan, invest in ETF", ADR-0041).
 */
registerBot({
  id: 'LoanMax',
  personality: 'hustler',
  allow: (cmd, _state, _seat, pack) => {
    if (cmd.type === 'RepayLoan' || cmd.type === 'SellAsset') return false;
    if (cmd.type === 'BuyAsset') return cmd.assetId === LOANMAX_ETF;
    if (cmd.type !== 'TakeLoan') return true;
    return cmd.principal === (pack.loans?.max ?? cmd.principal);
  },
  // Forbidding everything else is not enough: the loan-burden scorer makes an ordinary seat decline
  // a loan it does not need, so LoanMax states its strategy as a preference (ADR-0044).
  prefer: (cmd, _state, _seat, pack) => {
    // The most it can borrow, on the longest term the bank offers (the smallest weekly payment).
    if (
      cmd.type === 'TakeLoan' &&
      cmd.principal === (pack.loans?.max ?? cmd.principal) &&
      cmd.termWeeks === Math.max(...(pack.loans?.terms ?? [cmd.termWeeks]))
    )
      return 1;
    if (cmd.type === 'BuyAsset' && cmd.assetId === LOANMAX_ETF) return 0.15;
    return 0;
  },
});
