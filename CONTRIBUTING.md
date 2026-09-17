# Contributing

Thanks for helping build the game. This repo is designed to be built largely by an autonomous coding
agent following `CLAUDE.md`; humans contribute the same way the agent does, so the rules below apply to both.

## Ground rules

- Read `CLAUDE.md` first. Its invariants (pure engine, content-driven rules, deterministic replay,
  i18n keys everywhere, banned terms) are non-negotiable and enforced by `pnpm verify`.
- The spec pack in `docs/` is the source of truth. If the spec is silent, pick the simplest option
  consistent with `docs/GDD.md` and record an ADR in `DECISIONS.md`. If the spec is wrong, change the spec
  in the same PR and say so in the description.
- Precedence when docs conflict: GDD > STATE_MODEL > BALANCE_SPEC > ARCHITECTURE > CONTENT_SCHEMAS >
  UX_SPEC > ORIGINAL_REFERENCE > SEED_DATA > PRD; EXTENSIBILITY and ROADMAP_SCAFFOLDS after those.
- IP safety: no names, art, audio or text from the original game or from real brands. `pnpm check:banned`
  fails the build on any hit. Parody names must be clearly distinct.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm verify
```

Node 22 (`.nvmrc`) and pnpm 9 (`packageManager` in `package.json`) are required.

## Workflow

1. Branch from `main`: `feat/<milestone>-<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
2. Tests first: every acceptance criterion in `docs/MILESTONES.md` maps to at least one automated test.
3. Run the narrowest relevant command while iterating, then `pnpm verify` before opening a PR.
4. Tick the task in `PROGRESS.md` with a one-line note.
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(engine): ...`,
   `fix(web): ...`, `docs: ...`, `chore(ci): ...`. Scopes: `engine`, `content`, `ai`, `sim`, `web`,
   `platform`, `shared`, `tools`, `ci`, `docs`.
6. Open a PR using the template. CI must be green; one approval required on `main`.

## Layout

See `docs/ARCHITECTURE.md` §5.1. Dependency rule (lint-enforced):
`shared ← platform`, `shared ← content ← engine ← ai ← sim`; `apps/web` depends on everything except `sim`.

## Reporting bugs and proposing features

Use the issue templates. For balance issues include the seed and pack id so the sim can reproduce it.

## Code of conduct

By participating you agree to `CODE_OF_CONDUCT.md`.
