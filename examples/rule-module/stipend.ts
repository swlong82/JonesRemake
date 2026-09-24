/**
 * Recipe: add a rule module. A city stipend pays every seat at the start of its turn. Modules hook
 * the turn pipeline (`onTurnStart`, `onWeekStart`, `contributeWealth`, …) in `order`; packs and
 * extensions use 200+ so core (0–99) and modern (100–199) run first. Gate a module behind a
 * CityPack feature flag with `flag` so packs without it are untouched.
 */
import type { RuleModule } from '@hustle-ring/engine';

/** Numbers come from the caller here; a shipped module reads them from `ctx.rules`. */
export function stipendModule(weekly: number): RuleModule {
  return {
    id: 'example-stipend',
    order: 210,
    hooks: {
      onTurnStart: (ctx) => {
        ctx.addMoney(ctx.seat, 'cash', weekly, 'stipend');
      },
    },
  };
}
