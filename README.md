# Hustle Ring (working title)

A modern, browser-based remake of a 1991 life-sim board game: race rivals around a ring of
city locations, juggling money, career, education and happiness in weekly turns. Built as a clean-room
reimplementation with original names, art and text — see `docs/PRD.md` §2.6 for the IP-safety rules.

**Status:** M0 scaffold. The game itself lands milestone by milestone (`docs/MILESTONES.md`, M0→M8).
Live build: https://swlong82.github.io/JonesRemake/ (GitHub Pages; `deploy.yml` runs after CI on `main`).

## Play

Nothing playable yet — the title page is a placeholder. When M4 lands: open the Pages URL, pick a
city pack, choose seats (solo vs AI, or local hotseat), set goal levels, and play weekly turns until
someone meets all four goals. Full rules: `docs/GDD.md`.

## Develop

Requirements: Node 22 (`.nvmrc`), pnpm 9 (`corepack enable`).

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium   # once, for e2e
pnpm dev                                            # http://localhost:5173
pnpm verify                                         # everything CI runs
```

Individual gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm check:banned`,
`pnpm scaffold:check`, `pnpm build` (includes bundle budget), `pnpm sim:gate`.

### Layout

| Path                | What                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `packages/shared`   | Types shared by every layer                                          |
| `packages/platform` | Provider-agnostic contracts + v1 local defaults (`REPLACE ME` stubs) |
| `packages/content`  | CityPack Zod schemas, packs, validator CLI                           |
| `packages/engine`   | Pure, deterministic game rules (`applyCommand`)                      |
| `packages/ai`       | Utility-planner rival, personalities, difficulty tiers               |
| `packages/sim`      | Headless balance harness + CI gates                                  |
| `apps/web`          | React + Vite SPA, SVG board, Zustand store, Playwright e2e           |
| `tools/`            | Banned-terms scan, bundle budget, scaffold check, type generator     |
| `docs/`             | The spec pack (source of truth)                                      |

Dependency direction is lint-enforced: `shared ← platform`, `shared ← content ← engine ← ai ← sim`;
`apps/web` may import everything except `sim`.

### Working with an autonomous agent

`CLAUDE.md` is the operating contract. To hand the repo to Claude Code:

```text
Read CLAUDE.md and execute the plan in docs/MILESTONES.md from M0 to M8 without asking questions.
```

Progress, decisions and known issues live in `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`.

## Contributing

See `CONTRIBUTING.md`. Bug reports and proposals go through the issue templates. Security issues:
`SECURITY.md`.

## License

MIT — see `LICENSE`. The license covers this repository's own code, content and assets only.
