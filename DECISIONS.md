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
