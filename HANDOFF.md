# Handoff

State of the build after M8 (release). PR #18 merged to `main` as **03caf07** (squash), which is
v1.0.0. Read `CLAUDE.md` first, then this file. Every milestone M0–M8 is done; `PROGRESS.md` has
the gate log.

## Where the build is

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
