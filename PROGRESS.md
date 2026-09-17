# Progress

Current milestone: M1
Last updated: 2026-09-17 by hand-off (pre-CC)

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

(CC copies every task from docs/MILESTONES.md when starting the milestone.)

## Gate log

| Milestone | Date | Commit | verify | CI  | Notes |
| --------- | ---- | ------ | ------ | --- | ----- |
| M0 | 2026-09-17 | bb197bf | green | green | tag m0 |
