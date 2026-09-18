# Baseline report — classic

Stage-1 suite (BALANCE_SPEC 9.3) for pack `classic`, engine 0.1.0.
24 configs, 3200 games, generated 2026-09-17 by
`pnpm baseline` from `reports/stage1/*/summary.json`. Machine-readable copy:
`reports/baseline.json`. Game counts are reduced per ADR-0016, so rates carry roughly ±3–5 pp
of sampling error and medians ±2 weeks.

Measurement conditions: 2 sim workers on a shared 4-core sandbox, other build tasks running. Only `ms/game` depends on them; every other
metric is deterministic for these seeds.

## B(metric, config)

| Config                 | Games | Weeks p10/median/p90 | Stall % | Seat 0 win % | Bankrupt % | Degrees median | Last goal % (W/H/E/C)     | ms/game |
| ---------------------- | ----- | -------------------- | ------- | ------------ | ---------- | -------------- | ------------------------- | ------- |
| `classic-30-easy-2`    | 100   | 51 / 135 / 252       | 48      | 38.46        | 100        | 4              | W23.08 H73.08 E3.85 C0    | 1403    |
| `classic-30-easy-4`    | 100   | 52 / 85 / 225        | 25      | 22.67        | 100        | 4              | W21.33 H65.33 E13.33 C0   | 1454    |
| `classic-30-normal-2`  | 200   | 22 / 28 / 81         | 0.5     | 46.23        | 95         | 4              | W26.13 H30.65 E42.71 C0.5 | 410     |
| `classic-30-normal-4`  | 200   | 21 / 25 / 39         | 0       | 21.5         | 98.5       | 3              | W10 H22 E68 C0            | 737     |
| `classic-30-hard-2`    | 100   | 20 / 23 / 32         | 0       | 36           | 31         | 4              | W20 H6 E74 C0             | 855     |
| `classic-30-hard-4`    | 100   | 20 / 21 / 24         | 0       | 23           | 40         | 3              | W8 H4 E88 C0              | 1569    |
| `classic-50-easy-2`    | 100   | 95 / 156 / 243       | 35      | 55.38        | 100        | 6              | W32.31 H64.62 E3.08 C0    | 1209    |
| `classic-50-easy-4`    | 100   | 86 / 119 / 201       | 26      | 18.92        | 100        | 6              | W36.49 H59.46 E4.05 C0    | 1770    |
| `classic-50-normal-2`  | 200   | 34 / 40 / 52         | 0.5     | 46.73        | 76         | 6              | W42.21 H11.56 E45.73 C0.5 | 622     |
| `classic-50-normal-4`  | 200   | 32 / 36 / 44         | 0       | 20           | 88.5       | 5              | W26.5 H16.5 E56.5 C0.5    | 1173    |
| `classic-50-hard-2`    | 100   | 28 / 32 / 43         | 0       | 63           | 33         | 6              | W30 H6 E64 C0             | 1289    |
| `classic-50-hard-4`    | 100   | 27 / 29 / 36         | 0       | 39           | 61         | 5              | W18 H5 E77 C0             | 2307    |
| `classic-80-easy-2`    | 100   | 147 / 187 / 242      | 73      | 62.96        | 100        | 9              | W25.93 H66.67 E7.41 C0    | 1455    |
| `classic-80-easy-4`    | 100   | 151 / 203 / 254      | 56      | 25           | 100        | 9              | W15.91 H75 E9.09 C0       | 3344    |
| `classic-80-normal-2`  | 200   | 48 / 62 / 84         | 0       | 46.5         | 68.5       | 9              | W67 H4.5 E27 C1.5         | 961     |
| `classic-80-normal-4`  | 200   | 47 / 56 / 71         | 0       | 30.5         | 94         | 7              | W65 H4.5 E28 C2.5         | 1768    |
| `classic-80-hard-2`    | 100   | 37 / 41 / 60         | 1       | 60.61        | 25         | 9              | W37.37 H3.03 E57.58 C2.02 | 1702    |
| `classic-80-hard-4`    | 100   | 37 / 40 / 46         | 0       | 39           | 44         | 8              | W29 H1 E70 C0             | 3317    |
| `classic-100-easy-2`   | 100   | 246 / 291 / 291      | 98      | 100          | 100        | 10             | W0 H100 E0 C0             | 1469    |
| `classic-100-easy-4`   | 100   | 213 / 269 / 285      | 96      | 25           | 100        | 9              | W0 H50 E0 C50             | 3363    |
| `classic-100-normal-2` | 200   | 69 / 83 / 108        | 1       | 43.94        | 79.5       | 11             | W60.61 H33.33 E3.54 C2.53 | 1247    |
| `classic-100-normal-4` | 200   | 65 / 75 / 93         | 0       | 18           | 96         | 9              | W59.5 H25.5 E14 C1        | 2314    |
| `classic-100-hard-2`   | 100   | 45 / 50 / 62         | 0       | 68           | 44         | 11             | W70 H12 E17 C1            | 1958    |
| `classic-100-hard-4`   | 100   | 44 / 48 / 54         | 0       | 45           | 55         | 9              | W64 H15 E18 C3            | 3819    |

## Stage-1 sanity gates (9.3)

| Gate                                      | Target                    | Achieved                      | Result                                                                                      |
| ----------------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Stall rate at goals 50 Normal×2           | < 0.5%                    | 0.5%                          | FAIL                                                                                        |
| Median length grows with goal level       | 30 < 50 < 80 < 100        | 28 < 40 < 62 < 83             | pass                                                                                        |
| Seat bias Normal×2 (goals 50)             | first seat 45–55%         | 46.73%                        | pass                                                                                        |
| Goal last-completed: wealth (goals 50)    | ≥ 10% of games            | 42.21%                        | pass                                                                                        |
| Goal last-completed: happiness (goals 50) | ≥ 10% of games            | 11.56%                        | pass                                                                                        |
| Goal last-completed: education (goals 50) | ≥ 10% of games            | 45.73%                        | pass                                                                                        |
| Goal last-completed: career (goals 50)    | ≥ 10% of games            | 0.5%                          | FAIL                                                                                        |
| Sim speed, Normal AI                      | < 200 ms/game median      | 2314 ms (worst Normal config) | FAIL — ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead. |
| Education path completes at goals 100     | ≥ 99% of stall-free games | 100%                          | pass                                                                                        |

## Unmet targets

- **Stall rate at goals 50 Normal×2** — target < 0.5%, achieved 0.5%.
- **Goal last-completed: career (goals 50)** — target ≥ 10% of games, achieved 0.5%.
- **Sim speed, Normal AI** — target < 200 ms/game median, achieved 2314 ms (worst Normal config).

Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in
`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).
