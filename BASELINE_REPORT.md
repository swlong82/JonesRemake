# Baseline report — classic

Stage-1 suite (BALANCE_SPEC 9.3) for pack `classic`, engine 0.1.0.
24 configs, 3200 games, generated 2026-09-17 by
`pnpm baseline` from `reports/stage1/*/summary.json`. Machine-readable copy:
`reports/baseline.json`. Game counts are reduced per ADR-0016, so rates carry roughly ±3–5 pp
of sampling error and medians ±2 weeks.

Measurement conditions: 2 sim workers on a shared 4-core sandbox, other build tasks running. Only `ms/game` depends on them; every other
metric is deterministic for these seeds.

## B(metric, config)

| Config                 | Games | Weeks p10/median/p90 | Stall % | Seat 0 win % | Bankrupt % | Degrees median | Last goal % (W/H/E/C)       | ms/game |
| ---------------------- | ----- | -------------------- | ------- | ------------ | ---------- | -------------- | --------------------------- | ------- |
| `classic-30-easy-2`    | 100   | 55 / 144 / 244       | 50      | 48           | 100        | 4              | W50 H46 E4 C0               | 1548    |
| `classic-30-easy-4`    | 100   | 52 / 82 / 200        | 30      | 30           | 100        | 4              | W31.43 H58.57 E10 C0        | 1696    |
| `classic-30-normal-2`  | 200   | 22 / 30 / 80         | 0       | 38.5         | 75         | 4              | W43 H0 E57 C0               | 527     |
| `classic-30-normal-4`  | 200   | 21 / 29 / 45         | 0       | 21           | 92         | 3              | W31 H0 E68.5 C0.5           | 1042    |
| `classic-30-hard-2`    | 100   | 20 / 23 / 37         | 0       | 39           | 34         | 4              | W21 H0 E79 C0               | 1093    |
| `classic-30-hard-4`    | 100   | 19 / 21 / 25         | 0       | 14           | 37         | 3              | W16 H0 E84 C0               | 2031    |
| `classic-50-easy-2`    | 100   | 119 / 163 / 244      | 57      | 86.05        | 100        | 6              | W30.23 H69.77 E0 C0         | 1590    |
| `classic-50-easy-4`    | 100   | 102 / 152 / 248      | 31      | 37.68        | 100        | 6              | W24.64 H68.12 E7.25 C0      | 2642    |
| `classic-50-normal-2`  | 200   | 34 / 45 / 71         | 0       | 47.5         | 79         | 6              | W35 H0 E65 C0               | 847     |
| `classic-50-normal-4`  | 200   | 34 / 41 / 57         | 0       | 27           | 94.5       | 5              | W26.5 H0 E73.5 C0           | 1563    |
| `classic-50-hard-2`    | 100   | 25 / 31 / 43         | 0       | 34           | 33         | 6              | W50 H0 E49 C1               | 1527    |
| `classic-50-hard-4`    | 100   | 26 / 29 / 37         | 0       | 27           | 59         | 5              | W37 H0 E63 C0               | 3055    |
| `classic-80-easy-2`    | 100   | 167 / 228 / 281      | 78      | 77.27        | 100        | 9              | W13.64 H86.36 E0 C0         | 1729    |
| `classic-80-easy-4`    | 100   | 194 / 244 / 296      | 75      | 36           | 100        | 9              | W4 H88 E8 C0                | 4139    |
| `classic-80-normal-2`  | 200   | 52 / 84 / 129        | 2       | 47.45        | 76.5       | 9              | W27.55 H5.61 E60.2 C6.63    | 1519    |
| `classic-80-normal-4`  | 200   | 54 / 70 / 100        | 0       | 25.5         | 94.5       | 8              | W10 H5.5 E82.5 C2           | 2583    |
| `classic-80-hard-2`    | 100   | 37 / 53 / 81         | 0       | 43           | 49         | 9              | W49 H0 E50 C1               | 2458    |
| `classic-80-hard-4`    | 100   | 36 / 46 / 59         | 0       | 7            | 69         | 6              | W40 H0 E60 C0               | 4504    |
| `classic-100-easy-2`   | 100   | 0 / 0 / 0            | 100     | 0            | 100        | 10             | W0 H0 E0 C0                 | 1668    |
| `classic-100-easy-4`   | 100   | 199 / 259 / 295      | 92      | 37.5         | 100        | 9              | W12.5 H37.5 E0 C50          | 3810    |
| `classic-100-normal-2` | 200   | 64 / 97 / 205        | 5.5     | 24.34        | 86         | 11             | W42.33 H19.58 E19.58 C18.52 | 1839    |
| `classic-100-normal-4` | 200   | 68 / 97 / 154        | 0       | 14           | 98.5       | 7              | W27 H23.5 E30 C19.5         | 3514    |
| `classic-100-hard-2`   | 100   | 48 / 73 / 96         | 0       | 50           | 61         | 11             | W46 H20 E31 C3              | 3256    |
| `classic-100-hard-4`   | 100   | 46 / 69 / 92         | 0       | 27           | 84         | 8              | W34 H20 E37 C9              | 6266    |

## Stage-1 sanity gates (9.3)

| Gate                                      | Target                    | Achieved                      | Result                                                                                      |
| ----------------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Stall rate at goals 50 Normal×2           | < 0.5%                    | 0%                            | pass                                                                                        |
| Median length grows with goal level       | 30 < 50 < 80 < 100        | 30 < 45 < 84 < 97             | pass                                                                                        |
| Seat bias Normal×2 (goals 50)             | first seat 45–55%         | 47.5%                         | pass                                                                                        |
| Goal last-completed: wealth (goals 50)    | ≥ 10% of games            | 35%                           | pass                                                                                        |
| Goal last-completed: happiness (goals 50) | ≥ 10% of games            | 0%                            | FAIL                                                                                        |
| Goal last-completed: education (goals 50) | ≥ 10% of games            | 65%                           | pass                                                                                        |
| Goal last-completed: career (goals 50)    | ≥ 10% of games            | 0%                            | FAIL                                                                                        |
| Sim speed, Normal AI                      | < 200 ms/game median      | 3514 ms (worst Normal config) | FAIL — ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead. |
| Education path completes at goals 100     | ≥ 99% of stall-free games | 100%                          | pass                                                                                        |

## Unmet targets

- **Goal last-completed: happiness (goals 50)** — target ≥ 10% of games, achieved 0%.
- **Goal last-completed: career (goals 50)** — target ≥ 10% of games, achieved 0%.
- **Sim speed, Normal AI** — target < 200 ms/game median, achieved 3514 ms (worst Normal config).

Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in
`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).
