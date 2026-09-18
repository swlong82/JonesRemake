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

### Changed

- M5 modern systems, each its own rule module behind its CityPack feature flag: wellbeing with
  its four bands, transport (transit pass, used and new cars, upkeep, depreciation, breakdowns),
  gig work with a weekly demand multiplier, subscriptions with billing, drift and the
  cancel-where-you-started rule, online study with doomscrolling, delivery, rent hikes and the
  co-living roommate, six modern instruments with correlated returns, and loans with amortised
  weekly payments, missed-payment fees and default. `modern-western` carries the content and turns
  the flags on; `classic` is untouched.
- M5.9 AI: the planner covers every modern command, three module scorers (wellbeing, loan burden,
  subscription drain) join the registry, and the `GigOnly`, `CryptoAllIn`, `DeliveryOnly` and
  `LoanMax` strategy bots join `StudyFirst` and `NoRelax`.
- M3.3 classic balance: happiness now decays 4 a week (`rules.happiness.decayPerWeek`, new and
  content-driven, default 0) and a concert or theatre ticket pays its happiness once per turn, so
  happiness is a goal you have to keep rather than buy once (ADR-0025). Golden replays regenerated.
- The `gameBoard` and `endScreen` app feature flags are deleted now that M4 landed the screens they
  gated; `saves`, `tutorial`, `audio`, `leaderboard` and `debugTools` remain.
- Pack display strings are registered in the i18n `pack` namespace when a game starts, so locations,
  jobs, degrees, items, meals and assets are named from content everywhere in the UI.

- M0 scaffold: pnpm monorepo, TypeScript project references, ESLint boundaries, Vitest coverage gates,
  Playwright (3 viewports + axe), banned-terms scan, bundle budget, GitHub Actions CI + Pages deploy,
  spec pack under `docs/`, living templates at repo root.
- `docs/SPEC_PACK.md` as the single spec source; `tools/split-spec.py` + `tools/gen-index.py` regenerate the
  split docs and index. Spec version 2026-09-17 with amendments folded in.
