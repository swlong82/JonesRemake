# Baseline report — classic

Stage-1 suite (BALANCE_SPEC 9.3) for pack `classic`, engine 0.2.0.
24 configs, 3200 games, generated 2026-09-23 by
`pnpm baseline` from `reports/stage1/*/summary.json`. Machine-readable copy:
`reports/baseline.json`. Game counts are reduced per ADR-0016, so rates carry roughly ±3–5 pp
of sampling error and medians ±2 weeks.

Measurement conditions: 2 sim workers on a shared 4-core sandbox, other build tasks running. Only `ms/game` depends on them; every other
metric is deterministic for these seeds.

## B(metric, config)

| Config                 | Games | Weeks p10/median/p90 | Stall % | Seat 0 win % | Bankrupt % | Degrees median | Last goal % (W/H/E/C)       | ms/game |
| ---------------------- | ----- | -------------------- | ------- | ------------ | ---------- | -------------- | --------------------------- | ------- |
| `classic-30-easy-2`    | 100   | 60 / 126 / 246       | 66      | 58.82        | 100        | 4              | W13.24 H75 E11.76 C0        | 2543    |
| `classic-30-easy-4`    | 100   | 61 / 108 / 234       | 36      | 25           | 100        | 4              | W18.75 H65.63 E12.5 C3.13   | 3609    |
| `classic-30-normal-2`  | 200   | 29 / 36 / 74         | 1       | 58.59        | 98         | 4              | W8.5 H35.1 E35.44 C20.96    | 989     |
| `classic-30-normal-4`  | 200   | 29 / 32 / 53         | 0       | 30.5         | 100        | 3              | W6.75 H25.92 E45.67 C21.67  | 1660    |
| `classic-30-hard-2`    | 100   | 29 / 29 / 33         | 0       | 42           | 58         | 4              | W8.17 H15.5 E13.67 C62.67   | 2010    |
| `classic-30-hard-4`    | 100   | 29 / 29 / 31         | 0       | 36           | 81         | 4              | W0.5 H13.33 E8.33 C77.83    | 3883    |
| `classic-50-easy-2`    | 100   | 101 / 161 / 252      | 71      | 62.07        | 100        | 6              | W8.62 H86.21 E5.17 C0       | 2413    |
| `classic-50-easy-4`    | 100   | 101 / 139 / 220      | 50      | 18           | 100        | 6              | W12 H68 E19 C1              | 5065    |
| `classic-50-normal-2`  | 200   | 37 / 48 / 76         | 1       | 44.95        | 96         | 6              | W13.72 H32.41 E31.9 C21.97  | 1249    |
| `classic-50-normal-4`  | 200   | 37 / 40 / 53         | 0       | 18           | 100        | 5              | W8 H22 E44.33 C25.67        | 2078    |
| `classic-50-hard-2`    | 100   | 37 / 37 / 41         | 0       | 50           | 77         | 6              | W3.83 H5.17 E16.67 C74.33   | 2518    |
| `classic-50-hard-4`    | 100   | 37 / 37 / 38         | 0       | 39           | 88         | 6              | W2.33 H2.5 E11.33 C83.83    | 4989    |
| `classic-80-easy-2`    | 100   | 155 / 234 / 259      | 93      | 57.14        | 100        | 8              | W14.29 H71.43 E14.29 C0     | 2218    |
| `classic-80-easy-4`    | 100   | 180 / 241 / 296      | 94      | 50           | 100        | 8              | W8.33 H83.33 E8.33 C0       | 5278    |
| `classic-80-normal-2`  | 200   | 51 / 63 / 106        | 2       | 39.8         | 95.5       | 9              | W40.73 H28.49 E25.17 C5.61  | 1624    |
| `classic-80-normal-4`  | 200   | 50 / 60 / 85         | 0       | 17           | 100        | 7              | W41.75 H14.83 E33.25 C10.17 | 3169    |
| `classic-80-hard-2`    | 100   | 49 / 50 / 86         | 9       | 58.24        | 75         | 9              | W9.34 H9.34 E19.78 C61.54   | 3717    |
| `classic-80-hard-4`    | 100   | 49 / 49 / 54         | 0       | 34           | 89         | 9              | W2 H4 E16.5 C77.5           | 6786    |
| `classic-100-easy-2`   | 100   | 213 / 288 / 288      | 98      | 50           | 100        | 9              | W0 H100 E0 C0               | 2018    |
| `classic-100-easy-4`   | 100   | 0 / 0 / 0            | 100     | 0            | 100        | 8              | W0 H0 E0 C0                 | 4875    |
| `classic-100-normal-2` | 200   | 66 / 86 / 124        | 3       | 27.32        | 99         | 11             | W45.88 H30.58 E12.46 C11.08 | 2166    |
| `classic-100-normal-4` | 200   | 64 / 81 / 112        | 0.5     | 12.56        | 100        | 9              | W48.16 H25.71 E16.25 C9.88  | 4246    |
| `classic-100-hard-2`   | 100   | 57 / 61 / 90         | 0       | 43           | 70         | 11             | W24 H22.17 E3.5 C50.33      | 4197    |
| `classic-100-hard-4`   | 100   | 57 / 58 / 69         | 0       | 30           | 85         | 11             | W23.5 H22.5 E6.83 C47.17    | 8290    |

## Stage-1 sanity gates (9.3)

| Gate                                      | Target                    | Achieved                      | Result                                                                                      |
| ----------------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Stall rate at goals 50 Normal×2           | < 0.5%                    | 1%                            | FAIL                                                                                        |
| Median length grows with goal level       | 30 < 50 < 80 < 100        | 36 < 48 < 63 < 86             | pass                                                                                        |
| Seat bias Normal×2 (goals 50)             | first seat 45–55%         | 44.95%                        | FAIL                                                                                        |
| Goal last-completed: wealth (goals 50)    | ≥ 10% of games            | 13.72%                        | pass                                                                                        |
| Goal last-completed: happiness (goals 50) | ≥ 10% of games            | 32.41%                        | pass                                                                                        |
| Goal last-completed: education (goals 50) | ≥ 10% of games            | 31.9%                         | pass                                                                                        |
| Goal last-completed: career (goals 50)    | ≥ 10% of games            | 21.97%                        | pass                                                                                        |
| Sim speed, Normal AI                      | < 200 ms/game median      | 4246 ms (worst Normal config) | FAIL — ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead. |
| Education path completes at goals 100     | ≥ 99% of stall-free games | 100%                          | pass                                                                                        |

## Unmet targets

- **Stall rate at goals 50 Normal×2** — target < 0.5%, achieved 1%.
- **Seat bias Normal×2 (goals 50)** — target first seat 45–55%, achieved 44.95%.
- **Sim speed, Normal AI** — target < 200 ms/game median, achieved 4246 ms (worst Normal config).

Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in
`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).
