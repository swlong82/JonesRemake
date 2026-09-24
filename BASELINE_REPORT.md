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
| `classic-30-easy-2`            | 100   | 28 / 43 / 88         | 0       | 36           | 97         | 4              | W21.5 H63 E11.5 C4          | 2783    |
| `classic-30-easy-4`            | 100   | 26 / 32 / 45         | 0       | 13           | 99         | 3              | W23.67 H44.67 E27.83 C3.83  | 2179    |
| `classic-30-normal-2`          | 200   | 23 / 24 / 30         | 0       | 34           | 48.5       | 4              | W12 H14.42 E37.67 C35.92    | 1570    |
| `classic-30-normal-4`          | 200   | 23 / 24 / 27         | 0       | 17           | 64         | 3              | W10.58 H16.58 E38.92 C33.92 | 2649    |
| `classic-30-hard-2`            | 100   | 23 / 24 / 26         | 0       | 17           | 21         | 4              | W13.67 H3.17 E47 C36.17     | 3734    |
| `classic-30-hard-4`            | 100   | 23 / 23 / 25         | 0       | 16           | 38         | 3              | W11.5 H1 E40 C47.5          | 11230   |
| `classic-50-easy-2`            | 100   | 41 / 72 / 181        | 4       | 40.63        | 88         | 6              | W25.52 H65.63 E5.73 C3.13   | 4251    |
| `classic-50-easy-4`            | 100   | 37 / 51 / 75         | 0       | 17           | 97         | 6              | W42 H43.5 E11.5 C3          | 6136    |
| `classic-50-normal-2`          | 200   | 32 / 33 / 41         | 0       | 33.5         | 49         | 6              | W21.83 H26.92 E21.33 C29.92 | 3482    |
| `seatbias-classic-50-normal-2` | 200   | 32 / 35 / 41         | 0       | 50           | 40         | 6              | W23.79 H17.96 E43.04 C15.21 | 3153    |
| `classic-50-normal-4`          | 200   | 32 / 33 / 37         | 0       | 21           | 71         | 5              | W14.08 H16.08 E29.25 C40.58 | 7110    |
| `classic-50-hard-2`            | 100   | 32 / 34 / 39         | 0       | 23           | 57         | 6              | W38.33 H3 E33.83 C24.83     | 7056    |
| `classic-50-hard-4`            | 100   | 32 / 33 / 37         | 0       | 11           | 74         | 5              | W35.17 H2.67 E34.67 C27.5   | 14894   |
| `classic-80-easy-2`            | 100   | 60 / 92 / 178        | 17      | 44.58        | 93         | 9              | W41.97 H44.98 E11.24 C1.81  | 5913    |
| `classic-80-easy-4`            | 100   | 56 / 78 / 162        | 1       | 14.14        | 98         | 9              | W33.67 H47.31 E18.01 C1.01  | 7994    |
| `classic-80-normal-2`          | 200   | 46 / 48 / 57         | 0.5     | 41.21        | 42.5       | 9              | W23.83 H29.44 E13.94 C32.79 | 4436    |
| `classic-80-normal-4`          | 200   | 46 / 47 / 52         | 0       | 26.5         | 76         | 8              | W19.25 H20.92 E20.33 C39.5  | 9304    |
| `classic-80-hard-2`            | 100   | 46 / 47 / 53         | 0       | 28           | 53         | 9              | W38.67 H5.5 E16.83 C39      | 10074   |
| `classic-80-hard-4`            | 100   | 46 / 46 / 50         | 0       | 20           | 74         | 8              | W33 H2.17 E21.67 C43.17     | 22209   |
| `classic-100-easy-2`           | 100   | 89 / 143 / 254       | 22      | 56.41        | 94         | 11             | W30.34 H59.19 E7.26 C3.21   | 9768    |
| `classic-100-easy-4`           | 100   | 84 / 110 / 178       | 8       | 27.17        | 99         | 11             | W42.93 H41.85 E12.14 C3.08  | 13413   |
| `classic-100-normal-2`         | 200   | 55 / 58 / 76         | 0       | 47.5         | 46         | 11             | W31.83 H42.5 E5.42 C20.25   | 5948    |
| `classic-100-normal-4`         | 200   | 55 / 56 / 63         | 0       | 31.5         | 72.5       | 11             | W28.17 H33.92 E10.67 C27.25 | 12061   |
| `classic-100-hard-2`           | 100   | 55 / 56 / 63         | 0       | 31           | 54         | 11             | W44.67 H23 E7.67 C24.67     | 12665   |
| `classic-100-hard-4`           | 100   | 55 / 56 / 61         | 0       | 28           | 83         | 10             | W52.92 H11.75 E7.42 C27.92  | 25694   |

## Stage-1 sanity gates (9.3)

| Gate                                                | Target                    | Achieved                       | Result                                                                                      |
| --------------------------------------------------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| Stall rate at goals 50 Normal×2                     | < 0.5%                    | 0%                             | pass                                                                                        |
| Median length grows with goal level                 | 30 < 50 < 80 < 100        | 24 < 33 < 48 < 58              | pass                                                                                        |
| Seat bias Normal×2 (goals 50, Balanced vs Balanced) | first seat 45–55%         | 50%                            | pass                                                                                        |
| Goal last-completed: wealth (goals 50)              | ≥ 10% of games            | 21.83%                         | pass                                                                                        |
| Goal last-completed: happiness (goals 50)           | ≥ 10% of games            | 26.92%                         | pass                                                                                        |
| Goal last-completed: education (goals 50)           | ≥ 10% of games            | 21.33%                         | pass                                                                                        |
| Goal last-completed: career (goals 50)              | ≥ 10% of games            | 29.92%                         | pass                                                                                        |
| Sim speed, Normal AI                                | < 200 ms/game median      | 12061 ms (worst Normal config) | FAIL — ADR-0016: the spec-sized AI beam costs ~1 s/game; sample sizes were reduced instead. |
| Education path completes at goals 100               | ≥ 99% of stall-free games | 100%                           | pass                                                                                        |

## Unmet targets

- **Sim speed, Normal AI** — target < 200 ms/game median, achieved 12061 ms (worst Normal config).

Unmet targets are recorded here per the stuck policy (CLAUDE.md 1.5) and tracked in
`KNOWN_ISSUES.md`; the CI gate keeps asserting them (`pnpm sim:gate --strict`, ADR-0019).
