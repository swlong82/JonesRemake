# Handoff

State of the build after M5, its merged follow-up PR #16, the M6.5 UI slice and M6.1 content.
Read `CLAUDE.md` first, then this file, then resume at the first unchecked task in `PROGRESS.md`
(M6.2). M6.5 landed out of sequence because it completed the modern action surface already started
by PR #16.

## Where the build is

| Area                                   | State                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `packages/shared`, `engine`, `content` | Complete through M1–M2 and the M5 modules; tags `m1`, `m2` local (KI-001)   |
| `packages/ai`                          | M2.4–M2.5 plus the M5.9 modern coverage and three module scorers            |
| `packages/sim`                         | Runner, bots (6), metrics, reports and gates complete                       |
| Classic balance (M3)                   | **Closed** — tag `m3` (local). One target recorded unmet, not met: ADR-0026 |
| `apps/web`                             | Classic playable; M6.5 modern UI complete                                   |
| Modern systems (M5)                    | **Complete** — nine modules behind CityPack flags, tag `m5` (local)         |
| M6                                     | M6.1 and M6.5 complete; M6.2–M6.4 and the M6 gate remain open               |
| M7–M8                                  | Not started                                                                 |

The last milestone verification record is the M5 run in `PROGRESS.md`; do not reinterpret it as an
M6 gate. The one thing to know before reading a gate run is that `lastGoalPct.career` remains an
accepted pending classic assertion, recorded as structurally unreachable in ADR-0026 and KI-005.
M6 cannot close until M6.2–M6.4 are complete and its own CI evidence exists.

The isolated M6.1 completion branch passed `pnpm verify` locally on 2026-09-22: 63 test files / 578
tests, 27 Playwright + axe checks, initial bundle 162.6 kB gzip of 350, and `sim:gate` 18
assertions / 0 failed / 1 accepted pending (KI-005). No CI gate, merge, deployment or milestone tag
is claimed by this content task.

The isolated M6.5 completion branch passed `pnpm verify` locally on 2026-09-22: 62 test files / 573
tests, 27 Playwright + axe checks across three viewports, bundle 156.7 kB gzip of 350, and
`sim:gate` 18 assertions / 0 failed / 1 accepted pending (KI-005). This is task evidence, not an M6
gate or tag.

`origin/main` now contains M5 and PR #16. The prior statement that M5 was unmerged and the live build
was M4-only was stale; this handoff does not claim a fresh deployment check.

## Branch and tags

- `origin/main` was fetched at `4e3964d` (`Fix/ai loans modern actions (#16)`) before the M6.5
  completion work started in its isolated worktree.
- Tags `m1`…`m5` exist **locally only** — the session cannot push tags (KI-001). Their SHAs are in
  the PROGRESS gate log; push them with `git push origin --tags` from a machine that can.

## Resume here: M6 — modern pack and balance

M5 left `modern-western` carrying working content for every system, but only the content the rules
needed. M6 is turning it into a complete pack and locking its balance targets.

1. **M6.1 — complete.** `modern-western` now overrides the 16 location names and all 3+3 greetings
   and farewells, the 46 inherited job titles, 11 degrees, meals and clothing. The ten missing
   GDD 4.11 items are in `items.json`, with translations and visual entries. `AssetRegistry` resolves
   their icons rather than falling back to the generic building. Five inherited management/trade
   jobs received GDD 4.13 risk corrections; other jobs already fit their bands. The phone, laptop,
   case, subscriptions, modern assets, loans and events were already present and were not rebuilt.
   `packages/content/src/packs.ts` statically registered all edited pack files already, so no new
   import was needed. Modern goldens were regenerated for the changed item roster/risk values;
   Classic goldens did not change. ADR-0030 records provisional prices and the legacy hot-tub
   overlay constraint. These item prices are not M6.2 target locks or M6.3 balance tuning.
2. **M6.2** — write and lock `reports/modern-targets.json`, hash in an ADR.
3. **M6.3** — the BALANCE 9.6 tuning loop until the 9.5 gates pass; `BALANCE_REPORT.md` is the
   output. This is also where KI-005's career target is revisited for the modern ladder (ADR-0026).
4. **M6.4** — add modern configs to `sim/gates.json`, keeping the classic sanity gates.
5. **M6.5 — complete out of order.** PR #16 added the modern service sections, HUD totals, loan and
   investment summaries, sparkline, transport selector and modern action labels. The completion
   fixed default debt being mistaken for “no active loans”, displays the pack-defined wage
   garnishment in the HUD and bank panel, exposes `StudyOnline`, and adds the GDD 4.11 retention
   confirmation. The dialog traps and restores focus and blocks gameplay shortcuts behind it. The
   cancellation request is bound to an engine-state hash: cancel/Escape sends no command, and a
   game or turn change invalidates the pending request before it can dispatch.

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
  `defaultDebtOf`, `totalOwed`), never by reaching into `player.modules[x]`.
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
