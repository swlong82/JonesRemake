# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).
One entry per milestone (see `docs/MILESTONES.md`).

## [Unreleased]

### Added

- M1 engine core: seeded RNG with named streams, `GameState` + `createGame` + `stateHash`, sequential
  scheduler, rule-module pipeline, 25 command handlers, goal formulas, economy tick, classic events,
  replay determinism with golden vectors.
- M2 classic ruleset and AI: full `classic` CityPack validated by Zod, `legalCommands`/`previewCommand`,
  a utility planner with three difficulty tiers and four personalities that reads only public state.
- M3 balance harness: `packages/sim` CLI with worker threads, deterministic summaries, report writer,
  gate assertions and strategy bots.
- M4 web foundations: Zustand game store as the single mutation path, AI planning in a Web Worker with
  a main-thread fallback, Title / New Game / Settings / Stats / How to Play / Pass-device screens,
  placeholder `AssetRegistry`, theme tokens and the full English string set.
- App feature flags (`apps/web/src/flags/appFlags.ts`) gating unfinished screens, resolved from build
  env and query string, with a screen registry and an Unavailable screen that names the milestone.
- M4 game board: SVG ring board with placeholder art and animated tokens (reduced-motion aware), HUD
  with hours ring and goal bars, standings, location panel whose actions, previews and disabled
  reasons all come from the engine, travel sheet, event cards, event log, AI ticker, phone layout,
  the full keyboard map, debug switches behind `?debug=1`, and the end screen with a goal-over-time
  chart and replay export. The classic ruleset is playable end to end in the browser.

- M5 modern systems, each its own rule module behind its CityPack feature flag (`MODERN_MODULES`,
  order 100–199): wellbeing with its four bands and burnout penalties, transport (transit pass,
  used and new cars, upkeep, depreciation, per-trip breakdowns, delays and surge), gig work with a
  weekly demand multiplier and dual employment, subscriptions with weekly billing, price drift,
  lapse and the cancel-where-you-started rule, online study with doomscrolling and the focus app,
  delivery with lost orders, rent hikes with a week's notice and the co-living roommate, six modern
  instruments with correlated returns, and loans with amortised weekly payments, missed-payment
  fees, default and repossession. Four modern event families (AI layoffs weighted by each job's
  `automationRisk`, going viral, phishing, gadget breakdowns) with content-side mitigations.
  `modern-western` carries the content and turns the flags on; `classic` is untouched, which its
  unchanged golden replays are the evidence for.
- M5.9 AI: the planner covers every modern command, three module scorers (wellbeing, loan burden,
  subscription drain) join the registry, and the `GigOnly`, `CryptoAllIn`, `DeliveryOnly` and
  `LoanMax` strategy bots join `StudyFirst` and `NoRelax`.
- `pnpm gen:types` derives the `Command` union from `src/modules/*.ts` as well as the commands
  folder, so a command a rule module owns is part of the union (37 commands).
- `BASELINE_REPORT.md` and `reports/baseline.json` for the shipped classic values: 24 configs,
  3,200 games, every BALANCE 9.3 gate with its achieved value.

### Changed

- M3.3 classic balance: happiness now decays 4 a week (`rules.happiness.decayPerWeek`, new and
  content-driven, default 0), a concert or theatre ticket pays its happiness once per turn, and the
  stat carries a week of headroom above the goal ceiling so the decay that precedes the win check
  cannot make a goal of 100 unwinnable (ADR-0025, ADR-0027). Happiness is the last goal completed in
  11.6% of games, up from 0%. Golden replays regenerated.
- The AI learned two things the decay made necessary (ADR-0027): `happiness-upkeep` values the
  weekly gain a relax session nets, so comfort durables read as the investment they are, and
  `win-proximity` values the progress of the goal you are furthest from, so the planner closes the
  binding goal instead of banking money it does not need. The education scorer and win-proximity
  share one credited-progress helper, so a lesson moves the binding goal before the degree lands.
- Module state no longer leaks into pure code paths: prices a preview can show (ride-hail surge, a
  used car's asking price, the weekly gig demand) are rolled at turn start into the owning module's
  slice, because `cost()` and `validate()` run inside `legalCommands` and `previewCommand` and a
  draw there desynchronises replay (ADR-0028).
- `takeMoneyCascade` returns the shortfall it could not cover, not the amount taken; the
  subscription billing loop had been reading it backwards and cancelling paid subscriptions.
- Loan balances now accrue weekly interest under an explicit whole-dollar rounding policy; partial
  payments reduce debt before missed-payment fees, and default debt remains negative wealth until
  wage/gig garnishment or an explicit bank repayment clears it (ADR-0029).
- The condition view in `core/effects.ts` reads the subscriptions module's record of active ids
  instead of assuming an array of `{id}`, which the golden replays caught.
- The `Studied` domain event carries whether the lesson was taken online, so wellbeing charges the
  lighter online cost instead of inferring it.
- The `gameBoard` and `endScreen` app feature flags are deleted now that M4 landed the screens they
  gated; `saves`, `tutorial`, `audio`, `leaderboard` and `debugTools` remain.
- Pack display strings are registered in the i18n `pack` namespace when a game starts, so locations,
  jobs, degrees, items, meals and assets are named from content everywhere in the UI.

- M0 scaffold: pnpm monorepo, TypeScript project references, ESLint boundaries, Vitest coverage gates,
  Playwright (3 viewports + axe), banned-terms scan, bundle budget, GitHub Actions CI + Pages deploy,
  spec pack under `docs/`, living templates at repo root.
- `docs/SPEC_PACK.md` as the single spec source; `tools/split-spec.py` + `tools/gen-index.py` regenerate the
  split docs and index. Spec version 2026-09-17 with amendments folded in.
