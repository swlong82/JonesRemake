# 1. CLAUDE.md — operating contract

You are building the entire game autonomously. Never ask the human a question; never wait for input. Read this file at the start of every session and after every context compaction.

## 1.1 Session start ritual

1. Read `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`.
2. Resume at the first unchecked task in `PROGRESS.md`.
3. Read only the docs sections that task cites.

## 1.2 Commands (MUST exist and pass at every milestone gate)

```bash
pnpm install --frozen-lockfile
pnpm lint            # eslint + prettier --check, zero warnings
pnpm typecheck       # tsc -b, strict, no any
pnpm test            # vitest, all packages, coverage thresholds enforced
pnpm test:e2e        # playwright, 3 viewports, includes axe checks
pnpm sim:gate        # 500 seeded games per gate config, asserts BALANCE_SPEC
pnpm sim -- --games 10000 --pack classic --out reports/  # full run
pnpm check:banned    # banned-terms scan over src, content, docs output
pnpm art:check       # art sets: manifest, slot coverage, sanitizer, byte budgets (17.8)
pnpm build           # vite build, bundle budget check
pnpm verify          # runs all of the above in order
```

## 1.3 Invariants (never violate)

- `packages/engine` MUST be pure: no DOM, no `Date.now()`, no `Math.random()`, no I/O. Randomness only via injected seeded RNG.
- All state mutation MUST go through `applyCommand(state, command) → {state, events}`. UI and AI use the identical API.
- `GameState` MUST be JSON-serializable and structurally cloneable. Same seed + same command log MUST reproduce identical state (hash-checked in tests).
- Game rules and numbers MUST live in CityPack content (JSON validated by Zod), not hardcoded in engine logic.
- AI MUST NOT read hidden information (other players' future RNG draws, unrevealed events).
- No external network calls at runtime. No analytics, cookies, or third-party assets. All visuals resolve through `AssetRegistry` from a first-party art set (section 17): code-drawn UI chrome plus SVG art files, with generated wireframe placeholders for any slot not yet drawn. User-imported art stays on the device, is sanitized on import and renders only as `<img>` (17.6).
- All user-facing strings MUST use i18n keys.
- Banned terms (see PRD §2.6) MUST NOT appear in code, content, UI or generated docs.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any`, no `@ts-ignore` without an ADR.

## 1.4 Ambiguity policy

When the spec is silent or ambiguous: choose the simplest option consistent with GDD and invariants, implement it, and append an ADR to `DECISIONS.md` (context, options, decision, consequence). Never stop to ask.

## 1.5 Stuck policy

After 3 failed attempts to fix the same failure: isolate the feature behind a feature flag (default off unless required by a gate), log it in `KNOWN_ISSUES.md` with reproduction steps, and continue. A milestone gate MUST NOT be passed by disabling a test that the gate requires; if a gate criterion is unreachable after tuning, log it and record the achieved value, then continue.

## 1.6 Work loop per task

1. Write or update tests first for the task's acceptance criteria.
2. Implement.
3. Run the narrowest relevant command, then `pnpm verify` before marking a task done.
4. Tick the task in `PROGRESS.md` with a one-line note.
5. Commit with Conventional Commits (`feat(engine): ...`), one commit per task.
6. At milestone completion: tag `m<N>` and push; CI must be green.

## 1.7 Coverage thresholds

| Package                       | Lines | Branches |
| ----------------------------- | ----- | -------- |
| engine                        | 90%   | 85%      |
| ai                            | 80%   | 70%      |
| content (schema + validators) | 90%   | 80%      |
| web                           | 60%   | 50%      |

## 1.8 Definition of done (whole project)

All M0–M8 acceptance criteria met, `pnpm verify` green in CI, game deployed to GitHub Pages, `README.md` explains play and dev setup, `BASELINE_REPORT.md` and `BALANCE_REPORT.md` committed.

## 1.9 Hand-over state (added at scaffold time, 2026-09-17)

- M0.1–M0.8 were completed by the scaffold commit; `pnpm verify` was green locally before the first push. Your first job is to confirm it in CI, then tag `m0` and start M1 (see `PROGRESS.md`).
- Spec pack: `docs/SPEC_PACK.md` is the single imported source (amendments already folded in); `tools/split-spec.py` derives `CLAUDE.md` §1 and `docs/*.md` from it, `tools/gen-index.py` derives `docs/INDEX.md`. File map + precedence in `docs/README.md`. Never hand-edit a split file — edit `SPEC_PACK.md` and re-run both scripts.
- `pnpm verify` also runs `pnpm scaffold:check` (ROADMAP_SCAFFOLDS 16) after `check:banned`.
- Scaffold-time deviations from the spec are recorded as ADR-0001…0005 in `DECISIONS.md`; follow them.
- Stubs that exist only to keep `verify` wired end to end are marked `STUB — M<N>` in their file header (`packages/sim/cli.ts`, `tools/gen-command-types.ts`, `packages/content/cli/validate.ts`, engine/ai/sim `src/index.ts`). Each fails loudly the moment the real thing is expected, so a stub can never satisfy a later gate.
- Local e2e in a sandbox with a preinstalled Chromium: `PW_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e`. Never set it in CI.
