# 9. docs/BALANCE_SPEC.md

Balance is proven by simulation, never by feel. Stage 1 measures the classic baseline; stage 2 tunes modern relative to it.

## 9.1 Sim harness

```bash
pnpm sim -- --pack classic --games 10000 --seats 2 --ai normal,normal --goals 50 --seed-base baseline --out reports/classic-50
pnpm sim -- --config sim/gates.json --games 1000   # used by sim:gate
```

- Runs in Node worker threads (parallel = CPU count). Each game: seeds `"<seedBase>-<i>"`, AI for all seats, stop at winner or week 300 (stall).
- Outputs per config: `summary.json` (metrics below), `games.csv` (one row per game), `report.md` (tables + ASCII histograms).
- Deterministic: same args → byte-identical `summary.json` (test).

## 9.2 Metrics collected

Game length in weeks (min, p10, median, p90, max); winner seat distribution; winner personality/difficulty; goal completion order (which goal completed last); stall rate; bankruptcy rate (cash+bank < 0 for 4 weeks or eviction); job-tier histogram at end; degrees at end; wealth trajectory p50 by week; events fired per 100 weeks by family; wellbeing band time share [modern]; collapse rate [modern]; loan default rate [modern]; per-strategy win rates (scripted strategy bots, 9.4); sim speed ms/game.

## 9.3 Stage 1 — classic baseline (M3)

Configs: goals {30, 50, 80, 100} (all four equal) × AI {Easy, Normal, Hard} self-play pairs × seats {2, 4}. Output `BASELINE_REPORT.md`.

Stage-1 sanity gates (MUST pass before stage 2; tune [ASSUMED] classic values only):

| Gate | Target |
| --- | --- |
| Stall rate at goals 50 Normal×2 | < 0.5% |
| Median length grows monotonically with goal level | 30 < 50 < 80 < 100 |
| Seat bias Normal×2 | first seat win 45–55% |
| Hard vs Easy | Hard wins ≥ 80% |
| Each goal is last-completed | ≥ 10% of games at goals 50 |
| Sim speed | < 200 ms/game median with Normal AI; Hard-AI games ≤ 120 s/game (sim runs Hard in worker threads; excluded from CI gate) |
| Education-only degree path completes in stall-free games at goals 100 | ≥ 99% |

After gates pass, CC freezes classic numbers (git tag `baseline-frozen`) and records baseline values B(metric, config) in `BASELINE_REPORT.md` and machine-readable `reports/baseline.json`.

## 9.4 Strategy bots (for exploit detection)

Scripted bots implemented in `packages/sim/bots`: `GigOnly` (never regular job), `CryptoAllIn` (all spare cash to crypto), `StudyFirst` (all degrees before work), `NoRelax` (never relaxes), `DeliveryOnly` (never groceries), `LoanMax` (max loan, invest in ETF). Each plays vs Normal Balanced AI, 1,000 games at goals 50.

## 9.5 Stage 2 — modern targets (M6)

Before tuning, CC writes `reports/modern-targets.json` derived from baseline and MUST NOT edit it after first commit (enforced by test comparing file hash to the one recorded in `DECISIONS.md`).

| Gate | Target |
| --- | --- |
| Median length at each goal level | within ±20% of classic B |
| Stall rate | < 0.5% |
| Seat bias | 45–55% |
| Hard vs Easy | ≥ 80% |
| Each goal last-completed | ≥ 10% |
| GigOnly win rate vs Normal | < 25% |
| CryptoAllIn bankruptcy rate | > 40% and win rate 15–40% |
| StudyFirst win rate | 30–60% (viable, not dominant) |
| NoRelax collapse rate | ≥ 60% of games have ≥ 1 collapse |
| Normal Balanced AI collapse | 15–40% of games have ≥ 1 collapse |
| LoanMax default rate | 20–60% |
| No bot beats Normal Balanced > 60% | all bots |
| Every modern event family fires | ≥ 1 per 100 player-weeks at Chaos Modern |
| Sim speed | < 200 ms/game median with Normal AI; Hard-AI games ≤ 120 s/game (sim runs Hard in worker threads; excluded from CI gate) |

## 9.6 Tuning protocol

1. Run full 10,000-game suite; write `BALANCE_REPORT.md` iteration entry (date, commit, failing gates, values).
2. Change at most 3 content constants per iteration; log each with rationale.
3. Only content (`modern-western` overrides) may change; engine logic changes require an ADR.
4. Stop when all gates pass; if 15 iterations fail to converge, apply stuck policy: record best iteration, mark failing gates in `KNOWN_ISSUES.md`, proceed.

## 9.7 CI gate (`sim:gate`)

`sim/gates.json` lists 8 configs × 1,000 games covering all stage-2 gates with tolerances widened by ±3 percentage points for sampling noise. Runtime budget in CI ≤ 6 minutes.
