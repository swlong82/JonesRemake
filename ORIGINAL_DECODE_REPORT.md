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

| #   | Rule                  | Original                                                                                                                                                                                                                       | Basis            | `classic` pack                                                                                                                 | Status                                  |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1   | Hiring roll           | `random(1,100) <= 30 + (dependability + experience + 8 x degrees + 10) / 3`, integer division                                                                                                                                  | code             | `rules.jobs` luck terms                                                                                                        | match                                   |
| 2   | Hiring gate           | every required degree owned, dependability >= requirement, experience >= requirement, then the roll; a requirement of exactly 10 is treated as 0 for dependability                                                             | code             | `commands/jobs.ts`                                                                                                             | check the "10 counts as 0" rule         |
| 3   | Always-hired job      | one entry job skips the roll                                                                                                                                                                                                   | code             | `alwaysHire` flag                                                                                                              | match                                   |
| 4   | Dependability decay   | minus 3 each turn, floor 0                                                                                                                                                                                                     | code             | `stats.dependabilityDecay` 3                                                                                                   | match                                   |
| 5   | Career stat           | `employed ? floor(dependability / 8) x 10 : 0`, cap 100                                                                                                                                                                        | code             | continuous `floor(dep x 1.25)` plus a tenure cap                                                                               | **diverges**                            |
| 6   | Wealth stat           | `floor(liquidAssets / 100)`, clamped 0..100                                                                                                                                                                                    | code             | `wealthPointValue` 115                                                                                                         | diverges by design (ADR-0069)           |
| 7   | Education stat        | `1 + 9 x degrees`                                                                                                                                                                                                              | code             | `educationBase` 1, `educationPerDegree` 9                                                                                      | match                                   |
| 8   | Happiness stat        | add delta, clamp 0..100; no weekly decay in the turn-end code                                                                                                                                                                  | code             | decay 5, max 105                                                                                                               | diverges by design (ADR-0025/0027/0040) |
| 9   | Win check             | at the start of the player's turn: all four stats >= goals                                                                                                                                                                     | code             | all-goals race                                                                                                                 | match                                   |
| 10  | Start state           | cash 200, dependability 20, experience 10, relaxation 25, goals 50 each, rent 325 (low-cost)                                                                                                                                   | data             | relaxation 10, rest equal                                                                                                      | relaxation **diverges**                 |
| 11  | Relaxation decay      | minus 1 per turn, floor 10, none with the hot tub                                                                                                                                                                              | code             | same                                                                                                                           | match                                   |
| 12  | Burglary              | low-cost apartment only; chance `1 / (relaxation + 1)` per turn                                                                                                                                                                | code             | base 2% + 1% per durable - 0.08% per relaxation point                                                                          | **diverges**                            |
| 13  | Outfits               | three outfit tiers held as durables whose quantity is weeks left; best unexpired outfit decides if the player is dressed; no job is workable without one                                                                       | code, data       | ADR-0070 aligns this                                                                                                           | match after ADR-0070                    |
| 14  | Extra study credit    | owning all three reference books gives 1; owning the computer gives 1; maximum 2                                                                                                                                               | code             | each of the three books gives 1, capped at 2                                                                                   | **diverges**                            |
| 15  | Graduation            | a course needs `lessons - extra credit` lessons; graduating adds 5 to a "credit" counter and 5 to dependability                                                                                                                | code             | lessons 10, extra credit cap 2                                                                                                 | partly match                            |
| 16  | Degree tree           | trade school -> electronics; trade school -> pre-engineering -> engineering; junior college -> business admin; junior college -> academic -> graduate -> post-doctoral -> research -> publishing                               | data             | `degrees.json` prerequisites                                                                                                   | match                                   |
| 17  | Lesson length         | 6 hours per lesson                                                                                                                                                                                                             | data             | `lessonHours` 6                                                                                                                | match                                   |
| 18  | Loans                 | the base game has bank loans (borrowing limit confirmed from clean code, payment step low confidence): offered in $100 units, repaid on the 4-week cycle, balance counts against solvency checks and shows on the stats screen | code             | `loans` off in classic                                                                                                         | **gap**                                 |
| 19  | Loan terms (inferred) | limit about `(wage + liquidAssets/1000 - (5 + latePayments + balance/100 + (balance > 0 ? 1 : 0))) x 100`; fixed payment step of about 45                                                                                      | code, low-medium | n/a                                                                                                                            | unverified                              |
| 20  | Lottery               | tickets held `q` resolve once: draw `r` uniformly from 0..500; win if `q > r`; then prize 5000 if `r <= q/20`, else 500 if `r <= q/5`, else 200 (integer division). Win chance is `q/501`; about 97 cents back per dollar      | code             | per ticket: 8% for 200, 1.5% for 1000, 0.2% for 5000; best prize across tickets paid; about 4.1 back per dollar for one ticket | **diverges**                            |
| 21  | Rent cycle            | checked every 4th week; the low-cost and secure apartments use different prepaid rent items; an unpaid item at the check starts the overdue scene                                                                              | code             | `rentWeeks` 4                                                                                                                  | match                                   |
| 22  | Food storage          | without a freezer, stored fresh food is capped at 6 units                                                                                                                                                                      | code             | fridge 6, freezer 12                                                                                                           | match (partly)                          |
| 23  | Computer income       | a player who owns the computer has a 1-in-7 chance each turn of earning `random(20,100)`                                                                                                                                       | code, medium     | freelance event: gated on the computer, 50-150, weight 10 of about 100                                                         | **diverges**                            |
| 24  | Weekend event cost    | the weekend event amount is drawn from 15-55 in weeks 1-7 and from 50-100 from week 8 (parameter meaning inferred)                                                                                                             | code, medium     | fixed costs 15-200 chosen by weight                                                                                            | **diverges**                            |
| 25  | Doctor bill           | `random(30, cap)` with cap 200, or 50 when cash is under 500, never more than cash on hand; trigger inferred (spoiled food and low relaxation)                                                                                 | code, low-medium | `costMin` 30, `costMax` 60                                                                                                     | **diverges**                            |
| 26  | Price index           | every market row (an economy row plus seven price rows) keeps a reading clamped to 70..190 (100 is normal) and updates weekly: `reading += adjustment + trend/3` for price rows, `reading += adjustment` for the economy row   | code             | per-instrument bounds (e.g. 95-108% or 20-300% of start)                                                                       | **diverges**                            |
| 27  | Row trend             | a trend value random-walks one step per week inside `[-3-low, 3+high]`, where `low`/`high` widen to 1 or 2 when the reading is above 130/160 or below 90/80                                                                    | code             | no trend state                                                                                                                 | **diverges**                            |
| 28  | Weekly change         | percent change drawn from `[-3 + 2*min(trend,0), 3 + 2*max(trend,0)]`; at the lower edge an extra `random(0, risk*abs(trend))` is subtracted. Risk per row: 4, 4, 4, 2, 2, 4, 1, 10                                            | code             | `maxMoveBp` per instrument, `econCorrBp`                                                                                       | **diverges**                            |
| 29  | Crash                 | from week 8, while the economy reading is at least 80: chance `1/(30n+1)` per week (`n` is the number of players); severity random 1..3; all readings are multiplied by `(16+severity)/20` (0.85, 0.90 or 0.95)                | code, medium     | three crash events, multipliers 0.75-0.90, weight about 9% of draws                                                            | **diverges**                            |
| 30  | Boom                  | otherwise, from week 8 while the economy reading is at most 120: same chance; readings multiplied by 1.10                                                                                                                      | code, medium     | boom event, multiplier 1.03-1.06                                                                                               | **diverges**                            |
| 31  | News hint             | a headline for the row with the strongest trend, shown with probability about 3/4 when `abs(trend) >= 3` and 1/2 when it is 2; headline direction follows the trend                                                            | code, medium     | digest from the economy and market state                                                                                       | partly                                  |
| 32  | Appliance breakdown   | each turn an eligible appliance (quantity above 1, not pawned) breaks with chance `1/51`, or `1/36` if bought from the discount shop; repair cost `random(pricePaid/20, pricePaid/4)`                                          | code, medium     | `breakdownPerWeek` 0.5-1.5%, discount multiplier 2.5, fixed repair cost per item                                               | **diverges**                            |
| 33  | Pawn window           | pawning sets a three-step countdown (24, 16, 8, 0) advanced each turn; at 0 the item is flagged available to others                                                                                                            | code             | `redeemRounds` 2                                                                                                               | match (approximately)                   |
| 34  | Rent debt             | at the 4-week check an unpaid prepaid-rent item with no extension adds one month of rent to rent owed; an extension defers the check by one week; between checks the same test runs once if no debt exists                     | code             | rent debt and extension rules                                                                                                  | match                                   |
| 35  | Loan cycle            | on the 4-week check a loan decrements a payment counter; if no payment was made that cycle a late-payment counter increases; borrowing needs the counter to be zero or above and the late count lowers the limit               | code, medium     | n/a                                                                                                                            | gap (see rule 18)                       |
| 36  | Course fee            | one tuition object with a base price of 50 per enrolment; enrolment needs cash at or above the price and no other course in progress beyond the degrees already earned (reading of the guard is medium confidence)             | data, code       | `enrollFee` 50, up to 4 concurrent courses                                                                                     | match on price; concurrency differs     |
| 37  | Rent level            | the rent is copied from the apartment's current listed price at move-in and stays locked; no scheduled hike exists in the base game, the listed price follows the economy                                                      | code             | `rentHikes` off in classic; lock at move-in                                                                                    | match                                   |

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

Six instruments. One is fixed at 100 per share. The other five start at realistic per-unit prices of about 413, 14, 20, 49 and 7. `classic` normalises all six to a starting index of 100 with per-instrument bounds. Movement is a shared trend model (rules 26-30), not per-instrument bounds: every price row follows the same clamp of 70-190 and the economy's trend.

## 4. Differences to act on

Each needs its own ADR and a `sim:gate` run before any change.

1. Burglary: switch to `1 / (relaxation + 1)`, independent of durables.
2. Loans: add the base-game loan to classic (4-week cycle, $100 units) once the terms are confirmed.
3. Career stat: stepwise `floor(dep/8) x 10`; compare thresholds before changing.
4. Extra study credit: books as a set (1) plus the computer (1).
5. Start relaxation 25 versus 10.
6. Item catalogue: add stove, black-and-white television, baseball tickets; revisit the hot-tub, encyclopedia and refrigerator prices; lengthen outfit durations.
7. Job table: 38 jobs on a ten-step requirement ladder versus our 46; fewer two-degree jobs.
8. Lottery: prize tiers 200 / 500 / 5000 with a single resolution per week and a `q/501` win chance, instead of per-ticket rolls that pay about four times the stake.
9. Weekend and doctor costs: the original draws costs from ranges that grow with the week and shrink when cash is low (doctor capped at 50 below 500 cash, never above cash on hand); ours are fixed per event. The computer pays 20-100 with a 1-in-7 weekly chance; ours pays 50-150 at weight 10.
10. Market and economy: replace per-instrument bounded walks with the original's shared trend model (rules 26-31) if a faithful classic is wanted; the crash and boom odds depend on a game setting that is not yet identified.

## 5. Not decoded

Doctor and starvation triggers, the mapping of the seven price rows to named instruments, the text tables for weekend events and headlines, and the loan payment step (borrowing limit is confirmed). Two secondary columns of the job table are unmapped.
