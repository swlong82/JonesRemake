# Original decode report

A numbers-and-structure record of what was decoded from a user-supplied copy of the 1991 DOS release that the `classic` ruleset is modelled on, compared with this repository. It is evidence for tuning decisions, not a specification, and it stays under the IP rules in PRD 2.6: no names, text, art, audio or code from the original appear here, and none may be copied into the game. Field names below are neutral descriptions, not the original identifiers.

Related: `docs/ORIGINAL_REFERENCE.md` (the researched baseline), ADR-0069 (audited deviations), ADR-0070 (clothing), ADR-0071 (why this report is checked in).

## 1. Method and confidence

- The game ships as a compiled script archive plus a small interpreter, so the rules live in script bytecode and object data, not in the executable. A purpose-built reader parsed the archive (813 resources, stored uncompressed), recovered the 500 property and method names, parsed script objects and their property tables, and disassembled methods from their real entry points.
- **Data** rows (tables read directly from object property values or local-variable blocks) are high confidence.
- **Code** rows (read from disassembled methods) are high confidence when the logic is short and self-checking, and noted where they are not.
- **Inferred** rows are plausible readings that were not independently confirmed.
- Nothing was run or emulated; all findings are static.

## 2. Verified rules

| #   | Rule                  | Original                                                                                                                                                                                         | Basis            | `classic` pack                                        | Status                                  |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------- | --------------------------------------- |
| 1   | Hiring roll           | `random(1,100) <= 30 + (dependability + experience + 8 x degrees + 10) / 3`, integer division                                                                                                    | code             | `rules.jobs` luck terms                               | match                                   |
| 2   | Hiring gate           | every required degree owned, dependability >= requirement, experience >= requirement, then the roll; a requirement of exactly 10 is treated as 0 for dependability                               | code             | `commands/jobs.ts`                                    | check the "10 counts as 0" rule         |
| 3   | Always-hired job      | one entry job skips the roll                                                                                                                                                                     | code             | `alwaysHire` flag                                     | match                                   |
| 4   | Dependability decay   | minus 3 each turn, floor 0                                                                                                                                                                       | code             | `stats.dependabilityDecay` 3                          | match                                   |
| 5   | Career stat           | `employed ? floor(dependability / 8) x 10 : 0`, cap 100                                                                                                                                          | code             | continuous `floor(dep x 1.25)` plus a tenure cap      | **diverges**                            |
| 6   | Wealth stat           | `floor(liquidAssets / 100)`, clamped 0..100                                                                                                                                                      | code             | `wealthPointValue` 115                                | diverges by design (ADR-0069)           |
| 7   | Education stat        | `1 + 9 x degrees`                                                                                                                                                                                | code             | `educationBase` 1, `educationPerDegree` 9             | match                                   |
| 8   | Happiness stat        | add delta, clamp 0..100; no weekly decay in the turn-end code                                                                                                                                    | code             | decay 5, max 105                                      | diverges by design (ADR-0025/0027/0040) |
| 9   | Win check             | at the start of the player's turn: all four stats >= goals                                                                                                                                       | code             | all-goals race                                        | match                                   |
| 10  | Start state           | cash 200, dependability 20, experience 10, relaxation 25, goals 50 each, rent 325 (low-cost)                                                                                                     | data             | relaxation 10, rest equal                             | relaxation **diverges**                 |
| 11  | Relaxation decay      | minus 1 per turn, floor 10, none with the hot tub                                                                                                                                                | code             | same                                                  | match                                   |
| 12  | Burglary              | low-cost apartment only; chance `1 / (relaxation + 1)` per turn                                                                                                                                  | code             | base 2% + 1% per durable - 0.08% per relaxation point | **diverges**                            |
| 13  | Outfits               | three outfit tiers held as durables whose quantity is weeks left; best unexpired outfit decides if the player is dressed; no job is workable without one                                         | code, data       | ADR-0070 aligns this                                  | match after ADR-0070                    |
| 14  | Extra study credit    | owning all three reference books gives 1; owning the computer gives 1; maximum 2                                                                                                                 | code             | each of the three books gives 1, capped at 2          | **diverges**                            |
| 15  | Graduation            | a course needs `lessons - extra credit` lessons; graduating adds 5 to a "credit" counter and 5 to dependability                                                                                  | code             | lessons 10, extra credit cap 2                        | partly match                            |
| 16  | Degree tree           | trade school -> electronics; trade school -> pre-engineering -> engineering; junior college -> business admin; junior college -> academic -> graduate -> post-doctoral -> research -> publishing | data             | `degrees.json` prerequisites                          | match                                   |
| 17  | Lesson length         | 6 hours per lesson                                                                                                                                                                               | data             | `lessonHours` 6                                       | match                                   |
| 18  | Loans                 | the base game has bank loans: offered in $100 units, repaid on the 4-week cycle, balance counts against solvency checks and shows on the stats screen                                            | code             | `loans` off in classic                                | **gap**                                 |
| 19  | Loan terms (inferred) | limit about `(wage + liquidAssets/1000 - (5 + latePayments + balance/100 + (balance > 0 ? 1 : 0))) x 100`; fixed payment step of about 45                                                        | code, low-medium | n/a                                                   | unverified                              |

## 3. Data tables

### 3.1 Jobs (38)

Order is the original's job index. "Dependability" and "experience" are requirements. Uniform `casual` / `dress` / `business` are the three outfit tiers. Titles are not reproduced.

| Job | Wage | Dependability | Experience | Degree 1        | Degree 2    | Uniform  |
| --- | ---- | ------------- | ---------- | --------------- | ----------- | -------- |
| 1   | 6    | 10            | 10         | -               | -           | casual   |
| 2   | 5    | 10            | 10         | -               | -           | casual   |
| 3   | 5    | 10            | 10         | -               | -           | casual   |
| 4   | 6    | 20            | 10         | -               | -           | casual   |
| 5   | 6    | 20            | 10         | -               | -           | casual   |
| 6   | 7    | 20            | 20         | -               | -           | dress    |
| 7   | 6    | 20            | 10         | -               | -           | casual   |
| 8   | 6    | 20            | 10         | -               | -           | casual   |
| 9   | 7    | 20            | 10         | -               | -           | casual   |
| 10  | 7    | 20            | 10         | -               | -           | casual   |
| 11  | 8    | 20            | 20         | -               | -           | casual   |
| 12  | 7    | 30            | 20         | -               | -           | dress    |
| 13  | 7    | 30            | 20         | -               | -           | casual   |
| 14  | 8    | 30            | 30         | -               | -           | dress    |
| 15  | 8    | 30            | 30         | trade-school    | -           | casual   |
| 16  | 8    | 30            | 30         | trade-school    | -           | business |
| 17  | 9    | 30            | 30         | junior-college  | -           | casual   |
| 18  | 9    | 30            | 30         | trade-school    | -           | casual   |
| 19  | 8    | 40            | 30         | junior-college  | -           | dress    |
| 20  | 9    | 40            | 40         | junior-college  | -           | business |
| 21  | 9    | 40            | 40         | junior-college  | -           | dress    |
| 22  | 10   | 40            | 40         | pre-engineering | -           | casual   |
| 23  | 10   | 40            | 40         | junior-college  | -           | dress    |
| 24  | 11   | 40            | 40         | electronics     | -           | casual   |
| 25  | 11   | 50            | 40         | academic        | -           | dress    |
| 26  | 14   | 40            | 40         | junior-college  | electronics | business |
| 27  | 15   | 40            | 40         | junior-college  | -           | dress    |
| 28  | 12   | 50            | 50         | business-admin  | -           | business |
| 29  | 14   | 50            | 50         | business-admin  | -           | business |
| 30  | 18   | 50            | 50         | business-admin  | -           | business |
| 31  | 18   | 50            | 50         | business-admin  | -           | business |
| 32  | 19   | 50            | 50         | engineering     | -           | casual   |
| 33  | 20   | 60            | 50         | research        | -           | dress    |
| 34  | 19   | 60            | 60         | business-admin  | -           | business |
| 35  | 22   | 60            | 60         | junior-college  | engineering | business |
| 36  | 23   | 60            | 60         | junior-college  | engineering | business |
| 37  | 22   | 70            | 70         | business-admin  | academic    | business |
| 38  | 25   | 70            | 70         | business-admin  | engineering | business |

Distribution: wages 5-25; requirements 10-70 in steps of ten; 24 jobs need at least one degree and 5 need two; uniform tiers casual 17, dress 9, business 12. Two further columns (a workplace code and a ladder rank) exist but their mapping was not confirmed.

### 3.2 Starting state

| Field         | Original                                           | `classic` |
| ------------- | -------------------------------------------------- | --------- |
| Cash          | 200                                                | 200       |
| Dependability | 20                                                 | 20        |
| Experience    | 10                                                 | 10        |
| Relaxation    | 25                                                 | 10        |
| Goal sliders  | 50 each                                            | 50 each   |
| Low-cost rent | 325                                                | 325       |
| Secure rent   | 475 (also the security-apartment price list entry) | 475       |

### 3.3 Item base prices

Two shops list durables; the discount shop is roughly 25-35% cheaper. Prices in whole currency units; `n/a` means not stocked there.

| Item                       | Full-price shop | Discount shop | `classic` pack          |
| -------------------------- | --------------- | ------------- | ----------------------- |
| Refrigerator               | 876             | 650           | 450                     |
| Freezer                    | 513             | n/a           | 350                     |
| Stove                      | 570             | 490           | not modelled            |
| Colour television          | 525             | 349           | 400 (single television) |
| Black-and-white television | n/a             | 110           | not modelled            |
| Video player               | 333             | 250           | 250                     |
| Stereo                     | 412             | 450           | 300                     |
| Microwave                  | 330             | 220           | 120                     |
| Hot tub                    | 1255            | n/a           | 2500                    |
| Computer                   | 1599            | n/a           | 1200                    |
| Encyclopedia               | n/a             | 475           | 200                     |
| Dictionary                 | n/a             | 70            | 40                      |
| Atlas                      | n/a             | 55            | 60                      |
| Baseball ticket            | n/a             | 45            | not modelled            |
| Theatre ticket             | n/a             | 30            | 30                      |
| Concert ticket             | n/a             | 40            | 45                      |

Tickets are sold in units of 4. About 23 junk goods rotate through the discount shop's stock lists (nine stock lists, three to nine goods each, base prices 5-25).

### 3.4 Outfits

| Outfit      | Boutique price | Boutique weeks | Discount price | Discount weeks | `classic` boutique | `classic` discount |
| ----------- | -------------- | -------------- | -------------- | -------------- | ------------------ | ------------------ |
| Casual      | 73             | 11             | 35             | 9              | 60 / 8 weeks       | 30 / 5 weeks       |
| Mid (dress) | 125            | 13             | 90             | 9              | 150 / 10 weeks     | 75 / 6 weeks       |
| Business    | 295            | 13             | n/a            | n/a            | 300 / 12 weeks     | 150 / 7 weeks      |

The weeks-of-wear reading is medium confidence. The original outfits last longer than ours at every tier.

### 3.5 Market instruments

Six instruments. One is fixed at 100 per share. The other five start at realistic per-unit prices of about 413, 14, 20, 49 and 7. `classic` normalises all six to a starting index of 100 with per-instrument bounds. The original's movement and bound logic was not decoded.

## 4. Differences to act on

Each needs its own ADR and a `sim:gate` run before any change.

1. Burglary: switch to `1 / (relaxation + 1)`, independent of durables.
2. Loans: add the base-game loan to classic (4-week cycle, $100 units) once the terms are confirmed.
3. Career stat: stepwise `floor(dep/8) x 10`; compare thresholds before changing.
4. Extra study credit: books as a set (1) plus the computer (1).
5. Start relaxation 25 versus 10.
6. Item catalogue: add stove, black-and-white television, baseball tickets; revisit the hot-tub, encyclopedia and refrigerator prices; lengthen outfit durations.
7. Job table: 38 jobs on a ten-step requirement ladder versus our 46; fewer two-degree jobs.

## 5. Not decoded

Doctor and starvation penalties, the instrument movement and bound logic, the economy index and news triggers, weekend and news tables, rent-hike behaviour, appliance breakdown rates beyond the three-stage state flag, course fees, and the exact loan terms. Two secondary columns of the job table are unmapped.
