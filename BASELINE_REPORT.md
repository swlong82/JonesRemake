# Baseline report — classic

Stage-1 suite (BALANCE_SPEC 9.3) for pack `classic`, engine 0.2.0.
25 configs, 3400 games, generated 2026-09-23 by
`pnpm baseline` from `reports/stage1/*/summary.json`. Machine-readable copy:
`reports/baseline.json`. Game counts are reduced per ADR-0016, so rates carry roughly ±3–5 pp
of sampling error and medians ±2 weeks.

Measurement conditions: 2 sim workers on a shared 4-core sandbox, other build tasks running. Only `ms/game` depends on them; every other
metric is deterministic for these seeds.

## B(metric, config)

| Config                         | Games | Weeks p10/median/p90 | Stall % | Seat 0 win % | Bankrupt % | Degrees median | Last goal % (W/H/E/C)       | ms/game |
| ------------------------------ | ----- | -------------------- | ------- | ------------ | ---------- | -------------- | --------------------------- | ------- |
| `classic-30-easy-2`            | 100   | 59 / 109 / 224       | 19      | 50.62        | 100        | 4              | W6.79 H78.4 E11.73 C3.09    | 1660    |
| `classic-30-easy-4`            | 100   | 56 / 95 / 202        | 11      | 24.72        | 100        | 3              | W6.18 H77.53 E16.29 C0      | 3024    |
| `classic-30-normal-2`          | 200   | 29 / 30 / 37         | 0       | 40           | 93.5       | 4              | W1.5 H23.08 E36.08 C39.33   | 1446    |
| `classic-30-normal-4`          | 200   | 29 / 30 / 33         | 0       | 19           | 98.5       | 3              | W4.25 H12.92 E39.5 C43.33   | 2047    |
| `classic-30-hard-2`            | 100   | 29 / 29 / 31         | 0       | 44           | 42         | 4              | W0 H8.83 E15.33 C75.83      | 2445    |
| `classic-30-hard-4`            | 100   | 29 / 29 / 29         | 0       | 45           | 67         | 4              | W0.33 H3 E5.33 C91.33       | 4619    |
| `classic-50-easy-2`            | 100   | 90 / 148 / 273       | 24      | 30.26        | 100        | 6              | W11.84 H84.21 E3.95 C0      | 2376    |
| `classic-50-easy-4`            | 100   | 92 / 145 / 229       | 7       | 16.13        | 100        | 5              | W13.26 H79.93 E6.81 C0      | 3525    |
| `classic-50-normal-2`          | 200   | 37 / 43 / 61         | 0.5     | 26.63        | 96         | 6              | W18.01 H35.01 E24.96 C22.03 | 2143    |
| `seatbias-classic-50-normal-2` | 200   | 38 / 41 / 63         | 0       | 47.5         | 89.5       | 6              | W13.17 H19.92 E53.17 C13.75 | 1553    |
| `classic-50-normal-4`          | 200   | 37 / 40 / 55         | 0       | 18.5         | 100        | 5              | W20.08 H21.08 E35.75 C23.08 | 3718    |
| `classic-50-hard-2`            | 100   | 37 / 37 / 40         | 0       | 27           | 66         | 6              | W4.5 H3.5 E15 C77           | 4612    |
| `classic-50-hard-4`            | 100   | 37 / 37 / 38         | 0       | 22           | 83         | 6              | W2 H3 E10.5 C84.5           | 6301    |
| `classic-80-easy-2`            | 100   | 200 / 251 / 293      | 63      | 24.32        | 100        | 8              | W47.3 H52.7 E0 C0           | 3018    |
| `classic-80-easy-4`            | 100   | 173 / 253 / 293      | 41      | 8.47         | 100        | 8              | W47.46 H52.54 E0 C0         | 7540    |
| `classic-80-normal-2`          | 200   | 56 / 73 / 109        | 1       | 27.78        | 99         | 9              | W25.17 H47.14 E19.61 C8.08  | 2979    |
| `classic-80-normal-4`          | 200   | 55 / 64 / 81         | 0       | 18           | 100        | 7              | W25.75 H36.25 E33.75 C4.25  | 4398    |
| `classic-80-hard-2`            | 100   | 49 / 49 / 60         | 0       | 45           | 72         | 9              | W23.83 H2.33 E22.33 C51.5   | 4311    |
| `classic-80-hard-4`            | 100   | 49 / 49 / 52         | 0       | 36           | 93         | 9              | W17 H0.5 E24 C58.5          | 10670   |
| `classic-100-easy-2`           | 100   | 256 / 256 / 256      | 99      | 0            | 100        | 8              | W0 H50 E0 C50               | 2959    |
| `classic-100-easy-4`           | 100   | 287 / 292 / 299      | 97      | 0            | 100        | 8              | W50 H33.33 E0 C16.67        | 6987    |
| `classic-100-normal-2`         | 200   | 71 / 92 / 148        | 0.5     | 28.64        | 100        | 11             | W34.67 H48.16 E10.64 C6.53  | 4764    |
| `classic-100-normal-4`         | 200   | 71 / 87 / 125        | 0       | 18.5         | 100        | 8              | W34.46 H47.04 E11.54 C6.96  | 8131    |
| `classic-100-hard-2`           | 100   | 57 / 59 / 70         | 0       | 35           | 74         | 11             | W49.25 H27.75 E6.92 C16.08  | 7348    |
| `classic-100-hard-4`           | 100   | 57 / 58 / 67         | 0       | 31           | 94         | 10             | W50 H18.67 E9.5 C21.83      | 12092   |

## Stage-1 sanity gates (9.3)

| Gate                                                | Target                    | Achieved                      | Result                                                                                      |
| --------------------------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Stall rate at goals 50 Normal×2                     | < 0.5%                    | 0.5%                          | FAIL                                                                                        |
| Median length grows with goal level                 | 30 < 50 < 80 < 100        | 30 < 43 < 73 < 92             | pass                                                                                        |
| Seat bias Normal×2 (goals 50, Balanced vs Balanced) | first seat 45–55%         | 47.5%                         | pass                                                                                        |
| Goal last-completed: wealth (goals 50)              | ≥ 10% of games            | 18.01%                        | pass                                                                                        |
| Goal last-completed: happiness (goals 50)           | ≥ 10% of games            | 35.01%                        | pass                                                                                        |
| Goal last-completed: education (goals 50)           | ≥ 10% of games            | 24.96%                        | pass                                                                                        |
| Goal last-completed: career (goals 50)              | ≥ 10% of games            | 22.03%                        | pass                                                                                        |
| Sim speed, Normal AI                                | < 200 ms/game median      | 8131 ms (worst Normal config) | FAIL — ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead. |
| Education path completes at goals 100               | ≥ 99% of stall-free games | 100%                          | pass                                                                                        |

## Unmet targets

- **Stall rate at goals 50 Normal×2** — target < 0.5%, achieved 0.5%.
- **Sim speed, Normal AI** — target < 200 ms/game median, achieved 8131 ms (worst Normal config).

Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in
`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).
