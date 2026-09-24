# Handoff

State of the build during M9 (scene UI and art sets). v1.0.0 is `main` @ 03caf07; M9.1–M9.8 merged
as PR #20, M9.9–M9.13 are on `claude/stoic-goldberg-yr35m8`. Read `CLAUDE.md` first, then this
file; `PROGRESS.md` has the task notes and the gate log, `docs/ART_SPEC.md` the M9 contract.

## Resume point: the M9 gate

Every M9 task is done; the gate is not. It needs:

1. `sceneUi` on by default (`apps/web/src/flags/appFlags.ts`). The ring-UI e2e specs then need
   `?ff=-sceneUi` (or scene equivalents) while the ring still exists; `e2e/scene.spec.ts`,
   `artpacks.spec.ts` and `offline.spec.ts` already cover the scene on three viewports.
2. `pnpm verify` green in CI, then tag `m9` (tags still need the owner, KI-001).
3. The milestone after M9 deletes the ring board (`ui/game/Board.tsx`) and the flag (17.9).

KI-012 (chance-denied rent extension read as a rejection) is fixed (ADR-0059).

## M9 at a glance

| Area        | Where                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Contract    | `docs/ART_SPEC.md` (SPEC_PACK §17), ADR-0051…0058                                        |
| Art sets    | `packages/art` (schema, catalog, sanitizer, tint, validator), `sets/default/`            |
| Default art | `tools/art-default/` + `pnpm art:draw`; hand-drawn files are never overwritten           |
| Web         | `apps/web/src/assets/art/` (registry, theme, prefetch, import), `apps/web/src/ui/scene/` |
| Offline     | `apps/web/sw/template.js` + the `hustle-ring-sw` plugin in `vite.config.ts`              |
| User packs  | Settings → Art packs; stored by `packages/platform/src/artpacks` (IndexedDB)             |
| Checks      | `pnpm art:check [--report]`, `pnpm budget` (JS 350 kB, art 1536 kB), e2e scene specs     |

## Where the build is (v1.0.0)

| Area            | State                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Release         | v1.0.0 = `main` @ 03caf07; engine 0.3.0, `classic` and `modern-western` content 0.3.0    |
| Classic balance | Stage 1: every 9.3 target met but sim speed (`BASELINE_REPORT.md`)                       |
| Modern balance  | Stage 2: every locked 9.5 target met but sim speed; targets locked by ADR-0048           |
| CI gates        | `sim/gates.json` has no `pending` assertion; `pnpm sim:gate --strict` passes             |
| Web             | Both rulesets playable; leaderboard, tutorial, audio, saves, themes, a11y                |
| Deploy          | `deploy.yml` deploys after CI on `main`, smoke-tests the live URL, rolls back on failure |
| Open issues     | KI-010 (sim speed, out of scope) and KI-011 (Easy AI stalls at high goals), both minor   |

## Still to do by the owner

The build session cannot push tags (KI-001). From a clone with tag rights:

```bash
sh tools/retag-milestones.sh   # m1–m7 onto their main commits, m8 and v1.0.0 onto 03caf07
```

PR #18 was squash-merged although ADR-0038 asked for a merge commit, so its branch commits are
not on `main`; 03caf07 is the first `main` commit containing the M8 gate, which is what the tags
point at. Nothing else depends on the merge method.

## Reproducing the measurements

```bash
pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 4 --out reports/stage1 && pnpm baseline   # ~2 h
pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 4 --out reports/stage2                    # ~18 min
pnpm sim:gate --strict                                                                                    # what CI asserts
```

Changing `reports/baseline.json` fails `tools/lib/targets.test.ts` until the modern targets are
re-derived and re-locked with a new ADR (the ADR-0042 → ADR-0048 procedure).

## After 1.0

- KI-010: the planner's beam search costs 3–12 s per simulated game; memoised previews would bring
  the sim-speed target in reach.
- KI-011: the Easy AI stalls in 11–24% of 2-seat games at goals 80–100.
- League scopes are reserved in the leaderboard contract and hold nothing locally (ADR-0037 kept the
  league UI out of scope).
- Future work lands on a fresh branch from `main`; see `CLAUDE.md` 1.6 for the per-task loop.
