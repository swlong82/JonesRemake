/**
 * RuleModule + CommandHandler contracts (EXTENSIBILITY 12.1, 12.2) and the resolved pipeline.
 * `createEngine(pack, modules)` resolves active modules by flag, sorts by `order`, builds hook lists
 * once, and exposes the command registry keyed by `cmd.type`.
 */
import type { CityPack, FeatureFlagId } from '@hustle-ring/content';
import type { DomainEvent, ErrorCode, ModuleId, ScorerId } from '@hustle-ring/shared';
import type { z } from 'zod';
import type { Ctx } from './ctx.js';
import type { GameState } from './state.js';

export interface ActionPreview {
  hours: number;
  money: number;
  /** Stat deltas expected (best estimate) keyed by stat/goal name. */
  deltas: Record<string, number>;
  /** Risk in basis points, if any (theft, scam, no-openings...). */
  riskBp?: number;
  riskKey?: string;
  /** i18n key describing the outcome (e.g. pay, lesson counted). */
  notes: string[];
}

export interface BaseCommand {
  type: string;
}

export interface CommandHandler<C extends BaseCommand = BaseCommand> {
  type: C['type'];
  schema: z.ZodType<C>;
  cost(ctx: Ctx, cmd: C): { hours: number; money: number };
  /** First failing check in documented order, or null when legal. */
  validate(ctx: Ctx, cmd: C): ErrorCode | null;
  /** Mutate ctx.state, emit events. Only called after validate returned null. */
  apply(ctx: Ctx, cmd: C): void;
  preview?(ctx: Ctx, cmd: C): Partial<ActionPreview>;
  /** Enumerate legal instances for `legalCommands` (validate is re-run on each). */
  candidates?(ctx: Ctx): C[];
  ai?: {
    category: 'work' | 'study' | 'buy' | 'finance' | 'move' | 'home' | 'meta';
    scorerId?: ScorerId;
  };
  /** True when the command changes only zero-time state (allowed with 0 hours left inside a location). */
  zeroTime?: boolean;
}

export interface SliceMigration {
  from: number;
  to: number;
  migrate(slice: unknown): unknown;
}

export interface StateSlice {
  key: string;
  schema: z.ZodTypeAny;
  version: number;
  /** Initial per-player slice; return undefined for game-level only slices. */
  initialPlayer?(ctx: Ctx, seat: number): unknown;
  initialGame?(ctx: Ctx): unknown;
  migrations?: SliceMigration[];
}

export interface RuleModuleHooks {
  onGameCreate(ctx: Ctx): void;
  /** Once per week before the first seat acts. */
  onWeekStart(ctx: Ctx): void;
  /** Per seat; GDD 4.2 steps B–E are core modules in order. */
  onTurnStart(ctx: Ctx): void;
  onTurnEnd(ctx: Ctx): void;
  onDomainEvent(ctx: Ctx, e: DomainEvent): void;
  contributeLegal(ctx: Ctx, out: BaseCommand[]): void;
  contributePreview(ctx: Ctx, cmd: BaseCommand, p: ActionPreview): void;
  /** Signed dollars added to liquid assets (loans return negative). */
  contributeWealth(ctx: Ctx, seat: number): number;
  /** Start-of-turn half-hour penalties (starvation, burnout). */
  contributeHours(ctx: Ctx): number;
  /** Player-visible weekly income estimate contribution (loan approval). */
  contributeIncome(ctx: Ctx, seat: number): number;
}

export interface RuleModule {
  id: ModuleId;
  flag?: FeatureFlagId;
  /** Deterministic hook order (core 0–99, modern 100–199, packs 200+). */
  order: number;
  commands?: CommandHandler[];
  stateSlice?: StateSlice;
  hooks?: Partial<RuleModuleHooks>;
  aiScorers?: ScorerId[];
}

export interface Engine {
  pack: CityPack;
  modules: RuleModule[];
  handlers: Map<string, CommandHandler>;
  hooks: { [K in keyof RuleModuleHooks]: { module: ModuleId; fn: RuleModuleHooks[K] }[] };
  moduleIds: ModuleId[];
  /** Lazily-built scheduler/win pair (see scheduler.ts createScheduler). */
  cache: Record<string, unknown>;
}

const HOOK_NAMES: (keyof RuleModuleHooks)[] = [
  'onGameCreate',
  'onWeekStart',
  'onTurnStart',
  'onTurnEnd',
  'onDomainEvent',
  'contributeLegal',
  'contributePreview',
  'contributeWealth',
  'contributeHours',
  'contributeIncome',
];

export function createEngine(pack: CityPack, modules: readonly RuleModule[]): Engine {
  const active = modules
    .filter((m) => m.flag === undefined || pack.flags[m.flag])
    .slice()
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const ids = new Set<string>();
  for (const m of active) {
    if (ids.has(m.id)) throw new Error(`duplicate module id "${m.id}"`);
    ids.add(m.id);
  }
  const handlers = new Map<string, CommandHandler>();
  for (const m of active) {
    for (const h of m.commands ?? []) {
      if (handlers.has(h.type)) throw new Error(`command "${h.type}" registered twice (${m.id})`);
      handlers.set(h.type, h);
    }
  }
  const hooks = Object.fromEntries(HOOK_NAMES.map((n) => [n, []])) as unknown as Engine['hooks'];
  for (const m of active) {
    for (const name of HOOK_NAMES) {
      const fn = m.hooks?.[name];
      if (fn) (hooks[name] as { module: ModuleId; fn: unknown }[]).push({ module: m.id, fn });
    }
  }
  return { pack, modules: active, handlers, hooks, moduleIds: active.map((m) => m.id), cache: {} };
}

/** Which modules are active for a given state (flags come from the pack the state was created with). */
export function activeModuleIds(engine: Engine, _state: GameState): ModuleId[] {
  return engine.moduleIds;
}
