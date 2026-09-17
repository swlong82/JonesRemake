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
