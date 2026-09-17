/**
 * Effect DSL interpreter (CONTENT_SCHEMAS 6.2) and the read-only JSON-logic view used by event
 * conditions and weight expressions. All ranges resolve on the seat's `events` RNG stream.
 */
import { evalLogic, truthy, type EffectSpec, type RangeSpec } from '@hustle-ring/content';
import type { ErrorCode } from '@hustle-ring/shared';
import type { Ctx } from './ctx.js';
import { clamp, mulDiv } from './math.js';
import { STREAMS } from './rng.js';
import type { OwnedItem } from './state.js';

export function resolveRange(ctx: Ctx, seat: number, r: number | RangeSpec): number {
  if (typeof r === 'number') return r;
  return ctx.rng.range(STREAMS.events(seat), Math.round(r.min), Math.round(r.max));
}

/** Whitelisted view for conditions: player.*, econ.phase, week, location (6.2). */
export function logicView(ctx: Ctx, seat: number): Record<string, unknown> {
  const p = ctx.playerAt(seat);
  const job = p.job ? ctx.pack.jobById[p.job.jobId] : undefined;
  // The subscriptions module keeps its active set keyed by id (M5.6); core only needs the ids.
  const subs = Object.keys(
    (p.modules.subscriptions as { active?: Record<string, unknown> } | undefined)?.active ?? {},
  );
  return {
    player: {
      cash: p.cash,
      bank: p.bank,
      happiness: p.happiness,
      dependability: p.dependability,
      experience: p.experience,
      relaxation: p.relaxation,
      degreeCount: p.degrees.length,
      degrees: p.degrees,
      itemIds: p.items.filter((i) => i.condition === 'ok').map((i) => i.itemId),
      brokenItemIds: p.items.filter((i) => i.condition === 'broken').map((i) => i.itemId),
      employed: p.job !== null,
      jobId: p.job?.jobId ?? null,
      isGig: job?.isGig ?? false,
      automationRiskBp: job?.automationRiskBp ?? 0,
      homeTier: p.home.tier,
      rentDebt: p.home.debt,
      hasCar: (p.modules.transport as { car?: unknown } | undefined)?.car != null,
      subscriptionIds: subs,
      wellbeing: (p.modules.wellbeing as { value?: number } | undefined)?.value ?? null,
      lotteryTickets: p.lotteryTickets,
      unlocks: unlockList(ctx, seat),
    },
    econ: { phase: ctx.state.econ.phase, index: ctx.state.econ.index },
    week: ctx.state.week,
    location: p.location,
    inside: p.inside,
    chaos: ctx.state.config.chaos,
  };
}

function unlockList(ctx: Ctx, seat: number): string[] {
  const out = new Set<string>();
  for (const owned of ctx.playerAt(seat).items) {
    if (owned.condition !== 'ok') continue;
    for (const u of ctx.pack.itemById[owned.itemId]?.unlocks ?? []) out.add(u);
  }
  return [...out];
}

export function conditionHolds(ctx: Ctx, seat: number, cond: unknown): boolean {
  if (cond === undefined) return true;
  return truthy(evalLogic(cond, logicView(ctx, seat)));
}

export function evalWeight(ctx: Ctx, seat: number, weight: unknown): number {
  const v = typeof weight === 'number' ? weight : evalLogic(weight, logicView(ctx, seat));
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

export interface EffectOutcome {
  /** Short machine-readable descriptions for EventFired.effects and UI chips. */
  chips: string[];
}

function matchesFilter(
  ctx: Ctx,
  item: OwnedItem,
  f: Extract<EffectSpec, { op: 'loseItems' }>['filter'],
): boolean {
  const spec = ctx.pack.itemById[item.itemId];
  if (!spec) return false;
  if (f.itemId !== undefined && item.itemId !== f.itemId) return false;
  if (f.category !== undefined && spec.category !== f.category) return false;
  if (f.durable !== undefined && spec.durable !== f.durable) return false;
  return true;
}

/** Apply one effect to `seat`. Returns chips describing what happened. */
export function applyEffect(ctx: Ctx, seat: number, effect: EffectSpec, reason: string): string[] {
  const p = ctx.playerAt(seat);
  const chips: string[] = [];
  switch (effect.op) {
    case 'stat': {
      const delta = resolveRange(ctx, seat, effect.delta);
      if (effect.stat === 'wellbeing' && !ctx.flags.wellbeing) break;
      ctx.addStat(seat, effect.stat, delta, reason);
      chips.push(`stat:${effect.stat}:${delta}`);
      break;
    }
    case 'relaxation': {
      ctx.addStat(seat, 'relaxation', effect.delta, reason);
      chips.push(`stat:relaxation:${effect.delta}`);
      break;
    }
    case 'money': {
      let delta: number;
      if (typeof effect.delta === 'object' && 'pctOf' in effect.delta) {
        const base = p[effect.delta.pctOf];
        const pct = resolveRange(ctx, seat, effect.delta.pct);
        delta = -mulDiv(base, pct, 100);
      } else {
        delta = resolveRange(ctx, seat, effect.delta);
        if (effect.scaleEcon) delta = ctx.econ(delta);
      }
      if (delta >= 0) {
        ctx.addMoney(seat, effect.account, delta, reason);
      } else if (effect.cascade) {
        const shortfall = ctx.takeMoneyCascade(seat, -delta, reason);
        if (shortfall > 0) {
          p.home.debt += shortfall;
          p.home.everHadDebt = true;
          p.home.debtSinceWeek ??= ctx.week;
          ctx.emit({ type: 'RentDebt', seat });
          chips.push(`debt:${shortfall}`);
        }
      } else {
        const take = Math.min(p[effect.account], -delta);
        ctx.addMoney(seat, effect.account, -take, reason);
        delta = -take;
      }
      chips.push(`money:${effect.account}:${delta}`);
      break;
    }
    case 'hours': {
      const hh = Math.round(effect.delta * 2);
      if (hh < 0) {
        // Negative hour effects apply to the player's next turn (weekend) or now (turn start).
        if (
          ctx.state.activeSeat === seat &&
          p.hoursLeft > 0 &&
          ctx.state.phase === 'actions' &&
          !p.turn.lockedActions.includes('turn-start')
        ) {
          ctx.spendHours(seat, -hh, reason);
        } else {
          p.turn.penalties += -hh;
        }
      }
      chips.push(`hours:${effect.delta}`);
      break;
    }
    case 'loseJob': {
      if (!p.job) break;
      if (!ctx.rng.chance(STREAMS.events(seat), effect.chanceBp)) break;
      const sev = effect.severanceWeeks ?? 0;
      if (sev > 0) {
        const pay = p.job.wage * ctx.rules.jobs.payPerSession * sev;
        ctx.addMoney(seat, 'cash', pay, `${reason}:severance`);
        chips.push(`severance:${pay}`);
      }
      p.job = null;
      ctx.addStat(seat, 'happiness', ctx.rules.happiness.fired, reason);
      ctx.emit({ type: 'Fired', seat, reason });
      chips.push('fired');
      break;
    }
    case 'loseItems': {
      const eligible = p.items.filter((i) => matchesFilter(ctx, i, effect.filter));
      if (eligible.length === 0) break;
      let count: number;
      if (effect.count === 'all') count = eligible.length;
      else if (typeof effect.count === 'number') count = effect.count;
      else count = resolveRange(ctx, seat, effect.count);
      count = clamp(count, 0, eligible.length);
      const picked = ctx.rng.shuffle(STREAMS.events(seat), eligible).slice(0, count);
      const uids = picked.map((i) => i.uid);
      p.items = p.items.filter((i) => !uids.includes(i.uid));
      if (uids.length > 0) {
        ctx.emit({ type: 'ItemsStolen', seat, uids });
        chips.push(`items:-${uids.length}`);
      }
      break;
    }
    case 'disableItem': {
      const it = p.items.find((i) => i.itemId === effect.itemId && i.condition === 'ok');
      if (!it) break;
      it.condition = 'broken';
      ctx.emit({ type: 'ItemBroke', seat, uid: it.uid });
      chips.push(`broken:${effect.itemId}`);
      break;
    }
    case 'econ': {
      const pm = resolveRange(ctx, seat, effect.multiply);
      const e = ctx.state.econ;
      const before = e.index;
      e.index = clamp(mulDiv(e.index, pm, 1000), ctx.rules.econ.min, ctx.rules.econ.max);
      e.lastChangePm = mulDiv(e.index, 1000, before) - 1000;
      ctx.emit({ type: 'EconomyTicked', econ: e.index, phase: e.phase });
      chips.push(`econ:${pm}`);
      break;
    }
    case 'asset': {
      const pm = resolveRange(ctx, seat, effect.multiply);
      const prices = ctx.state.market.prices;
      const changed: Record<string, number> = {};
      for (const a of ctx.pack.assets) {
        if (!(a.id in prices)) continue;
        if (effect.assetId !== '*' && a.id !== effect.assetId) continue;
        if (effect.exceptImmune && a.crashImmune) continue;
        let np = mulDiv(prices[a.id]!, pm, 1000);
        if (a.model === 'bounded') np = clamp(np, a.minCents ?? np, a.maxCents ?? np);
        np = Math.max(1, np);
        prices[a.id] = np;
        changed[a.id] = np;
      }
      if (Object.keys(changed).length > 0) ctx.emit({ type: 'MarketMoved', prices: changed });
      chips.push(`asset:${effect.assetId}:${pm}`);
      break;
    }
    case 'grant': {
      if (effect.what === 'freeEnrollment') p.freeEnrollments += effect.qty;
      else {
        const meal = ctx.pack.meals.find((m) => m.countsAsMeal);
        if (meal) p.food.mealPending = meal.id;
      }
      chips.push(`grant:${effect.what}:${effect.qty}`);
      break;
    }
    case 'schedule': {
      if (ctx.rng.chance(STREAMS.events(seat), effect.chance)) {
        p.scheduled.push({ eventId: effect.eventId, week: ctx.week + effect.inWeeks });
        chips.push(`schedule:${effect.eventId}`);
      }
      break;
    }
    case 'food': {
      const before = p.food.fridgeUnits;
      p.food.fridgeUnits = Math.max(0, before + effect.delta);
      chips.push(`food:${p.food.fridgeUnits - before}`);
      break;
    }
  }
  return chips;
}

export function applyEffects(
  ctx: Ctx,
  seat: number,
  effects: readonly EffectSpec[],
  reason: string,
): string[] {
  const chips: string[] = [];
  for (const e of effects) chips.push(...applyEffect(ctx, seat, e, reason));
  return chips;
}

/** Guard used by handlers: hours-left check that returns the standard code. */
export function needHours(ctx: Ctx, seat: number, hh: number): ErrorCode | null {
  return ctx.playerAt(seat).hoursLeft >= hh ? null : 'ERR_NOT_ENOUGH_HOURS';
}
