# Hustle Ring

A modern, browser-based remake of a 1991 life-sim board game: race rivals around a ring of
city locations, juggling money, career, education and happiness in weekly turns. Built as a clean-room
reimplementation with original names, art and text — see `docs/PRD.md` §2.6 for the IP-safety rules.

**Status:** v1.0.0 — released with milestone M8 (merged to `main` as 03caf07). Two rulesets are playable and balanced
against the spec's targets, with AI rivals at three difficulties, local hotseat, saves and replays, a
tutorial, audio, themes and a local leaderboard. Everything runs in the browser; nothing leaves the
device. `PROGRESS.md` has the task list, `HANDOFF.md` the resume point.
Live build: https://swlong82.github.io/JonesRemake/ (GitHub Pages; `deploy.yml` runs after CI on
`main` and smoke-tests the live site after every deploy).

| Milestone | Scope                                          | Status |
| --------- | ---------------------------------------------- | ------ |
| M0        | Scaffold, CI, Pages deploy, spec pack          | done   |
| M1        | Engine core (state, RNG, commands)             | done   |
| M2        | Classic content pack + AI rival                | done   |
| M3        | Sim harness + classic baseline                 | done   |
| M4        | Web UI, classic playable                       | done   |
| M5        | Modern systems (transport, gigs, loans)        | done   |
| M6        | Modern pack + balance                          | done   |
| M7        | Polish: audio, save/replay, tutorial, a11y     | done   |
| M8        | Release: leaderboard, docs, regression, v1.0.0 | done   |

## Play

Open the Pages URL, press **New Game**, pick a city, choose seats (solo against AI rivals, or local
hotseat for up to four), set each goal level, and play weekly turns until someone meets all four
goals. First game? The tutorial walks you through one turn; replay it any time from **How to Play**.
Full rules: `docs/GDD.md`.

Two rulesets ship:

- **Classic** — sixteen locations, a job ladder, eleven degrees, a bounded market and weekend events.
- **Modern City** — adds wellbeing (burn out and you lose a turn), travel modes and cars, gig
  shifts, subscriptions that bill weekly and drift upward, online study you can doomscroll away,
  delivery, rent hikes, loans (including student loans), six correlated instruments, and modern
  events: layoffs, going viral, phishing, broken gadgets.

The four goals are **wealth** (cash, savings and holdings), **happiness**, **education** (degrees)
and **career** — which grows with your dependability _and_ with how long you have stayed employed, so
job-hopping and getting fired both cost you.

Each turn is one week of 60 hours. Click a ring square to open the travel sheet, **Enter** a
location to use it, and pick actions from the panel — every action shows its cost and effect before
you commit (`−6h · +$96 · Dependability +2`).

| Key                                   | Action                               |
| ------------------------------------- | ------------------------------------ |
| `1`–`9`, `0`, `Q` `W` `E` `R` `T` `Y` | Travel to the square with that badge |
| `Enter`                               | Confirm                              |
| `Shift+E`                             | End the turn                         |
| `Ctrl/⌘+S`                            | Save and load                        |
| `L` / `G` / `H`                       | Event log / standings / help         |

The game autosaves at the start of a game, at every turn's end and every ten actions; three manual
slots and JSON export/import sit behind **Save and load**. The end screen exports a replay (seed +
command log), and a win against at least one rival posts a score to the device's leaderboard
(**Stats**; local only and marked unverified).

### Feature flags

Screens that are specified but not yet built are gated by app feature flags
(`apps/web/src/flags/appFlags.ts`, ADR-0017) — separate from the CityPack feature flags that gate
rules per ruleset. A flag is deleted when its milestone lands. Left: `tutorial` and `audio` (on by
default) and `debugTools` (UX 7.9). Override for local development with a build env var or a query
string:

```bash
VITE_FF_AUDIO=off pnpm dev    # build-time
# http://localhost:5173/?ff=-tutorial   # per-visit; '-' turns one off
```

`debugTools` additionally requires `VITE_DEBUG_ALLOWED=true`, so debug surfaces cannot be switched
on in a deployed build.

## Develop

Requirements: Node 22 (`.nvmrc`), pnpm 9 (`corepack enable`).

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium   # once, for e2e
pnpm dev                                            # http://localhost:5173
pnpm verify                                         # everything CI runs
```

Where to pick up work: `HANDOFF.md`, then the first unchecked task in `PROGRESS.md`.

Individual gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm check:banned`,
`pnpm scaffold:check`, `pnpm build` (includes bundle budget), `pnpm sim:gate`.

The post-deploy smoke test can be pointed at any build:
`LIVE_URL=http://127.0.0.1:4174/JonesRemake/ pnpm exec playwright test --config playwright.live.config.ts`.

### Extending

`docs/EXTENDING.md` has ten recipes — a command, a location, an item, an event, a subscription, an
investment asset, a city pack, a language, an AI personality, a rule module — each with a tested
example under `examples/`. The v1 non-goals are typed stubs in `packages/platform`, each with a
`REPLACE ME` README naming its contract, its v1 default and what replaces it:
[identity](packages/platform/src/identity/README.md),
[transport](packages/platform/src/transport/README.md),
[matchmaker](packages/platform/src/matchmaker/README.md),
[saves](packages/platform/src/saves/README.md),
[leaderboard](packages/platform/src/leaderboard/README.md),
[telemetry](packages/platform/src/telemetry/README.md),
[platform](packages/platform/src/platform/README.md),
[entitlements](packages/platform/src/entitlements/README.md), and the
[city pack template](packages/content/packs/_template/README.md).

### Layout

| Path                | What                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `packages/shared`   | Types shared by every layer                                            |
| `packages/platform` | Provider-agnostic contracts + v1 local defaults (`REPLACE ME` stubs)   |
| `packages/content`  | CityPack Zod schemas, packs, validator CLI                             |
| `packages/engine`   | Pure, deterministic game rules (`applyCommand`), core + modern modules |
| `packages/ai`       | Utility-planner rival, personalities, difficulty tiers                 |
| `packages/sim`      | Headless balance harness + CI gates                                    |
| `apps/web`          | React + Vite SPA, SVG board, Zustand store, Playwright e2e             |
| `tools/`            | Banned-terms scan, bundle budget, scaffold check, type generator       |
| `examples/`         | Tested examples for every recipe in `docs/EXTENDING.md`                |
| `docs/`             | The spec pack (source of truth)                                        |

Dependency direction is lint-enforced: `shared ← platform`, `shared ← content ← engine ← ai ← sim`;
`apps/web` may import everything except `sim`.

### Spec pack (`docs/`)

The game is fully specified before it is built. `docs/SPEC_PACK.md` is the single imported source
(spec version: 2026-09-17, amendments folded in). Everything else under `docs/` and section 1 of
`CLAUDE.md` is **generated** from it:

```bash
python3 tools/split-spec.py   # SPEC_PACK.md → CLAUDE.md §1 + docs/*.md (keeps global section numbers)
python3 tools/gen-index.py    # docs/MILESTONES.md → docs/INDEX.md (task → cited sections)
```

| File                         | Sec | What                                                        |
| ---------------------------- | --- | ----------------------------------------------------------- |
| `CLAUDE.md`                  | 1   | Operating contract: commands, invariants, work loop         |
| `docs/PRD.md`                | 2   | Vision, goals, non-goals, locked decisions, IP safety       |
| `docs/ORIGINAL_REFERENCE.md` | 3   | Researched baseline of the 1991 original (`classic` values) |
| `docs/GDD.md`                | 4   | Authoritative game rules                                    |
| `docs/ARCHITECTURE.md`       | 5   | Packages, engine API, RNG, scheduler, save/replay, CI/CD    |
| `docs/CONTENT_SCHEMAS.md`    | 6   | CityPack files, effect DSL, placeholder visual spec         |
| `docs/UX_SPEC.md`            | 7   | Screens, HUD, tutorial, keyboard map, WCAG 2.2 AA           |
| `docs/AUDIO_SPEC.md`         | 8   | AudioBus, SFX list, procedural music                        |
| `docs/BALANCE_SPEC.md`       | 9   | Sim harness, two-stage calibration, CI gates                |
| `docs/MILESTONES.md`         | 10  | M0–M8 tasks with acceptance criteria                        |
| `docs/TEMPLATES.md`          | 11  | Shapes of the living files at repo root                     |
| `docs/EXTENSIBILITY.md`      | 12  | Rule modules, command registry, flags, overlays, v2 seams   |
| `docs/STATE_MODEL.md`        | 13  | Integer numerics, PlayerState, ErrorCode, DomainEvent       |
| `docs/SEED_DATA.md`          | 14  | Concrete classic job/item/event/market tables               |
| `docs/BUILD_READINESS.md`    | 15  | Root toolchain files, scripts, seeds, CI budgets            |
| `docs/ROADMAP_SCAFFOLDS.md`  | 16  | v1 non-goals as stubs, multi-city world, MMO + leaderboard  |
| `docs/INDEX.md`              | —   | Task → cited sections (generated)                           |

Precedence when docs conflict: GDD > STATE_MODEL > BALANCE_SPEC > EXTENSIBILITY > ROADMAP_SCAFFOLDS >
ARCHITECTURE > CONTENT_SCHEMAS > UX_SPEC > SEED_DATA > ORIGINAL_REFERENCE > BUILD_READINESS > PRD.

### What the scaffold enforces

- **Pure engine.** `packages/engine` may not touch DOM, clock, `Math.random()` or I/O (lint rules + fixture test).
- **Dependency direction.** `eslint-plugin-boundaries` fails the build on an import against the layer rule.
- **Coverage gates.** engine 90/85, ai 80/70, content 90/80, web 60/50 (lines/branches) — `pnpm test` fails below.
- **IP safety.** `pnpm check:banned` scans code, content and docs for the original game's names and real brands.
- **Bundle budget.** Initial JS+CSS ≤ 350 kB gzip; music engine must be a lazy chunk.
- **Accessibility.** Playwright runs axe (WCAG 2.2 AA) on desktop / tablet / phone viewports.
- **Stubs stay honest.** Every v1 non-goal lives in `packages/platform/<area>/` behind a typed contract with a
  `REPLACE ME` README and a contract test; `pnpm scaffold:check` fails if either is missing.
- **Determinism.** Same seed + same command log ⇒ identical `stateHash` (tests from M1 on).

### Working with an autonomous agent

`CLAUDE.md` is the operating contract. To hand the repo to Claude Code:

```text
Read CLAUDE.md and execute the plan in docs/MILESTONES.md from M0 to M8 without asking questions.
```

Progress, decisions and known issues live in `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`.
Scaffold-time deviations from the spec are ADR-0001…0005 in `DECISIONS.md`.

## Contributing

See `CONTRIBUTING.md`. Bug reports and proposals go through the issue templates. Security issues:
`SECURITY.md`.

## License

MIT — see `LICENSE`. The license covers this repository's own code, content and assets only.
