/**
 * Ctx — the mutable working context handed to rule modules and command handlers
 * (EXTENSIBILITY 12.1/12.2). `state` is a private clone owned by the current applyCommand call;
 * handlers mutate it directly and emit DomainEvents through `emit`.
 */
import type { CityPack, Rules } from '@hustle-ring/content';
import type { DomainEvent, DomainEventBody, MoneyAccount, StatId } from '@hustle-ring/shared';
import { cloneJson } from './clone.js';
import { clamp } from './math.js';
import { Rng } from './rng.js';
import type { GameState, PlayerState } from './state.js';

export class Ctx {
  /** Engine that created this context (set by applyCommand); EndTurn dispatches through it. */
  engine: unknown = null;
  readonly rng: Rng;
  readonly events: DomainEvent[] = [];
  readonly rules: Rules;
  /** Domain-event listeners installed by the module pipeline (onDomainEvent hooks). */
  private listeners: ((ctx: Ctx, e: DomainEvent) => void)[] = [];

  /** Seats whose PlayerState has been privately cloned (copy-on-write, see cloneState). */
  private readonly owned = new Set<number>();

  constructor(
    readonly state: GameState,
    readonly pack: CityPack,
    /** Seat whose turn / action this context serves. */
    public seat: number,
    /**
     * Copy-on-write mode: `state.players[i]` objects are still shared with the caller's state and
     * are deep-cloned on first access through `playerAt`. Read-only contexts (validate, legal,
     * preview) pass false. Rule: never mutate `state.players[i]` directly — go through playerAt.
     */
    private readonly cow = false,
  ) {
    this.rng = new Rng(state.rng, state.config.seed);
    this.rules = pack.rules;
  }

  get player(): PlayerState {
    return this.playerAt(this.seat);
  }

  playerAt(seat: number): PlayerState {
    const p = this.state.players[seat];
    if (!p) throw new Error(`no player at seat ${seat}`);
    if (this.cow && !this.owned.has(seat)) {
      const copy = cloneJson(p);
      this.state.players[seat] = copy;
      this.owned.add(seat);
      return copy;
    }
    return p;
  }

  get week(): number {
    return this.state.week;
  }

  get flags(): CityPack['flags'] {
    return this.pack.flags;
  }

  setListeners(listeners: ((ctx: Ctx, e: DomainEvent) => void)[]): void {
    this.listeners = listeners;
  }

  emit(body: DomainEventBody): void {
    const e: DomainEvent = { ...body, seq: this.state.seq++, week: this.state.week };
    this.events.push(e);
    for (const l of this.listeners) l(this, e);
  }

  /** Deterministic unique id for items / pawn entries. */
  uid(): string {
    return `u${(this.state.uidCounter++).toString(36)}`;
  }

  /** Scale a base dollar amount by the economy index (per-mille). */
  econ(amount: number): number {
    return Math.floor((amount * this.state.econ.index + 500) / 1000);
  }

  // ---- money -------------------------------------------------------------------------------
  addMoney(seat: number, account: MoneyAccount, delta: number, reason: string): void {
    if (delta === 0) return;
    const p = this.playerAt(seat);
    p[account] += delta;
    this.emit({ type: 'MoneyChanged', seat, account, delta, reason });
  }

  /** Take `amount` from cash first, then bank. Returns the shortfall (≥ 0) not covered. */
  takeMoneyCascade(seat: number, amount: number, reason: string): number {
    const p = this.playerAt(seat);
    let remaining = amount;
    const fromCash = Math.min(p.cash, remaining);
    if (fromCash > 0) {
      this.addMoney(seat, 'cash', -fromCash, reason);
      remaining -= fromCash;
    }
    const fromBank = Math.min(p.bank, remaining);
    if (fromBank > 0) {
      this.addMoney(seat, 'bank', -fromBank, reason);
      remaining -= fromBank;
    }
    return remaining;
  }

  // ---- stats -------------------------------------------------------------------------------
  addStat(seat: number, stat: StatId, delta: number, reason: string): void {
    if (delta === 0) return;
    const p = this.playerAt(seat);
    const r = this.rules;
    let before: number;
    let after: number;
    switch (stat) {
      case 'happiness':
        before = p.happiness;
        after = clamp(before + delta, r.happiness.min, r.happiness.max);
        p.happiness = after;
        break;
      case 'dependability':
        before = p.dependability;
        after = clamp(
          before + delta,
          r.stats.statMin,
          delta > 0 ? Math.max(p.maxDependability, before) : r.stats.statMax,
        );
        p.dependability = after;
        break;
      case 'experience':
        before = p.experience;
        after = clamp(
          before + delta,
          r.stats.statMin,
          delta > 0 ? Math.max(p.maxExperience, before) : r.stats.statMax,
        );
        p.experience = after;
        break;
      case 'relaxation':
        before = p.relaxation;
        after = clamp(before + delta, r.stats.relaxationMin, r.stats.relaxationMax);
        p.relaxation = after;
        break;
      case 'wellbeing': {
        // Wellbeing lives in the wellbeing module slice; core forwards via the slice helper.
        const slice = p.modules.wellbeing as { value: number } | undefined;
        if (!slice) return;
        before = slice.value;
        after = clamp(before + delta, 0, 100);
        slice.value = after;
        break;
      }
    }
    if (after !== before)
      this.emit({ type: 'StatChanged', seat, stat, delta: after - before, reason });
  }

  /** Dependability may exceed max via degree bonus (ORIGINAL_REFERENCE 3.3); this raw add is for that path. */
  addDependabilityRaw(seat: number, delta: number, reason: string): void {
    const p = this.playerAt(seat);
    const before = p.dependability;
    p.dependability = clamp(before + delta, this.rules.stats.statMin, this.rules.stats.statMax);
    if (p.dependability !== before)
      this.emit({
        type: 'StatChanged',
        seat,
        stat: 'dependability',
        delta: p.dependability - before,
        reason,
      });
  }

  // ---- hours -------------------------------------------------------------------------------
  spendHours(seat: number, halfHours: number, reason: string): void {
    if (halfHours <= 0) return;
    const p = this.playerAt(seat);
    const spent = Math.min(p.hoursLeft, halfHours);
    p.hoursLeft -= spent;
    if (spent > 0) this.emit({ type: 'HoursSpent', seat, hours: spent, reason });
  }

  // ---- lookups -------------------------------------------------------------------------------
  hasItem(seat: number, itemId: string, requireOk = true): boolean {
    return this.playerAt(seat).items.some(
      (i) => i.itemId === itemId && (!requireOk || i.condition === 'ok'),
    );
  }

  hasUnlock(seat: number, unlock: string): boolean {
    const p = this.playerAt(seat);
    for (const owned of p.items) {
      if (owned.condition !== 'ok') continue;
      const spec = this.pack.itemById[owned.itemId];
      if (spec?.unlocks.includes(unlock as (typeof spec.unlocks)[number])) return true;
    }
    return false;
  }

  /** Number of working durables owned (burglary, eviction, relax bonus). */
  durables(seat: number): number {
    let n = 0;
    for (const owned of this.playerAt(seat).items) {
      const spec = this.pack.itemById[owned.itemId];
      if (spec?.durable) n++;
    }
    return n;
  }

  comfortCount(seat: number): number {
    let n = 0;
    for (const owned of this.playerAt(seat).items) {
      if (owned.condition !== 'ok') continue;
      const spec = this.pack.itemById[owned.itemId];
      if (spec?.comfort) n++;
    }
    return n;
  }

  /** Best uniform tier rank currently worn (ordered by UNIFORM_TIERS). */
  uniformRank(seat: number): number {
    let best = 0;
    for (const c of this.playerAt(seat).clothing) {
      if (c.weeksLeft > 0) best = Math.max(best, this.pack.uniformRank[c.tier]);
    }
    return best;
  }

  isHome(seat: number): boolean {
    const p = this.playerAt(seat);
    return p.inside && p.location === this.pack.homeLocation[p.home.tier];
  }
}
