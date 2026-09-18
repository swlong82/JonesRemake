# Handoff

State of the build after M5, for the session that picks this up. Read `CLAUDE.md` first, then this
file, then resume at the first unchecked task in `PROGRESS.md` (M6.1).

## Where the build is

| Area                                   | State                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `packages/shared`, `engine`, `content` | Complete through M1–M2 and the M5 modules; tags `m1`, `m2` local (KI-001)   |
| `packages/ai`                          | M2.4–M2.5 plus the M5.9 modern coverage and three module scorers            |
| `packages/sim`                         | Runner, bots (6), metrics, reports and gates complete                       |
| Classic balance (M3)                   | **Closed** — tag `m3` (local). One target recorded unmet, not met: ADR-0026 |
| `apps/web`                             | Complete through M4.8 — the **classic** ruleset is playable and deployed    |
| Modern systems (M5)                    | **Complete** — nine modules behind CityPack flags, tag `m5` (local)         |
| M6–M8                                  | Not started                                                                 |

`pnpm verify` is green end to end (lint, typecheck, 30 test files, content validation, `gen:types`,
banned terms, scaffold check, bundle 154.1 kB gzip of 350, e2e 21 on three viewports, `sim:gate`).
The one thing to know before reading a gate run: `sim:gate` reports **18 assertions, 0 failed, 1
pending**. The pending one is `lastGoalPct.career`, and it is recorded as structurally unreachable
rather than open work — see ADR-0026 before spending time on it.

Live build: https://swlong82.github.io/JonesRemake/ (deployed from `main` by `deploy.yml` after CI
goes green). The playable build there is M4; M5 is on the branch below, not yet merged.

## Branch and tags

- Work branch: `claude/focused-maxwell-jhqrj4`, currently 11 commits ahead of `main` (M3 tuning and
  all of M5). Nothing is merged to `main` yet, so the live demo is still the M4 build.
- Tags `m1`…`m5` exist **locally only** — the session cannot push tags (KI-001). Their SHAs are in
  the PROGRESS gate log; push them with `git push origin --tags` from a machine that can.

## Resume here: M6 — modern pack and balance

M5 left `modern-western` carrying working content for every system, but only the content the rules
needed. M6 is what turns it into a pack rather than a test fixture.

1. **M6.1 — the pack proper.** Names and flavour are still inherited from `classic`, so the modern
   city currently calls its co-living pod "Low-Cost Housing" and its ride-hail driver's employer the
   "Employment Office". What is missing, in order of size:
   - i18n overrides for 16 locations (name + 3 greetings + 3 farewells each — the validator
     requires `MIN_GREETINGS`/`MIN_FAREWELLS`), 46 job titles, 11 degrees, the meals and clothing;
   - the rest of GDD 4.11's modern item list (tablet, smart TV, game console, e-reader, headphones,
     air fryer, robot vacuum, massage chair, bike, gym card) — the smartphone, laptop and phone case
     are already there;
   - `automationRisk` per job tuned to GDD 4.13's bands (clerical and warehouse 0.3–0.5, trades 0.1,
     management and teaching 0.05); classic's values are inherited and only roughly right.
     Everything goes in `packages/content/packs/modern-western/` and must be registered in
     `packages/content/src/packs.ts` — the pack registry is a static import list, and a file that is
     not listed there is silently ignored (that caught this session twice).
2. **M6.2** — write and lock `reports/modern-targets.json`, hash in an ADR.
3. **M6.3** — the BALANCE 9.6 tuning loop until the 9.5 gates pass; `BALANCE_REPORT.md` is the
   output. This is also where KI-005's career target is revisited for the modern ladder (ADR-0026).
4. **M6.4** — add modern configs to `sim/gates.json`, keeping the classic sanity gates.
5. **M6.5** — the modern UI: subscriptions total in the HUD, loan panel, investment panel with a
   sparkline, transport selector, and the retention-offer dialog the cancel flow is written around.
   `labels.ts`'s `SECTION_ORDER` needs the new service sections (`gig`, `loans`, `subscriptions`,
   `transit-pass`, `cars`); the panel itself needs no new plumbing, because it renders whatever
   `candidateCommands` returns (ADR-0020).

## How the modern systems are put together

Each system is a `RuleModule` in `packages/engine/src/modules/`, carrying its own `flag`, its own
slice and its own commands, listed in `MODERN_MODULES` (order 100–199):

| Module          | Flag            | What it owns                                                      |
| --------------- | --------------- | ----------------------------------------------------------------- |
| `wellbeing`     | `wellbeing`     | The stat `ctx.addStat(…, 'wellbeing', …)` writes through, 4 bands |
| `transport`     | `transport`     | Mode gating and pricing, transit pass, car, upkeep, breakdowns    |
| `subscriptions` | `subscriptions` | Billing, drift, lapse, `grantsOf`/`hasGrant` for other modules    |
| `online-study`  | `onlineStudy`   | `StudyOnline` and the doomscroll chance                           |
| `delivery`      | `delivery`      | `OrderDelivery`, markup, food-club discount, lost orders          |
| `rent-hikes`    | `rentHikes`     | Renewal notice and hike, the co-living roommate                   |
| `gig`           | `gig`           | `GigSignup`/`GigShift`, weekly demand, driver car wear            |
| `loans`         | `loans`         | Approval, APR, amortised payment, default, negative wealth        |
| `modern-assets` | `modernAssets`  | The `drift` pricing model and its correlation weighting           |

Rules to keep, because breaking them costs a debugging session each:

- **Nothing random in `cost()` or `validate()`.** They run inside `legalCommands` and
  `previewCommand`, which are pure; a draw there also desynchronises replay, which is how the golden
  tests catch it. Prices a preview can show are rolled at turn start into the module slice
  (ADR-0028); risks that land afterwards go in `apply` or on the event, with `riskBp` in the preview.
- **One module touches another only through exported selectors** (`carOf`, `breakCar`, `grantsOf`,
  `totalOwed`), never by reaching into `player.modules[x]`.
- **`takeMoneyCascade` returns the shortfall**, not the amount taken.
- `pnpm gen:types` scans `src/commands/*.ts` **and** `src/modules/*.ts`; run it after adding a
  command or CI's `--check` will fail.
- Adding content to `modern-western` usually means four files: the JSON, its i18n keys, its
  `assets.registry.json` entry, and `packages/content/src/packs.ts`.
- Changing any rule or content value changes the golden replays. Regenerate with
  `UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts --root packages/engine`, and say why in the
  commit; classic's goldens did **not** move during M5, which is the check that classic is untouched.

## Balance, as it stands

`BASELINE_REPORT.md` and `reports/baseline.json` are the stage-1 numbers for the shipped classic
values (24 configs, 3,200 games). At goals 50 Normal×2: medians 28 < 40 < 62 < 83 across goal
levels, seat bias 46.7%, stall 0.5%, last goal completed education 45.7% / wealth 42.2% /
happiness 11.6% / career 0.5%.

Three 9.3 targets are recorded unmet, each with a reason rather than a plan:

- **career last-completed** — structurally unreachable on `[SRC]` values (ADR-0026, KI-005);
- **sim speed** — the spec-sized AI beam costs about a second a game (ADR-0016);
- **stall rate** — lands on 0.5% against a "< 0.5%" target; the CI gate's tolerance is 2%.

The M3.3 tuning that got happiness from 0% to 11.6% is worth reading before touching balance again:
ADR-0025 (happiness decay and the ticket cap), ADR-0027 (why the stat needs headroom above the goal
ceiling, and the two AI scorers the decay forced), ADR-0028 (turn-start pricing).

## Commands

```bash
pnpm verify                     # everything, in the order CI runs it
pnpm sim:gate                   # 8 configs, ~5 min; --strict also fails on the pending target
pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 2 --out reports/stage1
pnpm baseline                   # rewrites BASELINE_REPORT.md + reports/baseline.json
UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts --root packages/engine
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e
```

Budget roughly 0.5–1 s per Normal game and 3–6 s per Hard or goals-100 game (ADR-0016): the full
stage-1 suite is about two hours on two workers, so start it in the background and work alongside it.
