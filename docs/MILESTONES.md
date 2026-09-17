# 10. docs/MILESTONES.md — M0 to M8

Each milestone ends with `pnpm verify` green, CI green, `PROGRESS.md` updated, tag `m<N>`. Tasks are ordered; AC = acceptance criteria (each becomes at least one automated test unless marked *manual-free check*, which CC verifies by script output).

## M0 — Scaffold and CI

- [ ] M0.1 pnpm monorepo, packages + app skeletons, TS project refs, strict configs. AC: `pnpm typecheck` passes on empty packages.
- [ ] M0.2 ESLint flat config + boundaries rule + Prettier. AC: importing `apps/web` from `engine` fails lint (fixture test).
- [ ] M0.3 Vitest per package with coverage thresholds (CLAUDE.md 1.7). AC: threshold failure breaks `pnpm test`.
- [ ] M0.4 Playwright with 3 viewport projects + axe helper; placeholder Title page. AC: e2e smoke passes on all 3.
- [ ] M0.5 `tools/check-banned.ts` with word-boundary regex + exclusions. AC: fixture containing a banned term fails; `pineapple` passes.
- [ ] M0.6 Bundle budget script (350 kB gzip initial). AC: fails on oversized fixture.
- [ ] M0.7 GitHub Actions `ci.yml`, `deploy.yml`, Pages base path + 404 fallback. AC: workflow YAML validated by `actionlint` in CI.
- [ ] M0.8 Templates: PROGRESS, DECISIONS, KNOWN_ISSUES, NAMING, README. AC: files exist with section headers (script check).

## M1 — Engine core

- [ ] M1.1 Shared types, `ErrorCode` enum, `DomainEvent` union.
- [ ] M1.2 Seeded RNG with named streams. AC: known-seed vectors; stream independence property test.
- [ ] M1.3 `GameState`, `createGame`, `stateHash`. AC: hash stable across key order; JSON round-trip equal.
- [ ] M1.4 `SequentialScheduler`, `AllGoalsRace`, `SimultaneousScheduler` stub. AC: turn order, week increment, win check timing per GDD 4.2.
- [ ] M1.5 Start-of-turn pipeline in exact GDD order. AC: ordered-steps test with spy events.
- [ ] M1.6 Movement + enter/exit + hour accounting (walk only). AC: shortest direction; hour rounding; turn ends on leaving with 0h.
- [ ] M1.7 Command validators + `applyCommand` for classic commands (jobs, work, raise, education, relax, food, clothing, items, pawn, rent, bank, classic stocks, lottery, news, end turn). AC: each command ≥ 3 tests (valid, invalid code, edge); property test: random legal command sequences never produce negative hours, NaN, or invalid state (Zod-validated state schema).
- [ ] M1.8 Goal formulas + hidden stats + decay. AC: table-driven tests for GDD 4.4, 4.8, section 3.3 formulas.
- [ ] M1.9 Economy tick + classic events runtime + effect DSL interpreter. AC: every Effect op tested; econ bounds held over 10k weeks.
- [ ] M1.10 Replay determinism. AC: 200 random seeds × random legal command logs replay to identical hash.

## M2 — Classic content and AI

- [ ] M2.1 Zod schemas for all pack files + cross-file validators. AC: invalid fixtures rejected with path-specific messages.
- [ ] M2.2 `classic` pack: board, 16 locations, 11 degrees, full job table satisfying section 3.4 anchors, items, clothing, meals, events, rules, i18n EN. AC: validator passes; anchor tests (Professor wage/reqs, GM highest wage, cook always hires, degree DAG shape).
- [ ] M2.3 `legalCommands` + `previewCommand`. AC: preview deltas equal actual apply deltas for deterministic commands (property test).
- [ ] M2.4 AI planner + difficulty configs + 4 personalities. AC: AI never issues illegal commands over 1,000 games; turn-time benchmarks (GDD 4.14); Hard beats Easy ≥ 70% in 200-game smoke.
- [ ] M2.5 AI uses only public/own state. AC: test that mutating other players' hidden stats does not change AI plan.

## M3 — Sim and baseline

- [ ] M3.1 `packages/sim` CLI, worker threads, metrics, reports. AC: deterministic summary for fixed args.
- [ ] M3.2 Strategy bots (BALANCE 9.4, classic-applicable ones).
- [ ] M3.3 Run stage-1 suite; tune [ASSUMED] classic values until 9.3 gates pass. AC: `BASELINE_REPORT.md` + `reports/baseline.json` committed; tag `baseline-frozen`.
- [ ] M3.4 `sim:gate` config for classic sanity gates wired into CI.

## M4 — Web UI, classic playable

- [ ] M4.1 Zustand store + dispatch + EventQueue + AI worker.
- [ ] M4.2 Title, Setup (all GDD 4.1 options), Settings, Stats screens.
- [ ] M4.3 SVG ring board, AssetRegistry placeholders, token animation, reduced motion.
- [ ] M4.4 HUD, standings, location panel with previews and disabled reasons, travel sheet.
- [ ] M4.5 Event modals, event log, AI ticker, pass-device screen.
- [ ] M4.6 Phone layout (UX 7.2) and keyboard map (UX 7.7).
- [ ] M4.7 i18n wiring; no hardcoded strings (lint rule `i18next/no-literal-string`).
- [ ] M4.8 End screen with goal-over-time chart (SVG, no chart lib).

* AC (e2e): start 2-seat classic game (human + AI) on all 3 viewports; human completes week 1 via keyboard only; debug autoplay reaches a winner at goals 30; axe 0 serious/critical on listed screens; Lighthouse CI desktop performance ≥ 90.

## M5 — Modern systems

- [ ] M5.1 Feature flags plumbing (engine + UI hide).
- [ ] M5.2 Wellbeing stat + bands + collapse. AC: GDD 4.5 tables.
- [ ] M5.3 Transport modes, transit pass, used/new car, depreciation, upkeep, ride-hail unlock. AC: GDD 4.3 table; mode preview correct.
- [ ] M5.4 Gig jobs + dual employment rule. AC: career stat unaffected by gig.
- [ ] M5.5 Online study + doomscroll + Focus App.
- [ ] M5.6 Delivery, subscriptions (billing, drift, retention dialog, cancel location rule), rent hikes, co-living quirks.
- [ ] M5.7 Modern assets with correlated returns; loans (approval, APR, amortization, missed/default). AC: amortization matches closed-form within $0.01; correlation of simulated returns vs spec within ±0.1 over 50k weeks.
- [ ] M5.8 Modern event families + automationRisk + mitigations. AC: each family's mitigation measurably reduces frequency in 10k-week sim test.
- [ ] M5.9 AI extended to all modern commands; bots `GigOnly`, `CryptoAllIn`, `DeliveryOnly`, `LoanMax`, `NoRelax`.

## M6 — Modern pack and balance

- [ ] M6.1 `modern-western` pack (extends classic): names, flavor text minimums (CONTENT 6.3), modern items/subs/assets/loans/events.
- [ ] M6.2 Write and lock `reports/modern-targets.json` (hash in ADR).
- [ ] M6.3 Tuning loop per BALANCE 9.6 until 9.5 gates pass. AC: `BALANCE_REPORT.md` final iteration all green (or stuck-policy record).
- [ ] M6.4 CI `sim:gate` switched to modern gates (classic sanity gates retained).
- [ ] M6.5 UI for all modern features incl. subscriptions total, loan panel, investment panel with sparkline, transport selector.

## M7 — Polish systems

- [ ] M7.1 AudioBus, SFX recipes, procedural music moods, settings persistence. AC: NullAudioBus in tests; mapping table covers every SfxId; music chunk lazy-loaded (bundle report).
- [ ] M7.2 Save system: autosave, 3 slots, export/import, migrations, replay verification. AC: save → reload → identical hash; v1→v2 dummy migration test; corrupted import rejected gracefully.
- [ ] M7.3 Tutorial (UX 7.6) with spotlight + event-driven steps. AC: e2e completes tutorial on desktop and phone.
- [ ] M7.4 Classic opacity mode. AC: hidden values absent from DOM (not just visually hidden).
- [ ] M7.5 Themes, text scale, final a11y pass. AC: axe gate; contrast token test.

## M8 — Release

- [ ] M8.1 `NAMING.md` final: 5 title proposals, rival names, location names; set `config.title` to #1; banned-terms clean.
- [ ] M8.2 README (play, controls, dev setup, architecture summary, how to add a CityPack).
- [ ] M8.3 Full e2e regression: 4-seat hotseat (2 human + 2 AI) modern game to week 10 via scripted inputs; save/load mid-game; phone layout full game via autoplay to winner.
- [ ] M8.4 Deploy to GitHub Pages; post-deploy smoke test against live URL in workflow.
- [ ] M8.5 Close-out: `KNOWN_ISSUES.md` reviewed, every open item has severity and workaround; tag `v1.0.0`.
