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

- M0 scaffold: pnpm monorepo, TypeScript project references, ESLint boundaries, Vitest coverage gates,
  Playwright (3 viewports + axe), banned-terms scan, bundle budget, GitHub Actions CI + Pages deploy,
  spec pack under `docs/`, living templates at repo root.
- `docs/SPEC_PACK.md` as the single spec source; `tools/split-spec.py` + `tools/gen-index.py` regenerate the
  split docs and index. Spec version 2026-09-17 with amendments folded in.
