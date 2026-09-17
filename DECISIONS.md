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
- Decision: option 2 — the spec stays intact; `tools/banned-terms.json` is the executable copy and must match PRD 2.6.
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
