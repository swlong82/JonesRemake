# Progress

Current milestone: M4 complete (classic playable); M3 (M3.3–M3.4) still open
Last updated: 2026-09-17 by CC — see `HANDOFF.md` for the resume point.

## M0 — Scaffold and CI

- [x] M0.1 pnpm monorepo, packages + app skeletons, TS project refs, strict configs — note: scaffolded; `packages/platform` interfaces + `createLocalServices()` included (16.8.6). CC: re-run `pnpm typecheck` to confirm.
- [x] M0.2 ESLint flat config + boundaries rule + Prettier — note: `tools/boundaries.test.ts` is the fixture test.
- [x] M0.3 Vitest per package with coverage thresholds — note: thresholds in root `vitest.config.ts` (glob per package).
- [x] M0.4 Playwright 3 viewports + axe helper + placeholder Title page — note: `apps/web/e2e/smoke.spec.ts`.
- [x] M0.5 `tools/check-banned.ts` — note: `tools/lib/banned.test.ts` covers fixture + `pineapple`.
- [x] M0.6 Bundle budget script — note: `tools/lib/budget.test.ts` fails on oversized fixture.
- [x] M0.7 `ci.yml`, `deploy.yml`, Pages base path + 404 fallback, actionlint — note: first CI run pending push.
- [x] M0.8 Templates + `docs/INDEX.md`, `LICENSE`, `CHANGELOG.md`, `pnpm scaffold:check` — note: `tools/templates.test.ts`.
- [x] M0 gate: `pnpm verify` green in CI, tag `m0` — note: tagged bb197bf 2026-09-17 (pre-CC).

## M1 — Engine core

- [x] M1.1 Shared types, `ErrorCode` enum, `DomainEvent` union — note: `packages/shared/src/{ids,errors,events}.ts`; 46 codes, 56 event types, count-tested.
- [x] M1.2 Seeded RNG with named streams — note: `core/rng.ts` xoshiro128** + cyrb128, lazy named streams in `RngState`; golden vectors + fast-check independence; `core/math.ts` mulDiv/Irwin–Hall.
- [x] M1.3 `GameState`, `createGame`, `stateHash` — note: `core/{state,create,hash,clone,state-schema}.ts`; `create.test.ts` (key-order/JSON round-trip hash, GDD 4.1.6 start state, AI goal ranges).
- [x] M1.4 `SequentialScheduler`, `AllGoalsRace`, `SimultaneousScheduler` stub — note: `core/scheduler.ts`; `scheduler.test.ts` (turn order, week wrap, win at turn start, 16.6 `test.todo` list, golden module order).
- [x] M1.5 Start-of-turn pipeline in exact GDD order — note: modules `core-setup(0) → core-econ(10) → core-pending(20) → core-events(30) → core-decay(40)`; spy-module ordered test in `scheduler.test.ts`.
- [x] M1.6 Movement + enter/exit + hour accounting (walk only) — note: `commands/turn.ts`; `turn.test.ts` (shortest direction, ceil to 0.5h, partial move ends turn, theft on exit, rent-week open rule).
- [x] M1.7 `RuleModule` pipeline + `CommandHandler` registry + `applyCommand` for classic commands — note: 25 handlers in `commands/*.ts`, `gen:types` → `commands.generated.ts`; ≥3 tests each in `jobs/education/home/shop.test.ts`; fast-check property in `replay.test.ts` with `GameStateSchema`. ADR-0009/0011.
- [x] M1.8 Goal formulas + hidden stats + decay — note: `core/goals.ts`, `modules/core-decay.ts`; table-driven `goals.test.ts`.
- [x] M1.9 Economy tick + classic events runtime + effect DSL interpreter — note: `modules/core-econ.ts`, `core/{effects,events}.ts`; every op + 10k-week bounds in `effects.test.ts`; formula events in `pending.test.ts`. ADR-0012.
- [x] M1.10 Replay determinism — note: 200 seeds × random legal logs in `replay.test.ts`; 20 golden replays per playable pack in `test/golden/` (regen `UPDATE_GOLDEN=1`).
- [x] M1 gate: `pnpm verify` green locally, tag `m1` — note: 3569ae7; CI confirmation on push.

## M2 — Classic content and AI

- [x] M2.1 Zod schemas for all pack files + `world.json` + board topology + `_template` validation + cross-file validators — note: built in M1 (ADR-0006); `packages/content/src/resolve.test.ts` invalid-fixture tests with path-specific messages.
- [x] M2.2 `classic` pack from SEED_DATA 14.1–14.6 — note: built in M1; anchors in `packages/content/src/classic.test.ts` (Professor, GM, cook, degree DAG).
- [x] M2.3 `legalCommands` + `previewCommand` — note: engine `core/apply.ts`; preview ≡ apply property test `core/preview.test.ts`.
- [x] M2.4 AI planner + difficulty configs + 4 personalities — note: `packages/ai/src/{config,view,scorers,planner}.ts` (ADR-0014); 1,000-game legality, turn-time benchmark, Hard≥70% vs Easy (24 games goals 30) in `planner.test.ts`.
- [x] M2.5 AI uses only public/own state — note: `sanitizeForAi`; `view.test.ts` mutates rivals' hidden stats + RNG streams → identical plans.
- [x] M2 gate: `pnpm verify` green locally, tag `m2` (local; see KI-001) — note: fe54f7e.

## M3 — Sim and baseline

- [x] M3.1 `packages/sim` CLI, worker threads, metrics, reports — note: `packages/sim/src/{spec,runner,metrics,report,gates,pool,worker}.ts`, `cli.ts`; deterministic summary test in `sim.test.ts`. ADR-0015.
- [x] M3.2 Strategy bots (BALANCE 9.4, classic-applicable ones) — note: `bots.ts` StudyFirst + NoRelax via `PlanOptions.forbid`; modern bots at M5.9.
- [ ] M3.3 Run stage-1 suite; tune [ASSUMED] classic values until 9.3 gates pass — note: suite ran to completion (24 configs, 3,200 games); `BASELINE_REPORT.md` + `reports/baseline.json` record B(metric, config) and every 9.3 gate with its achieved value (`pnpm baseline`). Tuning still open: career and happiness are never the last goal at goals 50 (KI-005) and the fix needs a mechanic, not a value — see ADR-0024. No `baseline-frozen` tag.
- [ ] M3.4 `sim:gate` config for classic sanity gates wired into CI — note: `sim/gates.json` + `ci.yml` wired and running (8 configs, 18 assertions, ≈ 2 min); 16 pass, the two KI-005 assertions stay `pending` (ADR-0019) until the tuning lands.
- [ ] M3 gate: `pnpm verify` green in CI **and `pnpm sim:gate --strict` clean** (no pending assertions), tag `m3` — note:

## M4 — Web UI, classic playable

- [x] M4.1 Zustand store + dispatch + EventQueue + AI worker — note: `apps/web/src/store/gameStore.ts` is the sole mutation path (engine `applyCommand`); `ai/aiClient.ts` runs planning in a Web Worker with a main-thread fallback after two failures; 12 store tests + 4 client tests.
- [x] M4.2 Title, Setup (all GDD 4.1 options + City picker from `world.json`), Settings, Stats screens — note: plus Help and Pass-device; `ui/screens/*.tsx`, `store/settings.ts` (localStorage, no cookies), `assets/AssetRegistry.tsx` placeholders, full `i18n/en.json` key set; 20 screen/router tests.
- [x] M4.3 SVG ring board, AssetRegistry placeholders, token animation, reduced motion — note: `ui/game/Board.tsx`, 16 squares from `pack.board`, focusable per-square buttons labelled with name/distance/hours, CSS transform transition dropped under reduced motion (ADR-0021).
- [x] M4.4 HUD, standings, location panel with previews and disabled reasons, travel sheet — note: `Hud.tsx` (hours ring, money, 4 goal bars, 25% steps under classic opacity), `Standings.tsx`, `LocationPanel.tsx` (candidates grouped by service, preview line per row, `ErrorCode` reason on disabled rows — ADR-0020), `TravelSheet.tsx`.
- [x] M4.5 Event modals, event log, AI ticker, pass-device screen — note: `EventCards.tsx` (stacked, Enter/click dismiss), `LogDrawer.tsx` (per-week groups, hotseat amounts hidden), `AiTicker.tsx` with skip.
- [x] M4.6 Phone layout (UX 7.2) and keyboard map (UX 7.7) — note: `useIsPhone` picks the layout (mini ring + `PhoneLocationList` + bottom sheet), `useKeyboard` covers the whole 7.7 map, `DebugPanel` + `debug/useDebugBoot` behind `?debug=1` and the `debugTools` flag.
- [x] M4.7 i18n wiring; no hardcoded strings (lint rule `i18next/no-literal-string`) — note: `startGame` calls `loadPackStrings`, so every content name resolves from the `pack` namespace; rule active on `apps/web/src/**/*.tsx` and passing.
- [x] M4.8 End screen with goal-over-time chart (SVG, no chart lib) — note: `ui/screens/EndScreen.tsx` + `ui/game/GoalChart.tsx` (polyline per player per goal, dash patterns so colour is not the only signal), key stats table, rematch/new game/replay export (ADR-0023).
- [ ] M4 gate: `pnpm verify` green in CI, e2e AC on 3 viewports, tag `m4` — note:

## Gate log

| Milestone | Date       | Commit  | verify | CI      | Notes                  |
| --------- | ---------- | ------- | ------ | ------- | ---------------------- |
| M0        | 2026-09-17 | bb197bf | green  | green   | tag m0                 |
| M1        | 2026-09-17 | 3569ae7 | green  | pending | tag m1 (local, KI-001) |
| M2        | 2026-09-17 | fe54f7e | green  | pending | tag m2 (local, KI-001) |
