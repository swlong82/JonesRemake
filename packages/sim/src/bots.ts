/**
 * Strategy bots for exploit detection (BALANCE_SPEC 9.4). Each bot is the Normal planner with a
 * command filter (and optional forced personality) so it plays a deliberately narrow strategy.
 * Classic-applicable: StudyFirst, NoRelax. Modern: GigOnly, CryptoAllIn, DeliveryOnly, LoanMax —
 * each one exists to find the exploit in a single modern system by playing only that system.
 */
import type { CityPack } from '@hustle-ring/content';
import type { Command, GameState } from '@hustle-ring/engine';
import type { PlanOptions } from '@hustle-ring/ai';

export interface Bot {
  id: string;
  personality: string;
  /** Return false to forbid a command for this bot. */
  allow(cmd: Command, state: GameState, seat: number, pack: CityPack): boolean;
}

const bots = new Map<string, Bot>();

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
  };
}

/** All degrees before any regular work (9.4 StudyFirst). */
registerBot({
  id: 'StudyFirst',
  personality: 'scholar',
  allow: (cmd, state, seat, pack) => {
    const p = state.players[seat]!;
    const done = p.degrees.length >= pack.degrees.length;
    if (done) return true;
    return cmd.type !== 'Work' && cmd.type !== 'ApplyJob' && cmd.type !== 'AskRaise';
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
    const wildest = [...pack.assets].sort(
      (a, b) => b.volBp - a.volBp || b.maxMoveBp - a.maxMoveBp,
    )[0];
    return cmd.assetId === wildest?.id;
  },
});

/** Never cooks and never walks to a counter: everything arrives (9.4 DeliveryOnly). */
registerBot({
  id: 'DeliveryOnly',
  personality: 'balanced',
  allow: (cmd) => cmd.type !== 'EatMeal' && cmd.type !== 'BuyFood',
});

/** Borrows the most it can, as often as it can, and never repays early (9.4 LoanMax). */
registerBot({
  id: 'LoanMax',
  personality: 'hustler',
  allow: (cmd, _state, _seat, pack) => {
    if (cmd.type === 'RepayLoan') return false;
    if (cmd.type !== 'TakeLoan') return true;
    return cmd.principal === (pack.loans?.max ?? cmd.principal);
  },
});
