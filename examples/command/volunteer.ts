/**
 * Recipe: add a command. `Volunteer` spends four hours at the Community Clinic for happiness.
 * A command lives in a rule module's `commands`; `registerModules` adds the module to every engine
 * built afterwards. Numbers belong in CityPack content — a real module reads them from `ctx.rules`
 * (add the field to `packages/content/src/schemas/rules.ts`); the example keeps them local.
 */
import type { BaseCommand, CommandHandler, RuleModule } from '@hustle-ring/engine';
import { requireHours, requireInside } from '@hustle-ring/engine';
import { z } from 'zod';

export interface VolunteerCommand extends BaseCommand {
  type: 'Volunteer';
}

const HALF_HOURS = 8; // 4 hours
const HAPPINESS = 3;

export const volunteerHandler: CommandHandler<VolunteerCommand> = {
  type: 'Volunteer',
  schema: z.object({ type: z.literal('Volunteer') }).strict(),
  cost: () => ({ hours: -HALF_HOURS, money: 0 }),
  validate: (ctx) => requireInside(ctx, 'clinic') ?? requireHours(ctx, HALF_HOURS),
  apply: (ctx) => {
    ctx.spendHours(ctx.seat, HALF_HOURS, 'volunteer');
    ctx.addStat(ctx.seat, 'happiness', HAPPINESS, 'volunteer');
  },
  preview: () => ({ deltas: { happiness: HAPPINESS } }),
  candidates: () => [{ type: 'Volunteer' }],
  ai: { category: 'home' },
};

export const volunteerModule: RuleModule = {
  id: 'example-volunteer',
  order: 200, // packs and extensions use 200+
  commands: [volunteerHandler],
};
