# 5. docs/ARCHITECTURE.md

## 5.1 Repository layout

```text
/
├─ CLAUDE.md  PROGRESS.md  DECISIONS.md  KNOWN_ISSUES.md  NAMING.md  README.md
├─ docs/                       # this spec pack
├─ packages/
│  ├─ engine/    # pure rules: state, commands, validators, scheduler, win, rng, events runtime
│  ├─ content/   # Zod schemas + packs: classic/, modern-western/ ; loader + validator CLI
│  ├─ ai/        # utility planner, personalities, difficulty configs
│  ├─ sim/       # headless runner CLI, stats aggregation, report writers
│  ├─ shared/    # types, i18n key types, result/error types
│  ├─ platform/  # provider-agnostic contracts + Local*/Null* defaults (identity, transport, saves, leaderboard, telemetry)
│  └─ art/       # art-set manifest schema, slot catalog, sanitizer, tint, validator; sets/<id>/ (section 17)
├─ apps/web/     # React app
│  ├─ src/store/  (Zustand)  src/ui/  src/board/  src/audio/  src/save/  src/i18n/  src/assets/
│  └─ e2e/        # Playwright specs
├─ tools/        # check-banned.ts, bundle-budget.ts
└─ .github/workflows/ci.yml, deploy.yml
```

Dependency rule: `shared` ← `content` ← `engine` ← `ai` ← `sim`; `shared` ← `platform`; `shared` ← `art`; `apps/web` depends on all but `sim`. Enforced by `eslint-plugin-boundaries`.

## 5.2 Toolchain (pin exact versions in lockfile)

Node 22 LTS, pnpm 9, TypeScript 5.x strict, Vite 6, React 18, Zustand 5, Tailwind 3, Framer Motion 11, Zod 3, i18next + react-i18next, idb (IndexedDB wrapper), Tone.js (lazy-loaded chunk), lucide-react, Vitest, fast-check (property tests), Playwright + @axe-core/playwright, ESLint 9 flat config, Prettier.

## 5.3 Engine API

```ts
export interface GameConfig { packId: string; // validated against loaded packs
   seats: SeatConfig[]; seed: string; chaos: Chaos; classicOpacity: boolean; }
export interface GameState { schemaVersion: number; config: GameConfig; week: number; activeSeat: number; econ: EconState; market: MarketState; players: PlayerState[]; pawnShop: PawnEntry[]; rng: RngState; log: LoggedCommand[]; winner: number | null; flags: FeatureFlags; }
export type Command = { type: 'Move'; to: LocationId; mode: TransportModeId } | { type: 'Work'; hours: number } | /* ...all of GDD 4.15 */ ;
export interface ApplyResult { state: GameState; events: DomainEvent[]; }
export type Validation = { ok: true; preview: ActionPreview } | { ok: false; code: ErrorCode; params?: Record<string, unknown> };

export function createGame(config: GameConfig, pack: CityPack): GameState;
export function validate(state: GameState, seat: number, cmd: Command, pack: CityPack): Validation;
export function applyCommand(state: GameState, seat: number, cmd: Command, pack: CityPack): ApplyResult; // throws only on programmer error; invalid cmds return state unchanged + ErrorEvent
export function legalCommands(state: GameState, seat: number, pack: CityPack): Command[]; // used by AI + UI enablement
export function previewCommand(state: GameState, seat: number, cmd: Command, pack: CityPack): ActionPreview; // hours, money, stat deltas, risk %
export function stateHash(state: GameState): string; // stable, key-sorted
```

- State updates are immutable (structural sharing via Immer is allowed inside engine).
- `DomainEvent` is a discriminated union used by UI for animation, audio cues, event log and tutorial triggers.

## 5.4 RNG

- Algorithm: `xoshiro128**` seeded via `cyrb128(seed)`; state stored in `GameState.rng`.
- Separate named streams derived per purpose (`economy`, `market`, `events:<seat>`, `jobs:<seat>`, `ai:<seat>`) so adding a new random draw in one subsystem does not shift others. Stream derivation: `seed + ':' + streamName`.
- AI stream MUST NOT be consumed by engine rules; AI randomness never affects game outcome except via chosen commands.

## 5.5 Turn scheduling and win

```ts
interface TurnScheduler { current(state): SeatRef[]; canAct(state, seat): boolean; onEndTurn(state, seat): GameState; }
class SequentialScheduler implements TurnScheduler { /* v1 */ }
class SimultaneousScheduler implements TurnScheduler { /* v2 stub: throws NotImplemented; contract tests skipped with reason */ }
interface WinCondition { evaluate(state, seat): { met: boolean; progress: GoalProgress[] }; }
class AllGoalsRace implements WinCondition { /* v1 */ }
```

Simultaneous-mode conflict rules to document now (not implement): commands resolved in seat order rotated weekly; shared resources (pawn listings, job "no openings" lock) resolved first-come by rotated order; simultaneous winners → highest sum of (stat − target) wins, then lowest seat index.

## 5.6 Web app state

- Zustand store holds `GameState`, UI state (selected location, open panel, modals), settings. Only action: `dispatch(cmd)` → engine `applyCommand` → set state → push events to an `EventQueue` consumed by animation/audio/log.
- AI turns run in a Web Worker (`ai.worker.ts`) via Comlink-style message passing; UI shows "Thinking…" and replays returned command list.
- Rendering: board as responsive SVG (`viewBox` 0 0 1000 1000); locations placed on a rounded-square ring; tokens animated with Framer Motion along path. All visuals resolved via `AssetRegistry.get(key)` returning a React component; v1 registry = placeholder shapes + Lucide icons. From M9 the scene UI resolves art-set keys through `ArtRegistry` (17.5) and the ring board is retired (17.9).

## 5.7 Save and replay

- IndexedDB DB `game` stores: `autosave` (1 record), `slots` (3), `settings`, `stats`.
- Save record: `{ schemaVersion, packId, packVersion, createdAt, week, seatsSummary, config, commandLog, finalHash?, snapshot }`. Snapshot = full `GameState` for fast load; command log for replay and verification.
- Load path: if `schemaVersion` < current → run migrations `migrations[n](record)` sequentially; then verify by replaying log from seed and comparing `stateHash` to snapshot (mismatch → load snapshot, show warning, log to console).
- Export: JSON file download `save-<title>-week<N>.json`; import validates with Zod.
- Autosave on every `EndTurn` and every 10 commands.

## 5.8 Online-readiness (v2, no implementation)

Command log is the network unit; server authoritative = runs same engine; client prediction by applying locally then reconciling on hash. No engine code may assume single-client; no `window` access in engine; seat identity passed explicitly.

## 5.9 CI/CD

- `ci.yml` on push/PR: install → lint → typecheck → test (coverage) → check:banned → build → bundle budget → Playwright (chromium, 3 viewports) → sim:gate. Upload `apps/web/dist` and reports as artifacts.
- `deploy.yml` on push to `main` after CI: build with `base: '/<repo>/'`, copy `index.html` to `404.html`, deploy via `actions/deploy-pages`.
- Caching: pnpm store, Playwright browsers.
