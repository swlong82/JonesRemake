# Handoff

State of the build after M13 (playability and information pass). v1.0.0 is `main` @ 03caf07; M9,
M11 and M12 are merged to `main`; M13 is PR #31 on `claude/quirky-wright-d6pdmc`. Read `CLAUDE.md`
first, then this file; `PROGRESS.md` has the task notes and the gate log, `docs/ART_SPEC.md` the M9
contract and `docs/UX_SPEC.md` §7.10 the M11–M13 behaviour.

## Resume point: M10

The scene UI is the default (ADR-0060). M10 retires the ring board and is still open:

1. Port the e2e specs still pinned to `?ff=-sceneUi` — `game`, `matrix`, `regression` — to the scene (the `hud()` locator helper in `tutorial.spec.ts` is the pattern).
2. Delete `ui/game/Board.tsx`, the phone mini ring and the `sceneUi` flag; the location list stays.
3. `pnpm verify` green in CI; tag `m9`, `m10` (and later `m11`–`m13`) — tags still need the owner (KI-001).

## M11–M13 at a glance

| Area          | Where                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Contract      | `docs/UX_SPEC.md` §7.10, ADR-0061 (M11), ADR-0062 (M12), ADR-0063 (M13)                      |
| Pop-ups       | `ui/game/outcomes.ts` + `OutcomeModal`, `outcomes` queue and `popups` setting in `gameStore` |
| Info cards    | `ui/game/info.ts` (pure readers) + `InfoModal`, `InfoButtons`; `openInfo` in `gameStore`     |
| Confirmations | `confirmPending`, `CONFIRM_COMMANDS` and `ConfirmModal`; skipped while the tutorial runs     |
| Quick travel  | `quickTravel` in `gameStore`, `onDoubleClick` on the scene board, ring board and phone list  |
| Log           | `ui/game/logFilter.ts` (categories, icons) + `LogDrawer` filters                             |
| Tests         | `store/m13.test.ts`, `ui/game/m13.test.tsx`, `e2e/m13.spec.ts` (three viewports, axe)        |

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
| Web             | Both rulesets playable; scene UI, offline, art packs; M11–M13 UX (pop-ups, cards, undo)  |
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
