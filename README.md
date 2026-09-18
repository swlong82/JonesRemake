# Hustle Ring (working title)

A modern, browser-based remake of a 1991 life-sim board game: race rivals around a ring of
city locations, juggling money, career, education and happiness in weekly turns. Built as a clean-room
reimplementation with original names, art and text — see `docs/PRD.md` §2.6 for the IP-safety rules.

**Status:** the classic ruleset is playable end to end in the browser — engine, classic content, AI
rival, balance harness and the full web UI (ring board, HUD, location panel with action previews,
event cards, log, phone layout, keyboard map, end screen) — and its balance baseline is measured and
closed. The modern systems (wellbeing, transport, gig work, subscriptions, online study, delivery,
rent hikes, loans, modern instruments) are implemented behind CityPack feature flags, which
`modern-western` turns on and `classic` leaves off; that pack still needs its own names, flavour and
balance pass (M6). The game lands milestone by milestone (`docs/MILESTONES.md`, M0→M8); this
README's status line, `PROGRESS.md` and `HANDOFF.md` are updated per milestone.
Live build: https://swlong82.github.io/JonesRemake/ (GitHub Pages; `deploy.yml` runs after CI on `main`).

| Milestone | Scope                                   | Status |
| --------- | --------------------------------------- | ------ |
| M0        | Scaffold, CI, Pages deploy, spec pack   | done   |
| M1        | Engine core (state, RNG, commands)      | done   |
| M2        | Classic content pack + AI rival         | done   |
| M3        | Sim harness + classic baseline          | done   |
| M4        | Web UI, classic playable                | done   |
| M5        | Modern systems (transport, gigs, loans) | done   |
| M6        | Modern pack + balance                   | —      |
| M7        | Polish: audio, save/replay, a11y        | —      |
| M8        | Release: naming, leaderboard, docs      | —      |

## Play

Open the Pages URL, press **New Game**, pick a city pack, choose seats (solo against an AI rival, or
local hotseat up to four), set each goal level, and play weekly turns until someone meets all four
goals. Full rules: `docs/GDD.md`.

Two rulesets ship. **Classic** is the balanced one: sixteen locations, a job ladder, eleven degrees,
a bounded market and weekend events. **Modern western** adds wellbeing, travel modes and cars, gig
shifts, subscriptions that bill weekly and drift upward, online study you can doomscroll away,
delivery, rent hikes, loans and six correlated instruments — all of it working, none of it balanced
or renamed yet (M6), so treat it as a preview.

Each turn is one week of 60 hours. Click a ring square to open the travel sheet, **Enter** a
location to use it, and pick actions from the panel — every action shows its cost and effect before
you commit (`−6h · +$96 · Dependability +2`). Keyboard: `1`–`9`, `0`, `Q W E R T Y` travel to the
square with that badge, `Enter` confirms, `L` the event log, `G` standings, `H` help, `Shift+E` ends
the turn. Saves arrive in M7; the end screen exports a replay (seed + command log) you can keep.

### Feature flags

Screens that are specified but not built are gated by app feature flags
(`apps/web/src/flags/appFlags.ts`, ADR-0017) — separate from the CityPack feature flags that gate
rules per ruleset. All default off and each names the milestone that lands it; the flag is deleted
when its milestone lands, as `gameBoard` and `endScreen` were in M4. What is left: `saves` (M7.2),
`tutorial` (M7.3), `audio` (M7.1), `leaderboard` (M8.1) and `debugTools` (UX 7.9). Override for
local development with a build env var or a query string:

```bash
VITE_FF_AUDIO=on pnpm dev     # build-time
# http://localhost:5173/?ff=audio,-saves   # per-visit; '-' turns one off
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
