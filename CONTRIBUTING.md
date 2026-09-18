# Contributing

Thanks for helping build the game. This repo is designed to be built largely by an autonomous coding
agent following `CLAUDE.md`; humans contribute the same way the agent does, so the rules below apply to both.

## Ground rules

- Read `CLAUDE.md` first. Its invariants (pure engine, content-driven rules, deterministic replay,
  i18n keys everywhere, banned terms) are non-negotiable and enforced by `pnpm verify`.
- The spec pack in `docs/` is the source of truth. If the spec is silent, pick the simplest option
  consistent with `docs/GDD.md` and record an ADR in `DECISIONS.md`. If the spec is wrong, change the spec
  in the same PR and say so in the description.
- Precedence when docs conflict (docs/README.md §0): GDD > STATE_MODEL > BALANCE_SPEC > EXTENSIBILITY >
  ROADMAP_SCAFFOLDS > ARCHITECTURE > CONTENT_SCHEMAS > UX_SPEC > SEED_DATA > ORIGINAL_REFERENCE >
  BUILD_READINESS > PRD.
- Spec edits go into `docs/SPEC_PACK.md`, then `python3 tools/split-spec.py && python3 tools/gen-index.py`.
  The split files under `docs/` and `CLAUDE.md` §1 are generated; a PR that hand-edits them is bounced.
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

## Adding a rule, a system or a pack

Rules and numbers live in content, never in engine code (`CLAUDE.md` §1.3). In practice:

- **A new number** → the CityPack rules schema plus each pack's `rules.json`. Give it a default so
  packs that do not set it are unchanged.
- **A new command** → one handler file plus one line in the owning module's `commands` array, then
  `pnpm gen:types` (it scans `packages/engine/src/commands/*.ts` and `packages/engine/src/modules/*.ts`,
  and CI checks the generated union is current).
- **A new system** → a `RuleModule` in `packages/engine/src/modules/` with its own `flag`, `stateSlice`
  and commands, added to `MODERN_MODULES` (order 100–199; core is 0–99). `createEngine` drops it for a
  pack whose flag is off, so the UI needs no gating of its own: the location panel renders whatever
  `candidateCommands` returns. Read another module's state only through the selectors it exports.
- **New pack content** → the JSON file, its i18n keys, its `assets.registry.json` entry, **and** an
  entry in `packages/content/src/packs.ts`. The pack registry is a static import list; a file that is
  not listed there is silently ignored.

Two invariants worth repeating because they fail loudly and late:

- `cost()` and `validate()` must not draw from the RNG — they run inside `legalCommands` and
  `previewCommand`, which are pure, and a draw there breaks replay determinism. Roll a price a preview
  must show at turn start into the module's slice; apply a risk that lands afterwards in `apply` or on
  the event, and report it as `riskBp` in the preview (ADR-0028).
- Any rule or content change moves the golden replays. Regenerate them deliberately with
  `UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts --root packages/engine` and say why in the commit
  — an unexplained golden churn is the review's cue that something changed that should not have.

## Reporting bugs and proposing features

Use the issue templates. For balance issues include the seed and pack id so the sim can reproduce it.

## Code of conduct

By participating you agree to `CODE_OF_CONDUCT.md`.
