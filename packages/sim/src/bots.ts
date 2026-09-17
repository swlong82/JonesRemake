/**
 * Strategy bots for exploit detection (BALANCE_SPEC 9.4). Each bot is the Normal planner with a
 * command filter (and optional forced personality) so it plays a deliberately narrow strategy.
 * Classic-applicable: StudyFirst, NoRelax. Modern bots (GigOnly, CryptoAllIn, DeliveryOnly,
 * LoanMax) are registered by M5.9 through the same table.
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
