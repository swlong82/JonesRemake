# Progress

Current milestone: M2
Last updated: 2026-09-17 by CC

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

- [ ] M2.1 Zod schemas for all pack files + `world.json` + board topology + `_template` validation + cross-file validators — note:
- [ ] M2.2 `classic` pack from SEED_DATA 14.1–14.6 — note:
- [ ] M2.3 `legalCommands` + `previewCommand` — note:
- [ ] M2.4 AI planner + difficulty configs + 4 personalities — note:
- [ ] M2.5 AI uses only public/own state — note:
- [ ] M2 gate: `pnpm verify` green in CI, tag `m2` — note:

## Gate log

| Milestone | Date       | Commit  | verify | CI      | Notes  |
| --------- | ---------- | ------- | ------ | ------- | ------ |
| M0        | 2026-09-17 | bb197bf | green  | green   | tag m0 |
| M1        | 2026-09-17 | 3569ae7 | green  | pending | tag m1 |
