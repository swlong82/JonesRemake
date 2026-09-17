/** Shared validation helpers for command handlers. */
import type { ErrorCode } from '@hustle-ring/shared';
import type { Ctx } from '../core/ctx.js';

/** Player must be inside a location offering `service`. */
export function requireService(ctx: Ctx, service: string): ErrorCode | null {
  const p = ctx.player;
  const loc = ctx.pack.locationById[p.location];
  if (!loc?.services.includes(service)) return 'ERR_NOT_AT_LOCATION';
  if (!p.inside) return 'ERR_NOT_INSIDE';
  return null;
}

/** Player must be inside the given location id. */
export function requireInside(ctx: Ctx, locationId: string): ErrorCode | null {
  const p = ctx.player;
  if (p.location !== locationId) return 'ERR_NOT_AT_LOCATION';
  if (!p.inside) return 'ERR_NOT_INSIDE';
  return null;
}

export function requireCash(ctx: Ctx, amount: number): ErrorCode | null {
  return ctx.player.cash >= amount ? null : 'ERR_NOT_ENOUGH_CASH';
}

export function requireHours(ctx: Ctx, halfHours: number): ErrorCode | null {
  return ctx.player.hoursLeft >= halfHours ? null : 'ERR_NOT_ENOUGH_HOURS';
}

/** Location open rule (STATE_MODEL 13.5). */
export function isOpen(ctx: Ctx, locationId: string): boolean {
  const loc = ctx.pack.locationById[locationId];
  if (!loc) return false;
  if (loc.open === 'always') return true;
  const p = ctx.player;
  if (loc.open === 'rent-week') {
    if (ctx.week % ctx.rules.housing.rentWeeks === 0) return true;
    if (p.job && ctx.pack.jobById[p.job.jobId]?.workplaceId === locationId) return true;
    if (p.home.extensionUntilWeek !== null) return true;
    if (p.home.debt > 0) return true;
    return false;
  }
  return loc.open.weeks.includes(ctx.week);
}

/** Item resale value (SEED_DATA 14.2): price × max(20%, 100% − 2% × weeksOwned). */
export function itemValue(ctx: Ctx, itemId: string, boughtWeek: number): number {
  const spec = ctx.pack.itemById[itemId];
  if (!spec) return 0;
  const weeks = Math.max(0, ctx.week - boughtWeek);
  const pct = Math.max(
    ctx.rules.items.resaleMinBp,
    10_000 - ctx.rules.items.resaleDecayPerWeekBp * weeks,
  );
  return Math.floor((ctx.econ(spec.price) * pct) / 10_000);
}
