# Spec index — task → sections

Generated from the section citations in `docs/MILESTONES.md` (CLAUDE.md 1.1 step 3: read only what the task cites).
Section numbers are global across the pack: `4.x` = GDD, `5.x` = ARCHITECTURE, `12.x` = EXTENSIBILITY, etc. (see `docs/README.md` file map).
Regenerate after editing MILESTONES: `python3 tools/gen-index.py`.

| Milestone | Task | Summary | Sections cited | Docs named |
| --- | --- | --- | --- | --- |
| M0 | M0.1 | pnpm monorepo, packages + app skeletons incl. `packages/platform` with | 16.4 (ROADMAP_SCAFFOLDS.md) | — |
| M0 | M0.2 | ESLint flat config + boundaries rule + Prettier | — | — |
| M0 | M0.3 | Vitest per package with coverage thresholds (CLAUDE.md 1.7) | 1.7 (CLAUDE.md) | CLAUDE.md |
| M0 | M0.4 | Playwright with 3 viewport projects + axe helper; placeholder Title pa | — | — |
| M0 | M0.5 | `tools/check-banned.ts` with word-boundary regex + exclusions | — | — |
| M0 | M0.6 | Bundle budget script (350 kB gzip initial) | — | — |
| M0 | M0.7 | GitHub Actions `ci.yml`, `deploy.yml`, Pages base path + 404 fallback | — | — |
| M0 | M0.8 | Templates: PROGRESS, DECISIONS, KNOWN_ISSUES, NAMING, README, plus `do | 15.1 (BUILD_READINESS.md) | — |
| M1 | M1.1 | Shared types, `ErrorCode` enum, `DomainEvent` union | — | — |
| M1 | M1.2 | Seeded RNG with named streams | — | — |
| M1 | M1.3 | `GameState`, `createGame`, `stateHash` | — | — |
| M1 | M1.4 | `SequentialScheduler`, `AllGoalsRace`, `SimultaneousScheduler` stub wi | 4.2 (GDD.md), 16.6 (ROADMAP_SCAFFOLDS.md) | GDD |
| M1 | M1.5 | Start-of-turn pipeline in exact GDD order | — | GDD |
| M1 | M1.6 | Movement + enter/exit + hour accounting (walk only) | — | — |
| M1 | M1.7 | `RuleModule` pipeline (12.1) + `CommandHandler` registry (12.2) + `app | 12.1 (EXTENSIBILITY.md), 12.2 (EXTENSIBILITY.md) | — |
| M1 | M1.8 | Goal formulas + hidden stats + decay | 3.3 (ORIGINAL_REFERENCE.md), 4.4 (GDD.md), 4.8 (GDD.md) | GDD |
| M1 | M1.9 | Economy tick + classic events runtime + effect DSL interpreter | — | — |
| M1 | M1.10 | Replay determinism | — | — |
| M2 | M2.1 | Zod schemas for all pack files + `world.json` + board topology (ring/g | — | — |
| M2 | M2.2 | `classic` pack from SEED_DATA 14.1–14.6: board, 16 locations, 11 degre | 14.1 (SEED_DATA.md), 14.6 (SEED_DATA.md) | SEED_DATA |
| M2 | M2.3 | `legalCommands` + `previewCommand` | — | — |
| M2 | M2.4 | AI planner + difficulty configs + 4 personalities | 4.14 (GDD.md) | GDD |
| M2 | M2.5 | AI uses only public/own state | — | — |
| M3 | M3.1 | `packages/sim` CLI, worker threads, metrics, reports | — | — |
| M3 | M3.2 | Strategy bots (BALANCE 9.4, classic-applicable ones) | 9.4 (BALANCE_SPEC.md) | — |
| M3 | M3.3 | Run stage-1 suite; tune [ASSUMED] classic values until 9.3 gates pass | 9.3 (BALANCE_SPEC.md) | — |
| M3 | M3.4 | `sim:gate` config for classic sanity gates wired into CI | — | — |
| M4 | M4.1 | Zustand store + dispatch + EventQueue + AI worker | — | — |
| M4 | M4.2 | Title, Setup (all GDD 4.1 options + City picker from `world.json`), Se | 4.1 (GDD.md) | GDD |
| M4 | M4.3 | SVG ring board, AssetRegistry placeholders, token animation, reduced m | — | — |
| M4 | M4.4 | HUD, standings, location panel with previews and disabled reasons, tra | — | — |
| M4 | M4.5 | Event modals, event log, AI ticker, pass-device screen | — | — |
| M4 | M4.6 | Phone layout (UX 7.2) and keyboard map (UX 7.7) | 7.2 (UX_SPEC.md), 7.7 (UX_SPEC.md) | — |
| M4 | M4.7 | i18n wiring; no hardcoded strings (lint rule `i18next/no-literal-strin | — | — |
| M4 | M4.8 | End screen with goal-over-time chart (SVG, no chart lib) | — | — |
| M5 | M5.1 | Feature flag registry (12.4) plumbing (engine + UI hide); every M5 sys | 12.4 (EXTENSIBILITY.md) | — |
| M5 | M5.2 | Wellbeing stat + bands + collapse | 4.5 (GDD.md) | GDD |
| M5 | M5.3 | Transport modes, transit pass, used/new car, depreciation, upkeep, rid | 4.3 (GDD.md) | GDD |
| M5 | M5.4 | Gig jobs + dual employment rule | — | — |
| M5 | M5.5 | Online study + doomscroll + Focus App | — | — |
| M5 | M5.6 | Delivery, subscriptions (billing, drift, retention dialog, cancel loca | — | — |
| M5 | M5.7 | Modern assets with correlated returns; loans (approval, APR, amortizat | — | — |
| M5 | M5.8 | Modern event families + automationRisk + mitigations | — | — |
| M5 | M5.9 | AI extended to all modern commands; bots `GigOnly`, `CryptoAllIn`, `De | — | — |
| M6 | M6.1 | `modern-western` pack (extends classic): names, flavor text minimums ( | 6.3 (CONTENT_SCHEMAS.md) | — |
| M6 | M6.2 | Write and lock `reports/modern-targets.json` (hash in ADR) | — | — |
| M6 | M6.3 | Tuning loop per BALANCE 9.6 until 9.5 gates pass | 9.5 (BALANCE_SPEC.md), 9.6 (BALANCE_SPEC.md) | — |
| M6 | M6.4 | CI `sim:gate` switched to modern gates (classic sanity gates retained) | — | — |
| M6 | M6.5 | UI for all modern features incl. subscriptions total, loan panel, inve | — | — |
| M7 | M7.1 | AudioBus, SFX recipes, procedural music moods, settings persistence | — | — |
| M7 | M7.2 | Save system behind `SaveStore` (`IndexedDbSaveStore`): autosave, 3 slo | — | — |
| M7 | M7.3 | Tutorial (UX 7.6) with spotlight + event-driven steps | 7.6 (UX_SPEC.md) | — |
| M7 | M7.4 | Classic opacity mode | — | — |
| M7 | M7.5 | Themes, text scale, pseudo-locale generation + one e2e run in pseudo-l | — | — |
| M8 | M8.1 | `score()` + `LocalLeaderboard` + Stats board UI with scopes (16.7); `N | 16.7 (ROADMAP_SCAFFOLDS.md) | — |
| M8 | M8.2 | README (play, controls, dev setup, architecture summary) + `docs/EXTEN | 12.9 (EXTENSIBILITY.md), 16.1 (ROADMAP_SCAFFOLDS.md) | — |
| M8 | M8.3 | Full e2e regression: 4-seat hotseat (2 human + 2 AI) modern game to we | — | — |
| M8 | M8.4 | Deploy to GitHub Pages; post-deploy smoke test against live URL in wor | — | — |
| M8 | M8.5 | Close-out: `KNOWN_ISSUES.md` reviewed, every open item has severity an | — | — |
| M9 | M9.1 | Spec amendments (17, 17.10) + ADRs; this task list in `PROGRESS.md` | 17.10 (ART_SPEC.md) | — |
| M9 | M9.2 | `packages/art`: manifest schema, slot catalog, SVG sanitizer, key-colo | 17.2 (ART_SPEC.md), 17.4 (ART_SPEC.md), 17.6 (ART_SPEC.md) | — |
| M9 | M9.3 | `pnpm art:placeholders` + default set wireframes + `pnpm art:check` in | 17.3 (ART_SPEC.md), 17.8 (ART_SPEC.md) | — |
| M9 | M9.4 | Web `ArtRegistry`: static URLs, tint blobs, wireframe fallback per key | 17.5 (ART_SPEC.md), 17.9 (ART_SPEC.md) | — |
| M9 | M9.5 | Theme from art set: palette tokens, bundled OFL fonts, 9-slice frames  | 4.5 (GDD.md), 17.7 (ART_SPEC.md) | — |
| M9 | M9.6 | Scene board + HUD bar + overlays (17.9, UX 7.2) | 7.2 (UX_SPEC.md), 7.7 (UX_SPEC.md), 7.8 (UX_SPEC.md), 17.9 (ART_SPEC.md) | — |
| M9 | M9.7 | Avatars: picker in setup, tint, path walking with frame swap, reduced- | 17.3 (ART_SPEC.md) | — |
| M9 | M9.8 | Interiors: scene + host + speech bubble + in-scene action panel; phone | 17.9 (ART_SPEC.md) | — |
| M9 | M9.9 | Phone: pan/zoom scene + list toggle (17.9) | 17.9 (ART_SPEC.md) | — |
| M9 | M9.10 | Title, setup, weekend recap, newspaper screens (17.3, 17.9) | 17.3 (ART_SPEC.md), 17.9 (ART_SPEC.md) | — |
| M9 | M9.11 | Lazy loading + service-worker precache + art budget in `build` (17.8) | 17.8 (ART_SPEC.md) | — |
| M9 | M9.12 | Art-pack zip import: `ArtPackStore` (16.1) on IndexedDB, import screen | 16.1 (ROADMAP_SCAFFOLDS.md), 17.6 (ART_SPEC.md) | — |
| M9 | M9.13 | Default set drawn: every slot's placeholder replaced (tracked by `art: | — | — |

Always in scope for every task: `CLAUDE.md` (all), `docs/BUILD_READINESS.md` §15.6 and `docs/ROADMAP_SCAFFOLDS.md` §16.8 (amendments).
