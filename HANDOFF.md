# Handoff

State of the build at the end of M8 (release) on `claude/blissful-maxwell-isum6e`, PR #18. Read
`CLAUDE.md` first, then this file. Every task in `PROGRESS.md` is ticked except the M8 gate row,
which closes when the PR merges.

## Where the build is

| Area            | State                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| Engine          | 0.3.0. Layoff grace (ADR-0047) and graduate entry (ADR-0050) are the last rule changes |
| Content         | `classic` and `modern-western` 0.3.0, retuned for the fixed AI (ADR-0049)              |
| AI              | The M8.0e defects fixed (see `BALANCE_REPORT.md`, _How M8 got there_)                  |
| Classic balance | Stage 1 re-run: every 9.3 target met but sim speed (`BASELINE_REPORT.md`)              |
| Modern balance  | Stage 2: every locked 9.5 target met but sim speed; targets re-locked by ADR-0048      |
| CI gates        | `sim/gates.json` has no `pending` assertion; `pnpm sim:gate --strict` is the bar       |
| Web             | Leaderboard and Stats board, tutorial fixes, HUD wrapping; e2e matrix and regression   |
| Deploy          | `deploy.yml` deploys, smoke-tests the live URL and rolls back on failure (ADR-0045)    |
| Open issues     | KI-010 (sim speed, out of scope) and KI-011 (Easy AI stalls at high goals), both minor |

## What the owner does to release

1. Mark PR #18 reviewed and merge it with a **merge commit** (ADR-0038), not a squash.
2. Watch the `deploy` workflow on `main`: deploy, then the live smoke test. A failed smoke test
   rolls the site back and opens an issue; the first run has no earlier build to roll back to.
3. Push the tags the session cannot push (KI-001), from a clone with tag rights:

   ```bash
   sh tools/retag-milestones.sh                 # m1–m7 onto their main commits
   git tag -a m8 <merge-sha> -m m8
   git tag -a v1.0.0 <merge-sha> -m v1.0.0
   git push origin m8 v1.0.0
   ```

4. Record the merge commit and CI run in the PROGRESS gate log (M8 row) and tick the M8 gate.

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
