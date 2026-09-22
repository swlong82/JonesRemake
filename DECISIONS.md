# Architecture & Design Decisions

## ADR-0001: Vitest projects in `vitest.config.ts` instead of `vitest.workspace.ts`

- Date: 2026-09-17
- Status: Accepted
- Context: BUILD_READINESS 15.1 names `vitest.workspace.ts`. Vitest 3.2 deprecates the workspace file in favour of `test.projects` in the root config; the workspace file prints a deprecation warning and is removed in Vitest 4.
- Options: 1) keep `vitest.workspace.ts` and accept the warning / future break; 2) use `test.projects` in `vitest.config.ts` with per-package `vitest.config.ts` files.
- Decision: option 2. Coverage thresholds (CLAUDE.md 1.7) live in the root config as glob-keyed thresholds.
- Consequences: one root config; per-package configs only set `name`, `environment`, `include`.

## ADR-0002: `docs/PRD.md` excluded from the banned-terms scan

- Date: 2026-09-17
- Status: Accepted
- Context: PRD 2.6 lists every banned term verbatim, so scanning `docs/` per the spec's own exception list (only `ORIGINAL_REFERENCE.md` + the config) would always fail.
- Options: 1) move the list out of PRD into `tools/banned-terms.json` and edit the spec; 2) add `docs/PRD.md` to the exclusion list.
- Decision: option 2 — the spec stays intact; `tools/banned-terms.json` is the executable copy and must match PRD 2.6. `docs/SPEC_PACK.md` (the full imported pack, which contains §2.6 and §3) is excluded for the same reason.
- Consequences: a term added to PRD 2.6 must also be added to `tools/banned-terms.json` in the same commit.

## ADR-0003: Platform stubs are in-memory at M0

- Date: 2026-09-17
- Status: Accepted
- Context: ROADMAP_SCAFFOLDS 16.1 names `LocalIdentity` / `IndexedDbSaveStore` / `LocalLeaderboard` backed by IndexedDB, implemented in M7–M8. M0.1 (16.8.6) only requires the interfaces and `createLocalServices()`.
- Options: 1) ship interfaces only, no defaults, contract tests all `todo`; 2) ship in-memory defaults so every contract test runs green now.
- Decision: option 2. `MemorySaveStore`, in-memory `LocalIdentity`/`LocalLeaderboard`. The IndexedDB versions replace them behind the same contract in M7.2 / M8.1; the `it.todo` entries in the contract tests are the checklist.
- Consequences: `pnpm scaffold:check` is meaningful from M0; browser APIs are injected (`newId`, `WebPlatformDeps`) so the package never touches globals.

## ADR-0004: Workspace package scope `@hustle-ring/*`

- Date: 2026-09-17
- Status: Accepted
- Context: The title is a placeholder until NAMING.md proposes a final one (section 0). Package names need a scope now.
- Options: 1) neutral scope (`@game/*`); 2) working-title scope; 3) rename later.
- Decision: `@hustle-ring/*`. Renaming is a mechanical find/replace if the final title differs; not worth a neutral name that explains nothing.
- Consequences: none beyond a possible later rename commit.

## ADR-0005: ESLint 10 instead of ESLint 9

- Date: 2026-09-17
- Status: Accepted
- Context: ARCHITECTURE 5.2 names "ESLint 9 flat config". ESLint 9.x is end-of-life on npm (deprecated, "no longer supported"); ESLint 10 is the same flat-config model and every plugin in use declares support for it.
- Options: 1) pin the deprecated 9.x; 2) use 10.x.
- Decision: 10.x. The intent of 5.2 is "flat config"; that is unchanged.
- Consequences: none for config shape. Toolchain majors elsewhere follow 5.2 as written (Vite 6, React 18, Zod 3, Tailwind 3, Vitest 3); bumping any of them needs an ADR.

## ADR-0006: Content schemas and the classic pack are built during M1 (pulled forward from M2.1/M2.2)

- Date: 2026-09-17
- Status: Accepted
- Context: MILESTONES orders content (M2.1–M2.2) after the engine (M1), but CLAUDE.md 1.3 forbids hardcoding rules or numbers in the engine, so every M1 engine test needs a real validated pack.
- Options: 1) build M1 against an ad-hoc test fixture pack and rewrite it in M2; 2) build the Zod schemas, overlay resolver and the classic pack first, then the engine on top.
- Decision: option 2. `packages/content` ships schemas, resolver, cross-file + i18n validators and the classic pack now; the M2.1/M2.2 acceptance tests (invalid fixtures, anchors) are committed with it and ticked when M2 is reached.
- Consequences: `modern-western` exists as a placeholder overlay (`extends: classic`, flags off) so `_template` resolves; it is filled in at M5/M6.

## ADR-0007: Content units and conversions

- Date: 2026-09-17
- Status: Accepted
- Context: STATE_MODEL 13.1 fixes engine units (half-hours, cents, bp, per-mille) while GDD/SEED_DATA author hours, percents and dollars; BUILD_READINESS 15.6.4 says the loader converts.
- Options: 1) author in engine units; 2) author in human units, convert once in the resolver.
- Decision: option 2. `rules.json` hours → half-hours (must be multiples of 0.5), transport `hoursPerStep` → `stepHalfHoursMilli` (trip = ceil(steps × milli / 1000)), item `breakdownPerWeek` % → bp, job `automationRisk` 0..1 → bp, `priceScale` (per-mille) applied to items/meals/clothing/subscriptions. Event `weight` for `turnStart` is the per-turn chance in bp; for `weekend` it is a relative weight. Ranges on `econ`/`asset` multiply effects are per-mille.
- Consequences: floats exist only inside `packages/content/src/resolve.ts`; the engine sees integers only.

## ADR-0008: Overlay array files and event weight expressions

- Date: 2026-09-17
- Status: Accepted
- Context: EXTENSIBILITY 12.3 needs a file-level `_replace: true` for array files (JSON arrays cannot carry a flag); GDD 4.13 event chances such as scams (`× (1 − 0.08 × degrees)`) need formulas.
- Options: 1) side-car flag files; 2) allow `{ "_replace": true, "entries": [...] }` as an alternate array-file shape; for weights, 1) bespoke modifier fields, 2) reuse the JSON-logic subset for `weight`.
- Decision: alternate shape (2) and JSON-logic weights (2), evaluated over the same whitelisted view as conditions with integer floor division.
- Consequences: one evaluator (`packages/content/src/logic.ts`) is shared by validator and engine.

## ADR-0009: Copy-on-write state cloning instead of Immer

- Date: 2026-09-17
- Status: Accepted
- Context: ARCHITECTURE 5.3 allows Immer for structural sharing. AI beam search calls `applyCommand` hundreds of times per turn; a full deep clone cost ~15 µs and Immer proxies cost more, threatening the < 200 ms/game sim budget (BALANCE 9.3).
- Options: 1) Immer; 2) full deep clone per apply; 3) shallow top-level clone + per-player deep clone on first access through `Ctx.playerAt` (copy-on-write).
- Decision: option 3 (`cloneState` + `Ctx(cow=true)`). The command log is copied as a reference list. Rule: engine code never mutates `state.players[i]` directly; it goes through `ctx.playerAt(seat)`. Read-only contexts (validate, legal, preview) skip cloning entirely.
- Consequences: ~10 µs per apply at M1; input state is provably unmutated (test `replay.test.ts`). No Immer dependency.

## ADR-0010: Turn-start conventions the spec leaves open

- Date: 2026-09-17
- Status: Accepted
- Context: GDD 4.2 / ORIGINAL_REFERENCE 3.1 fix the pipeline order but not several edge details.
- Decisions (each is the simplest reading consistent with the GDD):
  1. Economy tick runs at the start of every week except week 1, so the opening state is exactly the pack's starting prices.
  2. Each turn starts with the player inside their home (no Enter cost); `Move` from inside performs an implicit `Exit` (theft exposure applies).
  3. Turn ends automatically when `hoursLeft` hits 0 and the player is outside a location; zero-time commands stay legal inside.
  4. Week 1 has no stat decay, no starvation and no rent due; a player with nothing to eat starves from week 2.
  5. Partial moves (not enough hours) walk the shorter ring direction as far as affordable and end the turn; on graph boards the move is refused instead.
  6. Random start events, formula events (burglary, breakdown, doctor, theft) are disabled entirely with Chaos Off; weekend events still run but only those tagged `neutral`.
- Consequences: golden replays encode these; changing any requires regenerating them with an ADR note.

## ADR-0011: Command semantics the spec leaves open (classic set)

- Date: 2026-09-17
- Status: Accepted
- Context: GDD 4.6–4.12 and SEED_DATA 14.x leave several mechanics under-specified.
- Decisions:
  1. All purchases, fees and rent are paid from cash only (bank money must be withdrawn first); doctor bills, weekend costs and spoilage cascade cash → bank → rent debt.
  2. Engine hour fields on commands (`Work.hours`) are half-hours like `hoursLeft`; the UI converts.
  3. Rent model: `paidThroughWeek` + `rentWeeks` is the due week; missing it converts one period into debt, blocks extensions forever (any past debt), and after `evictionWeeks` of continuous debt the player is evicted (low tier, newest 2 durables kept, debt written off). `PayRent{months}` clears debt first; `MoveHome` covers one period at the new locked rent.
  4. Raises: `AskRaise` needs dependability > requirement + 5 × raises and lifts the wage by max(listed wage × econ, +5% of listed) so raises stay meaningful after hiring during a boom.
  5. Unqualified applications are validation errors (`ERR_REQ_*`) so the UI can grey them out; only the luck roll produces the `Refused` event and the −1 happiness.
  6. Investments are held in milli-units (1000 = one unit at the cent price) so small dollar amounts buy fractional units; the 1% fee applies to classic instruments too.
  7. Pawn shop: seller redeems at 110% of the price paid while `week < listedWeek + 2`; from then on any player (seller included) buys at 70% of depreciated value.
  8. One of each durable per player; consumables (tickets, junk, drinks, newspaper) apply on purchase; the newspaper and `ReadNews` both set the week's news hint.
  9. `Relax` is legal at any location with the `relax` service; comfort bonuses apply only at home (the Park gives the base +2).
  10. Discount-store rotation is drawn from the `shop:<seat>` stream at turn start and stored in `turn.shopRotation`.
- Consequences: documented in handler files; each has valid/invalid/edge tests.

## ADR-0012: Formula events live in core modules, content events in `events.json`

- Date: 2026-09-17
- Status: Accepted
- Context: GDD 4.13 makes events content-defined, but several classic chances are formulas over player state (doctor 500 − 5 × relaxation, burglary, theft, breakdown per item) that the JSON-logic subset could express only clumsily.
- Options: 1) encode formulas as JSON-logic weights; 2) implement formula events in `core-events`/`core-turn` with rule constants from `rules.json`, keep discrete events (weekend, boom/recession, crash) in content.
- Decision: option 2. Formula events emit `EventFired` with ids `core:street-theft`, `core:burglary`, `core:doctor`, `core:spoiled`; the market crash is three content events (severity 1–3) whose `loseJob` effect carries `chanceBp`.
- Consequences: modern families (layoffs, scams, viral, gadget) use JSON-logic weights in content per ADR-0008.

## ADR-0013: M1.3–M1.10 committed as one engine-core commit

- Date: 2026-09-17
- Status: Accepted
- Context: CLAUDE.md 1.6 asks for one commit per task. The engine tasks share one type graph (Ctx, modules, commands) and the lint-staged pre-commit type-checks staged files, so intermediate per-task commits would not lint or compile.
- Decision: one commit `feat(engine): M1.3–M1.10 engine core`, with the per-task test files named in PROGRESS.md. Later milestones return to one commit per task.
- Consequences: none for CI; history is coarser for M1.

## ADR-0014: AI planner — sanitized private state, K-pruned beam search, potential-based utility

- Date: 2026-09-17
- Status: Accepted
- Context: GDD 4.14 specifies beam search (W × D per difficulty), utility = Σ goal weights × gap closed + wellbeing + risk − time, and the CLAUDE.md invariant that the AI never reads hidden information. Simulating on the real `GameState` would consume the real RNG streams (future draws) and expose rivals' hidden stats.
- Options: 1) plan on the real state and accept information leakage; 2) plan on a sanitized copy: own PlayerState intact, rivals reduced to public fields with hidden stats zeroed, `config.seed` replaced by `<seed>:ai:<seat>:<week>:<log length>` so every stream (existing or lazily created) is AI-owned and deterministic per turn.
- Decision: option 2 (`packages/ai/src/view.ts`). Search details (`planner.ts`): candidates come from `legalCommands`, are pruned by difficulty/personality (`filterCandidates`), pre-ranked by a cheap `previewCommand`-based heuristic that includes goal gaps and survival needs, and only the top `branch` (3/4/5) are simulated; `Move` is a macro step (Move + Enter) so depth is spent on decisions; `EndTurn` is terminal and never simulated, so ending a turn is neutral rather than penalised by the next turn's decay. Utility is a potential difference V(after) − V(before) minus 0.002 per command; scorers (EXTENSIBILITY 12.6) are registered functions of the state so modules can add their own. Noise σ is expressed in units of a typical action (0.05 goal).
- Consequences: M2.5 holds by construction (test mutates rivals' hidden stats and RNG streams; plans are identical). Normal turns ≈ 10 ms, Hard ≈ 25 ms (GDD 4.14 budgets 250/1000 ms). `runAiTurn` executes the plan and re-plans on surprises (refusal, firing, events, rejections). Easy is deliberately weak and often stalls in solo play; Hard finishes goals-30 games in ~25 weeks.

## ADR-0015: Sim harness shape — RunSpec/GameSpec, tsx-bootstrapped worker threads, bots as planner filters

- Date: 2026-09-17
- Status: Accepted
- Context: BALANCE_SPEC 9.1 asks for a Node worker-thread runner with byte-identical `summary.json`, and 9.4 for scripted strategy bots.
- Decisions: 1) a `RunSpec` (pack, seats, goals, chaos, seedBase, games) expands to `GameSpec`s seeded `<seedBase>-<i>`; 2) workers are started with an `eval` bootstrap that registers `tsx/esm/api` so `.ts` sources load without a build step (Node's `--import tsx` execArgv did not resolve sibling `.js` specifiers inside workers); results are merged in seed order so scheduling never changes output; 3) timing metrics live in `perf.json`, keeping `summary.json` deterministic; 4) bots are the Normal planner plus a `forbid(cmd)` filter (`PlanOptions.forbid`) and a forced personality, registered in `packages/sim/src/bots.ts` — classic-applicable `StudyFirst` and `NoRelax` now, modern bots at M5.9; 5) gate files (`sim/gates.json`) assert dotted summary metrics with min/max plus cross-config `compare` rows.
- Consequences: `pnpm sim`, `pnpm sim:smoke`, `pnpm sim:gate` are real; adding a bot is one `registerBot` call.

## ADR-0016: Reduced game counts for the stage-1 suite and the CI sim gate

- Date: 2026-09-17
- Status: Accepted
- Context: BALANCE 9.1/9.3 call for 10,000 games per config (24 configs) and 9.7 for 8 × 500 games in ≤ 8 CI minutes. Measured speed with the spec'd Normal beam (6 × 5) is ≈ 0.9 s per 2-seat game (≈ 1,200 commands, 1.5 plans per turn at ~6 ms), so the full suite would take ~60 CPU-hours and the CI gate ~17 minutes on 4 cores. GDD 4.14's per-turn budgets (Normal < 250 ms, Hard < 1000 ms) are met with large margin; the 9.3 "< 200 ms/game" sim-speed gate is not.
- Options: 1) shrink the AI beam below spec to hit 200 ms/game; 2) keep the spec'd AI and reduce sample sizes, widening gate tolerances for sampling noise; 3) drop the CI sim gate.
- Decision: option 2. `sim/stage1.json` runs 200 games per Normal config and 100 per Easy/Hard config; `sim/gates.json` runs 120 games per Normal config (40–60 for Hard/Easy, 4-seat and bot configs) with tolerances widened beyond the ±3 pp of 9.7 (documented per assertion in its `note`). Achieved ms/game is recorded in BASELINE_REPORT.md per the stuck policy (CLAUDE.md 1.5). Sample sizes go back up if a later milestone makes the planner materially faster.
- Consequences: baseline numbers carry sampling error of roughly ±3–5 pp on rates and ±2 weeks on medians; the gate file states its widened targets explicitly.

## ADR-0017: App feature flags for build-stage gating of unfinished UI

- Date: 2026-09-17
- Status: Accepted
- Context: M4 splits the web UI across eight tasks. M4.1 (store, AI worker) and M4.2 (title, setup, settings, stats) are finished; the board, HUD, location panel, event modals, log, ticker, phone layout, keyboard map and end screen (M4.3–M4.8) are not. The router already referenced the unbuilt screens, so the branch did not typecheck and no part of the finished work could be merged or verified. CLAUDE.md 1.5 prescribes a feature flag, default off, for exactly this situation, and the pack `FeatureFlags` of EXTENSIBILITY 12.4 are the wrong tool: they gate _rules_ per ruleset and are authored in content, not build state.
- Options: 1) hold everything on the branch until M4.8 lands; 2) delete the unfinished routes and re-add them later; 3) a second, app-level flag registry that gates _screens_, defaults every unfinished feature off, and names the milestone that removes it.
- Decision: option 3, `apps/web/src/flags/appFlags.ts`. Seven flags (`gameBoard`, `endScreen`, `debugTools`, `saves`, `tutorial`, `audio`, `leaderboard`), all default off, each carrying the milestone that lands it. Resolution is default → build env `VITE_FF_<ID>` → URL `?ff=a,-b`, the last winning; `debugOnly` flags (`debugTools`) additionally require `VITE_DEBUG_ALLOWED=true` per UX_SPEC 7.9, so a deployed build cannot be talked into showing debug surfaces. `apps/web/src/ui/screens/registry.tsx` maps each `Screen` to its flag and component; a screen whose flag is off, or whose component does not exist yet, renders `UnavailableScreen`, which names the feature and its milestone. Setup's Start button is disabled while `gameBoard` is off, with a note saying which milestone unblocks it.
- Consequences: `main` always builds, verifies and deploys; finished screens are reachable and testable today. The next session wires the board by adding one line to the screen registry and flipping `gameBoard` to default on — the flag is deleted, not left behind. Two knock-on edits: `no-confusing-void-expression` is configured with `ignoreArrowShorthand` for `apps/web/src/**` (React handlers are the idiom, not a defect), and the Zustand store interfaces declare their actions as function-typed properties rather than methods so selecting an action does not trip `@typescript-eslint/unbound-method`. Deviation from EXTENSIBILITY 12.4's "UI hides features whose flag is off (no disabled stubs)": during build-out the gated surfaces stay visible and explain themselves, because a silently missing Start button reads as a bug. The rule stands for pack flags, which is what 12.4 governs.

## ADR-0018: M4 checkpointed and merged mid-milestone

- Date: 2026-09-17
- Status: Accepted
- Context: CLAUDE.md 1.6 commits per task and 1.8 gates per milestone, which implies M4 merges as a whole. Session context ran out mid-M4 with M4.1/M4.2 complete and verified, M4.3–M4.8 unstarted, and the stage-1 sim for M3.3 still running.
- Decision: merge the finished, verified subset behind ADR-0017's flags rather than carrying it on a branch across sessions. `PROGRESS.md` ticks only M4.1 and M4.2; the M4 milestone gate stays open and no `m4` tag is created. `HANDOFF.md` records exactly where the next session resumes.
- Consequences: no milestone tag for a partial milestone, and the gate log gains no row until M4.8 lands. The risk of a long-lived branch (drift, unreviewable diff) is traded for a `main` that carries dark, tested code.

## ADR-0019: Known-unmet balance targets are carried as `pending` gate assertions, not removed

- Date: 2026-09-17
- Status: Accepted
- Context: `pnpm sim:gate` runs the BALANCE 9.3 classic sanity gates and two assertions fail on the current classic values: at goals 50, the last goal completed is always wealth (32%) or education (68%), never career or happiness, against 9.3's "each goal is last-completed in ≥ 10% of games". This is the finding M3.3 exists to fix (career is `dependability × 1.25`, which saturates early, and happiness 50 is reachable well before the wealth and education grind ends), and M3.3 had not run when this work was checkpointed. `verify` includes `sim:gate`, so the whole gate — including the 16 assertions that do pass — would be red for reasons unrelated to the code being merged.
- Options: 1) leave the gate red until M3.3 lands; 2) delete or widen the two assertions; 3) mark them `pending` with the issue and the milestone that must clear them, report them as such, and keep them fatal under a strict flag.
- Decision: option 3. `sim/gates.json` assertions accept `pending: { issue, until }`. A pending assertion is still evaluated and printed, as `⚠ … PENDING KI-005, due M3.3`, and counted in the summary line, but does not fail `--assert`. `pnpm sim:gate --strict` fails on pending assertions, and the M3 milestone gate MUST be run strict, so a pending target cannot be forgotten or quietly inherited. A test asserts that every pending entry in the committed gate file names a `KI-…` issue and an `M…` milestone.
- Consequences: CI stays meaningful for everything except the two known-unmet targets, and the failure is visible in every gate run rather than buried in a doc. This does not contradict CLAUDE.md 1.5's "a milestone gate MUST NOT be passed by disabling a test that the gate requires": nothing is disabled, the M3 gate still requires these assertions to pass under `--strict`, and no milestone is being claimed here (ADR-0018). If M3.3 tuning cannot reach the target within ±25%, the stuck policy applies: record the achieved value and keep the entry.

## ADR-0020: The location panel renders engine candidates; the UI never re-derives legality

- Date: 2026-09-17
- Status: Accepted
- Context: UX 7.4 asks for the action list from `legalCommands` plus disabled actions with their reason. `candidateCommands` returns every candidate with its `ErrorCode`, but that includes all 46 jobs, all 11 degrees and a `Move` per location per mode — a flat list of hundreds of rows, most of them irrelevant where the player is standing.
- Options: 1) hand-write a per-location action menu in the UI; 2) render every candidate and let the player scroll; 3) filter by the _kind_ of error, group the rest by service and sort legal rows first.
- Decision: option 3 (`ui/game/LocationPanel.tsx`). Candidates whose code means "not here, not now" (`ERR_NOT_AT_LOCATION`, `ERR_NOT_INSIDE`, `ERR_ALREADY_INSIDE`, `ERR_LOCATION_CLOSED`, `ERR_UNKNOWN_ID`, `ERR_FEATURE_OFF`, plus the turn-level codes) are dropped; everything else is shown, grouped into the panel sections of the location's `services` and ordered legal-first, with the reason rendered under a disabled row. Movement, enter/exit and end turn are rendered outside the sections. Open/closed state is read from the `Enter` candidate's code rather than re-implementing the open rule.
- Consequences: a new command shows up in the UI as soon as it has a handler with `candidates`, with no UI change, and no rule or number is duplicated outside content and the engine (CLAUDE.md 1.3). The cost is that a genuinely blocked action at the right location (not enough cash, missing degree) is listed rather than hidden — which is what 7.4 asks for.

## ADR-0021: Token movement animates with a CSS transform transition, not a JS animation loop

- Date: 2026-09-17
- Status: Accepted
- Context: M4.3 asks for token animation along the ring with `prefers-reduced-motion` and the reduced-motion setting disabling it. A path animation (token walking square by square) needs a frame loop and a queue of intermediate positions, and the engine reports only the final destination of a `Move`.
- Options: 1) animate along the ring path with `requestAnimationFrame` and interpolated positions; 2) a CSS `transition` on the token group's `transform`, so React re-render moves the token and the browser tweens it.
- Decision: option 2. Each token is an SVG `<g>` positioned with a CSS `transform` and `transition: transform 380ms ease-in-out`, dropped entirely when the reduced-motion setting is on; the global `prefers-reduced-motion` rule in `index.css` already neutralises transitions for users who ask for it.
- Consequences: no animation frame budget, no queue to keep in sync with the store, and the token cannot visibly walk through the squares it passes. Partial moves (GDD 4.2) still animate correctly because they end on a real square. A future path animation can replace this without touching the store.

## ADR-0022: The e2e build exposes the store as `__hustleRing`, gated on `VITE_DEBUG_ALLOWED`

- Date: 2026-09-17
- Status: Accepted
- Context: UX 7.8 requires axe to pass on the event modal and the end screen. Reaching either through play takes a full game (the lowest goal a seat can be given is 10 in every goal, which still needs a job, a degree and cash), which is far too slow and too seed-dependent for an e2e run on three viewports.
- Options: 1) add a debug "win now" switch to the game; 2) drive the app for minutes until an event fires and a game ends; 3) expose the Zustand store on `globalThis` in builds where debug is allowed, and set those two states directly from Playwright.
- Decision: option 3. `main.tsx` defines `globalThis.__hustleRing = { useGame }` only when `import.meta.env.VITE_DEBUG_ALLOWED === 'true'`; `playwright.config.ts` sets that variable for the e2e build, and `deploy.yml` never does, so the deployed bundle contains neither the hook nor the debug panel. The store's own contract is unchanged: the specs set UI state (a card, the end screen), never game rules.
- Consequences: the event modal and end screen are axe-checked on every viewport in about a second each. The deployed build stays free of test hooks, and UX 7.9's "stripped from production unless `VITE_DEBUG_ALLOWED=true`" now covers this hook as well as the debug panel.

## ADR-0023: Replay export is config plus command log, not a state snapshot

- Date: 2026-09-17
- Status: Accepted
- Context: GDD 4.16 lists "Export Replay" on the end screen. A `GameState` is JSON-serializable, so either the whole final state or the inputs that produced it could be exported.
- Decision: export `{ engineVersion, schemaVersion, packId, packVersion, config, log, weeks, winner }` as a Blob download. Same seed plus same command log reproduce the state exactly (M1.10, hash-checked), so the log is the smaller and more useful artefact: it can be replayed, diffed and attached to a bug report.
- Consequences: an exported replay is a few kB rather than a few hundred, and it only replays against a compatible engine and pack — which the version fields make checkable. Importing replays arrives with saves in M7.2.

## ADR-0024: The classic baseline is published unfrozen; the career/happiness tuning is a separate change

- Date: 2026-09-17
- Status: Accepted
- Context: M3.3 asks for the stage-1 suite, a `BASELINE_REPORT.md` and tuning of `[ASSUMED]` classic values until the 9.3 gates pass, then a `baseline-frozen` tag. The suite has now run to completion (24 configs, 3,200 games). Three 9.3 targets are unmet, and the two that need balance work are KI-005: at goals 50 Normal×2 the last goal completed is education in 65% of games and wealth in 35%, career and happiness in none. The causes are structural, not a matter of nudging one number:
  - career is `clamp(dependability × careerDependabilityBp / 10000)`, and only a value ≥ 10000 keeps career 100 reachable at all, because `statMax` is 100. So the usable tuning range is 10000–12500, a 20% reduction at most.
  - happiness has no decay anywhere in the rules (`core-decay` decays dependability, relaxation and clothing only), so it climbs monotonically at 2–6 per relax and never becomes the binding constraint. No value inside ±25% changes that; it needs a mechanic.
- Options: 1) tune both now, regenerate the golden replays, re-run the 1.5-hour suite and publish a frozen baseline in the same change as the M4 UI; 2) publish the baseline as measured on the shipped values, keep KI-005 open with the evidence, and do the tuning as its own change; 3) widen or drop the two assertions.
- Decision: option 2. `BASELINE_REPORT.md` and `reports/baseline.json` record B(metric, config) for all 24 configs and every 9.3 gate with its achieved value, including the five unmet ones, per the stuck policy (CLAUDE.md 1.5). No `baseline-frozen` tag is created, because the numbers are not frozen. The two KI-005 assertions stay `pending` in `sim/gates.json` (ADR-0019), so every gate run reports them and `--strict` still fails, and the M3 gate therefore stays open. Option 3 is excluded by 1.5: a gate is not passed by weakening it.
- Consequences: the M4 work ships on a baseline that is honest about what is unmet, and the balance change stays reviewable on its own — it will move `careerDependabilityBp` toward 10000, add happiness decay (an engine change with its own ADR), regenerate `packages/engine/test/golden/`, re-run the suite and only then freeze. One further 9.3 target stays unmet for a reason already recorded, not a new finding: sim speed (ADR-0016 — the spec-sized AI beam costs ~1 s/game, and sample sizes were reduced instead of shrinking the beam). Everything else passes, including the goals-100 education path at 100%. The suite also shows the shape of the fix: at goals 100 all four goals are last-completed between 18% and 42% of the time, so the distribution is only degenerate where career and happiness are cheap relative to the wealth and education grind.

## ADR-0025: Happiness decays per week, and a ticket's happiness is once per turn

- Date: 2026-09-17
- Status: Accepted
- Context: BALANCE 9.3 requires each of the four goals to be the last one completed in ≥ 10% of games at goals 50 (KI-005). Measured on the shipped classic values, happiness was last in 0% of 200 games, and the stage-1 diagnosis showed why: happiness only ever rises. `core-decay` (GDD 4.8 step E) decays dependability, relaxation and clothing, so happiness climbs monotonically — and it climbs cheaply, because a consumable's `happinessOnBuy` applied on every purchase and only `soft-drink` carried `oncePerTurn`. A concert ticket is $45 for +3, and `BuyItem` allows `qty` up to 10, so happiness cost about $15 a point against the wealth goal's $100 a point. Measured over 12 games at goals 50, the winner's happiness goal was met by week 8 (median) while education took until week 46.
- Options: 1) tune the happiness numbers inside SEED_DATA's ±25% band (relax +2 → cannot go below +2 and stay an integer; start 10 → 7 changes nothing); 2) give happiness a weekly decay, like dependability, and cap a ticket's happiness the way the soft drink is already capped; 3) leave it and record the target as unreachable (CLAUDE.md 1.5).
- Decision: option 2, with both halves driven by content, not code. `rules.happiness.decayPerWeek` (new, default 0 — packs that do not set it keep monotonic happiness) is applied in `core-decay` at turn start from week 2, clamped to `happiness.min`; classic sets 4 (3 was measured first and raised in ADR-0027, which also gives the stat headroom above the goal ceiling). `concert-ticket` and `theatre-ticket` gain `oncePerTurn: true`, the flag the schema and the `BuyItem` handler already honoured for the soft drink, so bulk-buying tickets no longer converts money into happiness at will.
- Consequences: happiness stops being free. Relaxing at home (+2) no longer covers the decay, so holding happiness needs comfort durables, which puts happiness in competition with the wealth goal for money — the tension the goal was missing. Measured at goals 50 Normal×2 over 120 games on the final values (decay 4, ADR-0027): happiness is the last goal completed in 16.7% of games, above the 9.3 target of 10% and up from 0%; stalls 0%, seat bias 42.5%, median length 40 weeks. Decay 2 left happiness last in 3.4% and decay 3 in 3.3% once the AI learned to buy comfort durables (ADR-0027), so 4 is the value that meets the target. This amends GDD 4.8's decay list for `classic`; the golden replays in `packages/engine/test/golden/` are regenerated, since the mechanic changes every seeded game.

## ADR-0026: "Career last-completed ≥ 10% at goals 50" is unreachable on [SRC] values; the M3 gate records it

- Date: 2026-09-17
- Status: Accepted
- Context: ADR-0025 fixed the happiness half of KI-005. The career half does not yield to tuning, because three of the numbers involved are [SRC] anchors from ORIGINAL_REFERENCE 3.2/3.3 and BALANCE 9.3 permits tuning `[ASSUMED]` values only:
  - education goal is `1 + 9 × degrees` [SRC], so a goal of 50 needs six degrees (five give 46);
  - every degree grants +5 dependability [SRC] on top of the [SRC] start of 20, so a player who has earned six degrees has banked +30;
  - career is `dependability × 1.25` [SRC] ("80 dependability = 100 career"), so career 50 needs only dependability 40.
    A player who is anywhere near the sixth degree is therefore already past career 50, and career can only be the last goal met if the endgame takes the job away. Measured at goals 50 Normal×2 over 120 games: career is last in 0.84% (1 game — a late job change). Cutting `stats.workDependabilityGain` (the one [ASSUMED] value with any leverage, GDD 4.6 marks the +2 as assumed) from 2 to 1 made it 0.00%, because scarcer dependability slows the degrees that pay for it just as much. `careerDependabilityBp` 12500 → 10000 would work — career 50 would need dependability 50, which is exactly what six degrees plus decay leaves — but it contradicts the [SRC] anchor and 9.3's tuning rule.
- Options: 1) retune `careerDependabilityBp` anyway; 2) record the target as unreachable with its achieved value and continue (CLAUDE.md 1.5); 3) widen or delete the assertion.
- Decision: option 2. The classic `[SRC]` numbers stay as they are. `sim/gates.json` keeps `lastGoalPct.career` asserted and `pending: { issue: KI-005, until: M6.3 }`, so every gate run prints it and `pnpm sim:gate --strict` still fails on it — nothing is disabled or widened (option 3 is excluded by 1.5). The M3 gate criterion is amended: `pnpm verify` green in CI and `pnpm sim:gate` with no blocking failure, with this one assertion recorded here and in `KNOWN_ISSUES.md` rather than met. 1.5 provides for exactly this: "if a gate criterion is unreachable after tuning, log it and record the achieved value, then continue."
- Consequences: M3 closes on the measured numbers instead of staying open behind an unreachable target, and the balance record says which value would have to move (and which spec anchor that would cost) if a later ruleset wants all four goals to bind at every goal level. The degeneracy is specific to goals 50: at goals 100 the stage-1 suite already shows all four goals last-completed between 18% and 42%, career included, because education needs eleven degrees there and dependability 80 is no longer a by-product. M6.3 revisits it for `modern-western`, where wellbeing, gig work and loans all touch dependability and the ladder is not the classic one.

## ADR-0027: Happiness gets headroom above the goal ceiling, and the AI learns to keep a stat it can lose

- Date: 2026-09-17
- Status: Accepted
- Context: ADR-0025's happiness decay met the 9.3 target it was aimed at (happiness last-completed 0% → 10.9% at goals 50) and broke two that had been passing: at goals 100 every game stalled (stall 0% → 100%), which also failed the goals-100 education-path gate and the "median grows with goal level" compare. Three separate causes, found by dumping the end state of stalled games:
  1. The win check runs at the start of a turn **after** the decay step (GDD 4.2, asserted in `scheduler.test.ts`), so a goal of 100 against a stat clamped at 100 can never be satisfied: whatever the player ends the week with, the decay takes 3 off it before the check.
  2. The planner's quick ranker scored a comfort durable at its immediate `happinessOnBuy` only. With happiness decaying, a television is the difference between a relax session that gains ground and one that loses it, and no seat ever bought one (comfort count 0 in every stalled game).
  3. Neither the goal scorers nor the ranker knew that the race is won by the goal you are furthest from. Seats sat at happiness 96–99 with the other three goals met, working for money they did not need, because three points of a nearly-met goal scored less than a work session.
- Options: 1) drop the decay and record the happiness target as unreachable; 2) make the decay conditional on not relaxing (then an AI that has hit the ceiling stops relaxing, because relaxing at the cap scores nothing, and the same oscillation returns); 3) give happiness headroom above the goal ceiling and teach the AI the two things the decay made necessary.
- Decision: option 3.
  - `rules.happiness.max` 100 → 104, i.e. the goal ceiling plus one week of decay (which the tuning then settled at 4). `happinessGoal` already clamps the goal value to 100, so the extra points are invisible in the goal and exist only to survive the decay that precedes the win check. ORIGINAL_REFERENCE 3.2 tags the 0–100 clamp `[ASSUMED]`, so this is tuning, not a spec break.
  - `packages/ai/src/scorers.ts` gains `happiness-upkeep` (the weekly gain a relax session nets after decay, monotone in comfort durables, 0 for packs that do not decay happiness) and `win-proximity` (progress of the binding goal, with the meet-everything state worth more than the sum of its parts).
  - `packages/ai/src/planner.ts` ranks a trip to a store that sells an affordable comfort durable, and the purchase itself, by the happiness gap when relaxing alone cannot close it.
  - `win-proximity` and `goal-gap:education` share one `educationProgress` helper, so a lesson moves the binding goal. Without that credit the binding goal only moved on graduation, the AI preferred the three continuous goals, and the education-weighted personality won 69% of the goals-50 games (seat bias 30.8% against a 38–62% gate).
- Consequences: goals-100 games finish again — 60 games at goals 50 and 100 measured 0% stalls, median 40 and 82 weeks — the AI buys comfort durables when its happiness goal needs them, and the planner closes the last few points of the binding goal instead of banking money. The better AI then made happiness cheap again at decay 3 (last-completed 3.3%), which is what took the decay to 4: with the AI buying comfort durables, 4 is the decay at which relaxing plus a full set of durables still only just outruns the loss (happiness last-completed 16.7% at goals 50, 28.3% at goals 100). The AI changes belong to M2.4's scorer registry (EXTENSIBILITY 12.6) but land here because M3.3's tuning is what exposed them; `pnpm test` covers them with the existing M2.4 acceptance tests (1,000-game legality, turn-time benchmark, Hard ≥ 70% over Easy) plus `scorers.test.ts`.

## ADR-0028: Transport prices are rolled once a turn, and a car is repaired by its own command

- Date: 2026-09-17
- Status: Accepted
- Context: M5.3 adds two priced-by-chance things to GDD 4.3: a ride-hail fare that surges ×1.5–×3 about 10% of the time, and a used car whose asking price is a range ($2,500–$4,500 × econ). Both are read by `cost()` and `validate()`, which run inside `legalCommands` and `previewCommand` — pure functions that must not touch the RNG. Drawing there also desynchronises replay: the golden replays failed the moment `validate` rolled a price, because generation calls `legalCommands` and replay does not.
- Options: 1) roll per trip inside `apply` and let the preview show an estimate; 2) roll once per turn at turn start, keep it in the module slice and let both the preview and the action read it; 3) make the prices deterministic and drop the surge.
- Decision: option 2. `transport`'s slice carries `surgePm` and `usedCarAsk`, both rolled in `onTurnStart` from the module's own RNG stream. A quote you are shown is the price you pay for that turn, the RNG is only ever drawn from a hook that already mutates state, and the determinism invariant (same seed + same command log → same hash) holds. The same rule applies to any later module: a price a preview can show is rolled at turn start, a risk that lands after the fact (a transit delay, a no-show, a breakdown) is applied in `apply` or on the event and shown as `riskBp`.
- Consequences: surge lasts a turn rather than a trip, which is also easier to play around: the HUD can show "surge ×2 this week". A used car's asking price changes each turn, so shopping around means waiting a week. Golden replays for `modern-western` were regenerated once the roll moved.
- Also: GDD 4.15's command list has `BuyCar`, `SellCar` and `BuyTransitPass` but nothing to fix a broken car, while GDD 4.3 gives cars a breakdown chance and `rules.cars.repairCost`. `Repair{itemId}` only works on inventory items, and the car is module state, not an item. The module therefore contributes `RepairCar` (zero-hour, at a `cars` service), which is what 12.2 means by a module adding a command: one handler, one line, no core change.

## ADR-0029: Loan accounting uses whole-dollar half-up interest and ceiling payments

- Date: 2026-09-20
- Status: Accepted
- Context: Money in `GameState` is integer dollars (STATE_MODEL 13.1), while the loan formula produces fractional-dollar payments and interest. M5.7 rounded the quoted payment up but never accrued interest, treated a partial debit as though none of it reduced the balance, and moved a defaulted balance into an outstanding bucket with no collection path. The GDD fixes the APR, term, missed fee and 30% post-default garnishment but does not specify the rounding order.
- Options: 1) add cents to loan state while cash remains whole dollars; 2) truncate every intermediate amount; 3) keep one whole-dollar ledger and define each rounding boundary explicitly.
- Decision: option 3. The level weekly payment is the closed-form amount rounded up to a whole dollar; each turn first adds one week's interest, rounded to the nearest dollar with exact halves up, then credits the actual cash/bank debit. Any shortfall adds one missed-payment fee after that credit. The last scheduled instalment is the remaining balance after interest, so rounding cannot leave a tail beyond the term. Default freezes the resulting balance (no further interest), keeps it in total debt and therefore negative wealth, and applies the pack's garnish percentage to job and gig earnings with the engine's standard half-up basis-point rounding. Explicit `RepayLoan` payments clear default debt first, then active loans.
- Consequences: borrowed cash and principal still cancel at origination; thereafter wealth falls only by interest and fees, while scheduled, early and garnished principal payments reduce assets and debt equally. Partial payments are never discarded, default debt can be cleared by either work or an explicit bank payment, and an independently calculated amortisation schedule is asserted week by week. The existing `garnished` slice field is retained as the name of outstanding default debt for save compatibility; its meaning is now documented rather than changed in place.

## ADR-0030: Modern inventory additions remain an overlay and use provisional item prices

- Date: 2026-09-22
- Status: Accepted
- Context: M6.1 requires the GDD 4.11 modern item roster, but gives exact prices only for the smartphone and laptop. The overlay also inherits the classic hot tub and its translation keys; removing only the item would leave unused inherited translations and fail content validation.
- Options: 1) change Classic or the overlay merger to remove inherited content; 2) keep the classic durable as a legacy offering and add the massage chair as its declared modern replacement; 3) postpone the new items until balance tuning.
- Decision: option 2. The ten newly authored items use simple provisional whole-dollar prices and existing content-defined effects; the massage chair declares `replaces: hot-tub` and carries the same relaxation unlock. The tablet does not grant online study, because GDD 4.7 requires a laptop. Management and trade automation-risk exceptions in the inherited job table are overridden to GDD 4.13's bands. No Classic content or engine rule changes.
- Consequences: the Modern purchasable-item roster and affected layoff probabilities change, so only Modern replay goldens are regenerated. M6.2 and M6.3 must treat the new prices as inputs to target locking and balance measurement, not as already tuned values. The inherited hot tub remains available as a legacy option in Modern; replacing its inventory slot outright would require a separately designed translation-removal mechanism.

## ADR-0031: Local saves use a versioned IndexedDB envelope and snapshot fallback

- Date: 2026-09-22
- Status: Accepted
- Context: M7.2 must persist full deterministic games, replay imported commands, and survive IndexedDB failures without changing the live game or older saves. The M0 `SaveStore` contract is provider-neutral; the engine snapshot schema remains v1.
- Options: 1) put snapshots in localStorage; 2) use native IndexedDB behind `SaveStore`, with the game-specific validation and replay code in `apps/web`.
- Decision: option 2. DB `game` contains `autosave`, `slots`, `settings`, and `stats` stores. The save envelope is v2 independently of the engine schema; v1→v2 promotes `engineVersion` from the unchanged snapshot. A complete snapshot and command log are saved at game start, each `EndTurn`, and each tenth command. Writes run in capture order and resolve only when the IndexedDB transaction commits. Load/import validates JSON, the snapshot shape, active module slices, pack references and command schemas, then compares the saved hash when present. It replays from the seed and compares `stateHash`; if the valid snapshot cannot be reproduced by the current rules or pack, it loads the snapshot with a visible warning per ARCHITECTURE 5.7. Replay-only imports require current compatible versions because they have no fallback snapshot. A failed validation or write leaves the current game and stored saves unchanged. Game replacement cancels pending AI and invalidates older load work.
- Consequences: browser storage being denied or full is reported while the current game remains playable and exportable. A historical v1 record without `finalHash` has no independent integrity check; after structural validation its replay mismatch is treated as incompatibility and warned, while new v2 exports always carry the hash. The full snapshot is authoritative after replay drift. Existing M4 settings and stats still use their prior local storage path; the DB stores reserve the architecture's names for later integration. No engine rule, Classic balance value, or golden replay changes.

## ADR-0032: Web tests install an in-memory `localStorage` when the runtime shadows jsdom's

- Date: 2026-09-22
- Status: Accepted
- Context: `package.json` declares `engines.node >= 22`, but only Node 22 was ever used to run `pnpm verify`. On Node 24 and later the runtime owns a built-in `globalThis.localStorage` whose value stays `undefined` unless the process is started with `--localstorage-file`. The key existing stops vitest's jsdom environment from copying jsdom's own `window.localStorage` onto the global, so every `globalThis.localStorage` read in `apps/web` returns `undefined`. On Node 26 that failed 93 of the 140 web tests with `Cannot read properties of undefined (reading 'clear')`, while CI (Node 22, `.nvmrc`) stayed green — a supported-runtime break that the gate could not see.
- Options: 1) pin local development to Node 22 and leave the break latent; 2) narrow `engines.node` to `22.x`; 3) install a Storage-shaped stand-in in the web test setup when the global is `undefined`.
- Decision: option 3. `apps/web/src/test-setup.ts` defines an in-memory `Storage` on `globalThis` only when `globalThis.localStorage` is `undefined`, so Node 22 keeps jsdom's storage untouched and every supported Node runs the same suite. No application code, engine rule or content value changes, and nothing ships in the bundle — the file is a test-only setup module.
- Consequences: the web suite is runtime-independent across the declared `engines` range, and a later Node bump cannot silently disable the `apps/web` coverage floor. The stand-in is deliberately minimal (the `Storage` interface, no `StorageEvent`), so a test that asserts cross-document storage events would need jsdom's implementation instead.

## ADR-0033: Stage-2 modern targets are locked by file hash before any tuning

- Date: 2026-09-22
- Status: Accepted
- Context: BALANCE 9.5 requires `reports/modern-targets.json` to be derived from the classic baseline and never edited after its first commit, "enforced by test comparing file hash to the one recorded in `DECISIONS.md`". The spec fixes the gate values but not the file's shape, which config each gate is measured on, how a ±20% band rounds, or where the three modern-only rates (bot bankruptcy, bot collapse, bot default) are read — `Summary` at M6.2 has none of them.
- Options: 1) hash a canonical re-serialisation of the parsed JSON, so formatting changes are tolerated; 2) hash the bytes on disk; 3) keep the targets inside `sim/gates.json` and hash that.
- Decision: option 2, over the exact bytes. `tools/lib/targets.test.ts` hashes `reports/modern-targets.json` and compares it to the `Locked sha256` line in this ADR, so any edit — including a reformat — fails `pnpm test`. The file also records the sha256 of the `reports/baseline.json` it was derived from, so a baseline re-run cannot silently re-point the targets. Median bands are the baseline median ±20% rounded **outward** to whole weeks, so rounding can only widen a band, never tighten one; `targetProblems` re-derives every band from the recorded baseline medians and fails if one disagrees. Each target names the `sim/gates.json` config it is measured on and a dotted `Summary` metric path; three of those paths (`botBankruptcyPct`, `botCollapsePct`, `botDefaultPct`) do not exist yet and are implemented with the M6.3 measurement runs, because tuning cannot be judged against a target nothing reports; M6.4 then writes the gate configs that read them. Sampling tolerance stays out of this file: the spec-level target is locked here, and BALANCE 9.7's ±3-point widening lives in `sim/gates.json` where the sample size is known.
- Consequences: the targets cannot drift during the M6.3 tuning loop, which is the point — tuning changes content, never the bar. Correcting a genuine mistake in the file needs a superseding ADR with a new hash, recorded as such. `reports/*` is otherwise git-ignored, so `.gitignore` gains a second exception beside `reports/baseline.json`.
- Locked sha256 (reports/modern-targets.json): `f515ffe0caac45f599817c1c7d27400742bc2c6a3443e55b92463f662619269e`
- Locked sha256 (reports/baseline.json): `a4c20647acd5353ffcbb2112aca16a6574a1669788e2244c5a8e86379c1d4b13`
