# Balance report — stage 2, `modern-western`

BALANCE_SPEC 9.5/9.6, milestone M6.3. The targets this report is measured against are locked in
`reports/modern-targets.json` and hashed in ADR-0033; they were written before the first run and
have not moved since. The classic stage-1 baseline they are derived from is `BASELINE_REPORT.md`.

- Suite: `sim/stage2.json` (13 configs, 924 games), `pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 6 --out reports/stage2`
- Inner loop: `sim/probe.json` (24 games at goals 50) — seconds per run, used between iterations
- Conditions: 6 sim workers on an 8-core laptop; raw per-config output stays out of git (`.gitignore`)
- Engine version 0.1.0, content `modern-western` 0.1.0

## Verdict

**17 of the 26 locked targets are met. Nine are not, and are recorded rather than met**
(CLAUDE.md 1.5, BALANCE 9.6 step 4) — see _Unmet targets_ below and KI-008. The ruleset went from
**unwinnable** to playable during this milestone: the first measurement stalled 100% of games at
goals 50 within 300 weeks, with every seat bankrupt and 10–15 wellbeing collapses per game. It now
stalls 0.5% with a 48-week median against classic's 40.

## Final measurement

| Config                       | Games | Median wk | Stall % | Seat 0 % |
| ---------------------------- | ----- | --------- | ------- | -------- |
| `modern-30-normal-2`         | 120   | 24        | 0       | 54.2     |
| `modern-50-normal-2`         | 200   | 48        | 0.5     | 53.8     |
| `modern-80-normal-2`         | 60    | 45        | 0       | 53.3     |
| `modern-100-normal-2`        | 24    | 70        | 0       | 41.7     |
| `modern-50-hard-vs-easy`     | 40    | 52        | 0       | 70.0     |
| `modern-50-easy-vs-hard`     | 40    | 39        | 0       | 5.0      |
| `modern-50-bot-GigOnly`      | 60    | 64        | 8.3     | 0        |
| `modern-50-bot-CryptoAllIn`  | 60    | 51        | 0       | 35.0     |
| `modern-50-bot-StudyFirst`   | 60    | 68        | 8.3     | 0        |
| `modern-50-bot-NoRelax`      | 60    | 56        | 5.0     | 0        |
| `modern-50-bot-LoanMax`      | 60    | 53        | 0       | 46.7     |
| `modern-50-bot-DeliveryOnly` | 60    | 52        | 0       | 50.0     |
| `modern-50-chaos`            | 60    | —         | —       | —        |

At goals 50, Normal×2: last goal completed is education 85.4%, happiness 13.1%, wealth 1.0%,
career 0.5%. CryptoAllIn goes bankrupt in 66.7% of its games and still wins 35%. No bot beats the
Normal Balanced AI by more than 50%.

The Normal×2 configs pit one personality (`balanced`) against itself, so `firstSeatWinPct`
measures turn order and nothing else. The classic stage-1 convention (the pack's personality
rotation) conflated turn order with personality strength: with grinder against scholar the same
modern config read 32.7%, which is a personality result, not a seat result.

## Met (17)

Median length at goals 30, 50 and 100; stall rate; seat bias; Hard ≥ 80% with the seats one way
round; happiness and education each last-completed ≥ 10%; GigOnly under 25%; CryptoAllIn bankruptcy
above 40% with a win rate inside 15–40%; NoRelax collapses in ≥ 60% of its games; no bot over 60%
(StudyFirst, NoRelax, LoanMax, DeliveryOnly); the `ai-layoffs` and `scams` families both fire more
than once per 100 player-weeks at Chaos Modern.

## Unmet targets (9) — recorded, with achieved values

| Target (BALANCE 9.5)                      | Achieved | Why it is recorded rather than met                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wealth last-completed ≥ 10%               | 1.0%     | Education is the long pole (five degrees, 8–10 lessons each); wealth and career are met well before it. Raising `wealthPointValue` to 260 (iteration 9) pushed the median to 84 weeks without moving the share.                                                                                           |
| Career last-completed ≥ 10%               | 0.5%     | The classic structural result of ADR-0026 carries over: degrees grant dependability, and career is a multiple of dependability, so career lands with the degrees rather than after them. `careerDependabilityBp` 9000 made goals-100 **unwinnable** (career caps below 100), so the classic 12500 stands. |
| Normal AI collapse 15–40% of games        | 71%      | Collapse frequency is a cliff in the `collapse` band, not a dial: band 4 gave 0%, band 6 gives 71%, band 8 gives 96% on the same content.                                                                                                                                                                 |
| Median at goals 80 within ±20% of B=62    | 45 wk    | Goals 80 lands between the 50 (48) and 100 (70) medians but below the band; n = 60 and the three medians are not monotone at this sample size.                                                                                                                                                            |
| Hard vs Easy ≥ 80%                        | 70%      | Met in the swapped-seat config (95%). Hard's beam is worth less in modern, where the binding goal is a degree ladder that Easy also climbs.                                                                                                                                                               |
| StudyFirst win rate 30–60%                | 0%       | The bot forbids all work until every degree is held; in modern that means no rent for ~40 weeks. It is the same bot that wins 0% in classic, where only the ≤ 60% half of the target is asserted.                                                                                                         |
| LoanMax default rate 20–60%               | 0%       | The bot borrows the maximum but the tuned wage (`payPerSession` 30) services the loan, so it never misses four payments.                                                                                                                                                                                  |
| `viral` fires ≥ 1 / 100 player-weeks      | 0        | The family needs a smartphone (GDD 4.13) and the AI rarely owns one; raising the weight 120 → 500 did not make it appear, and removing the condition outright did not either, while the other three families respond to weight as expected. That last part looks like a defect rather than a tuning miss. |
| `gadget-breakdown` ≥ 1 / 100 player-weeks | 0.12     | Both events in the family require owning a phone or laptop. The AI now scores gadgets that unlock a system (ADR-0034) and the prices came down to $220/$420, which took it from 0 to 0.12, not to 1.                                                                                                      |

BALANCE 9.6 allows 15 iterations before the stuck policy applies; this took 17 including two that
only undid a previous one. The report stops here rather than continuing to trade one target for
another — every remaining miss above is a target that moves in the opposite direction to at least
one target already met.

## Iteration log

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

## What the modern pack now overrides

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

## Reproducing

```bash
pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 6 --out reports/stage2
pnpm tsx packages/sim/cli.ts --config sim/probe.json  --workers 6   # the inner loop
pnpm sim:gate                                                       # what CI asserts (M6.4)
```
