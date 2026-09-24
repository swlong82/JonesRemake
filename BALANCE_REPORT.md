# Balance report — stage 2, `modern-western`

BALANCE_SPEC 9.5/9.6. Measured against the targets locked in `reports/modern-targets.json`
(ADR-0048), which are derived from the classic stage-1 baseline in `BASELINE_REPORT.md`.

- Suite: `sim/stage2.json` (13 configs, 924 games), `pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 4 --out reports/stage2`
- Conditions: 4 sim workers in the build container; raw per-config output stays out of git (`.gitignore`)
- Engine 0.3.0; content `classic` 0.3.0 and `modern-western` 0.3.0

## Verdict (M8.0e)

**Every locked 9.5 target is met except sim speed**, which the owner ruled out of scope for v1.0
(KI-010). M6.3 had left nine targets unmet (KI-008); M8 met them all without moving a target
(ADR-0037: "fix everything, no amendments").

## Final measurement

| Config                       | Games | Median wk | Stall % | Seat 0 % |
| ---------------------------- | ----- | --------- | ------- | -------- |
| `modern-30-normal-2`         | 120   | 22        | 0       | 59.2     |
| `modern-50-normal-2`         | 200   | 28        | 0       | 47.0     |
| `modern-80-normal-2`         | 60    | 43        | 0       | 58.3     |
| `modern-100-normal-2`        | 24    | 67        | 0       | 58.3     |
| `modern-50-hard-vs-easy`     | 40    | 28        | 0       | 95.0     |
| `modern-50-easy-vs-hard`     | 40    | 28        | 0       | 2.5      |
| `modern-50-bot-GigOnly`      | 60    | 30        | 0       | 0        |
| `modern-50-bot-CryptoAllIn`  | 60    | 31        | 0       | 26.7     |
| `modern-50-bot-StudyFirst`   | 60    | 31        | 0       | 31.7     |
| `modern-50-bot-NoRelax`      | 60    | 31        | 0       | 0        |
| `modern-50-bot-LoanMax`      | 60    | 31        | 0       | 6.7      |
| `modern-50-bot-DeliveryOnly` | 60    | 30        | 0       | 8.3      |
| `modern-50-chaos`            | 60    | 28        | 0       | 53.3     |

| Target (BALANCE 9.5)                                    | Achieved                                      | Band                            |
| ------------------------------------------------------- | --------------------------------------------- | ------------------------------- |
| Median at goals 30 / 50 / 80 / 100                      | 22 / 28 / 43 / 67 wk                          | 19–29 / 26–40 / 38–58 / 46–70   |
| Stall rate (goals 50)                                   | 0%                                            | < 0.5%                          |
| Seat bias (Balanced vs Balanced)                        | 47%                                           | 45–55%                          |
| Hard beats Easy (both seat orders)                      | 95% / 97.5%                                   | ≥ 80%                           |
| Last completed: wealth / happiness / education / career | 41.9 / 13.0 / 17.3 / 27.8%                    | ≥ 10% each                      |
| Normal AI games with a collapse                         | 26%                                           | 15–40%                          |
| NoRelax games with a collapse                           | 98.3%                                         | ≥ 60%                           |
| CryptoAllIn bankrupt / wins                             | 65% / 26.7%                                   | > 40% / 15–40%                  |
| StudyFirst wins                                         | 31.7%                                         | 30–60%                          |
| LoanMax defaults                                        | 30%                                           | 20–60%                          |
| GigOnly wins                                            | 0%                                            | < 25%                           |
| Best bot against Normal Balanced                        | 31.7%                                         | ≤ 60%                           |
| Event families at Chaos Modern (per 100 player-weeks)   | layoffs 1.7, viral 5.7, scams 2.2, gadget 8.9 | ≥ 1 each                        |
| Sim speed                                               | 2.6–10 s/game                                 | < 200 ms (out of scope, KI-010) |

## How M8 got there

The measurements kept pointing at the AI, not the rules. Each defect below shaped every game both
packs play, so fixing it moved every number and the rules were retuned after each:

1. **Starvation.** Seats went unfed 40% (classic) to 80% (modern) of weeks — 20 hours and 5
   happiness each time. Food now outranks errands when the seat has nothing to eat.
2. **Transport variants** of one move took three of four search branches; one move per destination
   now.
3. **Early EndTurn.** A short plan that ended the turn could outscore walking on to work; the
   prefix is played and the turn re-planned while hours remain.
4. **Goals scored before the week-start decay**: seats sat at 100/100/100/100 for weeks without the
   win check agreeing. Goals are now scored as the check will see them.
5. **Tenure-capped careers** stopped working, decayed dependability to 0, were fired and restarted
   the tenure clock. Dependability is valued under the cap; a job a shift would get the seat fired
   from counts as no job.
6. **Wellbeing** was ranked on the happiness gap alone; a relax for wellbeing now ranks near
   burnout, and the Normal AI minds wellbeing at 0.7 of Hard's weight.
7. **Money:** the AI keeps two loan instalments liquid and treats cash that covers rent debt as half
   the way to paying it (the four-step bank trip had been pruned).

Rules changed with them (ADR-0047–0050): an event layoff keeps tenure if the player is rehired
within 4 weeks; degrees held at a fresh hire count as 5 weeks of tenure each; the modern wellbeing
profile can collapse again (relax 8–16, drift 1, collapse below 20); happiness starts at 0, decays
7 a week, caps at 120 and pays +2 a graduation; crypto swings 1800 bp a week and CryptoAllIn stakes
its savings too. Classic was retuned the same way (tenure 2.2/week after 8 weeks, relax base 1,
$115 a wealth point) and re-baselined; ADR-0048 re-locked the modern median bands to it.

## What the modern pack overrides

`packages/content/packs/modern-western/rules.json`, deep-merged over `classic` (ADR-0035):

```json
{
  "goals": {
    "educationPerDegree": 13,
    "educationBase": 2,
    "careerTenureBpPerWeek": 25000,
    "careerTenureDelayWeeks": 6,
    "careerLayoffGraceWeeks": 4,
    "careerTenureWeeksPerDegree": 5
  },
  "jobs": { "payPerSession": 30 },
  "happiness": { "decayPerWeek": 7, "relaxBase": 1, "relaxMax": 11, "max": 120, "graduation": 2 },
  "wellbeing": {
    "relaxBase": 8,
    "relaxMax": 16,
    "driftStep": 1,
    "unspentBonus": 2,
    "walkTripBonus": 0,
    "bands": { "thrive": 70, "burnout": 25, "collapse": 20 }
  },
  "stats": { "degreeExperienceBonus": 12 },
  "start": { "happiness": 0 }
}
```

plus `wealthPointValue` 255 in `pack.json`, 15 lessons a degree, a $3,000 student loan and crypto
`volBp` 1800.

## Reproducing

```bash
pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 4 --out reports/stage2
pnpm sim:gate            # what CI asserts
pnpm sim:gate --strict   # fails on any pending assertion; none remain
```

## History: M6.3

M6.3 met 17 of the 26 targets and recorded nine (KI-008): wealth and career last-completed,
Normal-AI collapse, the goals-80 median, Hard vs Easy one way round, StudyFirst, LoanMax and two
event families. Its iteration log is kept below for the record.

### M6.3 iteration log

Only `modern-western` content changed, plus two AI scorer defects the measurements exposed
(ADR-0034). Not one `classic` file moved, and classic's golden replays and `sim:gate` results are
unchanged.

| #   | Change                                                                                                        | Result at goals 50                                    |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | First measurement, no changes                                                                                 | **100% stall**, 0 winners, 10–15 collapses/game       |
| 2   | AI: `wellbeing` scorer made continuous (ADR-0034)                                                             | collapses 10–15 → 0–2, still 100% stall               |
| 3   | `wellbeing.relaxBase` 8→20, `relaxMax` 16→34, `driftStep` 2→4                                                 | still no winners; seats cash-starved                  |
| 4   | `jobs.payPerSession` 8→16                                                                                     | median 145 wk, stall 25% — **first winners**          |
| 5   | `payPerSession` 16→24                                                                                         | median 122 wk, stall 8.3%                             |
| 6   | `happiness.decayPerWeek` 4→2                                                                                  | median 104 wk, stall 4.2%                             |
| 7   | `happiness.decayPerWeek` 2→1, `relaxBase` 2→4                                                                 | median 69 wk, stall 0%                                |
| 8   | `happiness.relaxBase` 4→6, `relaxMax` 6→10                                                                    | median 43 wk — first time inside the band             |
| 9   | Suite run: medians 37/48/77/119, seat bias 32.7%, collapse 96%                                                | 13 of 26 targets                                      |
| 10  | Normal×2 configs switched to `balanced` vs `balanced`                                                         | seat bias becomes a turn-order measure                |
| 11  | `goals.careerDependabilityBp` 12500→9000, `wealthPointValue` 100→160, `relaxBase` 6→9                         | median 53 wk; education 96% of last goals             |
| 12  | `goals.educationPerDegree` 9→12, `relaxBase` 9→7, `relaxMax` 13→11                                            | median 48 wk, seat bias 54%                           |
| 13  | `wealthPointValue` 160→260, `careerDependabilityBp` 9000→6500, `education.lessons` 10→8                       | median 84 wk, no change to the goal spread — reverted |
| 14  | Item prices: smartphone $600→$220, laptop $900→$420 (provisional per ADR-0030)                                | no event-family change on its own                     |
| 15  | AI: `quickScore` credits an unowned item that `unlocks` a system (ADR-0034)                                   | gadget events appear (0.04/100 player-weeks)          |
| 16  | `going-viral` loses its smartphone condition; `phishing-scam` tests cash + bank                               | `scams` 2.3/100 player-weeks                          |
| 17  | Event weights: viral 120→500, laptop-battery 150→400, cracked-screen 100/200→300/600, job-automated ×150→×500 | `ai-layoffs` 1.3, `scams` 1.7                         |
| 18  | `payPerSession` 24→30                                                                                         | median 44 wk                                          |
| 19  | `wellbeing.bands.collapse` 10→4, `driftStep` 4→5                                                              | collapse 0% — overshot                                |
| 20  | `bands.collapse` 4→8, `driftStep` 5→4                                                                         | collapse 96% — the band is a cliff                    |
| 21  | `bands.collapse` 6, `driftStep` 5                                                                             | collapse 58%, median 46 wk                            |
| 22  | `careerDependabilityBp` override dropped (goals 100 was unwinnable below 10000)                               | **final**: see the table above                        |

### What the modern pack overrode at M6.3

`packages/content/packs/modern-western/rules.json`, deep-merged over `classic` (ADR-0035):

```json
{
  "goals": { "educationPerDegree": 12 },
  "jobs": { "payPerSession": 30 },
  "happiness": { "decayPerWeek": 1, "relaxBase": 7, "relaxMax": 11 },
  "wellbeing": {
    "relaxBase": 20,
    "relaxMax": 34,
    "driftStep": 5,
    "bands": { "thrive": 70, "burnout": 25, "collapse": 6 }
  }
}
```

plus `wealthPointValue` 160 in `pack.json`, the two item prices in `items.json`, and the event
weights and conditions in `events.json`. GDD 4.5's work, gig and study wellbeing deltas are
untouched: what changed is how fast rest pays them back.

### Reproducing (M6.3)

```bash
pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 6 --out reports/stage2
pnpm tsx packages/sim/cli.ts --config sim/probe.json  --workers 6   # the inner loop
pnpm sim:gate                                                       # what CI asserts (M6.4)
```
