# 15. docs/BUILD_READINESS.md — toolchain, budgets, amendments

## 15.1 Root files CC creates in M0

| File | Content |
| --- | --- |
| `.nvmrc` | `22` |
| `package.json` | `"packageManager": "pnpm@9.x"`, `"engines": {"node": ">=22"}`, scripts below, `"private": true` |
| `pnpm-workspace.yaml` | `packages/*`, `apps/*`, `tools` |
| `tsconfig.base.json` | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: bundler`, `target: ES2022`, project references |
| `eslint.config.js` | flat config; boundaries; `no-restricted-syntax` for banned Math calls in engine; `i18next/no-literal-string` in web |
| `.editorconfig`, `.prettierrc` | 2 spaces, LF, single quotes, trailing commas |
| `vitest.workspace.ts` | one project per package; coverage thresholds from CLAUDE.md 1.7 |
| `playwright.config.ts` | projects `desktop` 1440×900, `tablet` 1024×768, `phone` 390×844 (chromium); `baseURL` from preview server; retries 1 |
| `.github/workflows/ci.yml`, `deploy.yml` | per 5.9 |
| `LICENSE` | MIT |
| `CHANGELOG.md` | Keep-a-Changelog, updated per milestone |
| `docs/INDEX.md` | task → spec sections map (CC generates from MILESTONES citations; used in 1.1 step 3) |
| `simple-git-hooks` + `lint-staged` | pre-commit: prettier + eslint on staged files |

## 15.2 Scripts (root `package.json`)

```json
{
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm -r build && pnpm budget",
    "lint": "eslint . --max-warnings 0 && prettier --check .",
    "typecheck": "tsc -b",
    "test": "vitest run --coverage && pnpm content:validate",
    "test:e2e": "playwright test",
    "content:validate": "tsx packages/content/cli/validate.ts --all",
    "gen:types": "tsx tools/gen-command-types.ts",
    "sim": "tsx packages/sim/cli.ts",
    "sim:smoke": "tsx packages/sim/cli.ts --games 200 --seats 2 --ai normal,normal --goals 50",
    "sim:gate": "tsx packages/sim/cli.ts --config sim/gates.json --assert",
    "check:banned": "tsx tools/check-banned.ts",
    "budget": "tsx tools/bundle-budget.ts --max-gzip-kb 350",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm gen:types --check && pnpm check:banned && pnpm build && pnpm test:e2e && pnpm sim:gate"
  }
}
```

## 15.3 Fixed seeds and fixtures

- e2e seeds: `e2e-tutorial` (tutorial script), `e2e-quick` (goals 30 autoplay winner), `e2e-hotseat` (4 seats to week 10), `e2e-phone`. Seeds are strings; changing pack content that alters these runs requires updating golden hashes in `apps/web/e2e/golden/*.json` in the same commit (CI diff check).
- Engine golden replays: `packages/engine/test/golden/<seed>.json` (command log + final hash), 20 seeds per pack, regenerated only via `pnpm test -- --update-golden` with an ADR note.

## 15.4 CI budgets (GitHub-hosted 4-core runner)

| Job | Budget |
| --- | --- |
| lint + typecheck + unit | ≤ 6 min |
| build + budget | ≤ 3 min |
| e2e (3 projects) | ≤ 10 min |
| sim:gate | 8 configs × 500 games, Normal AI only, ≤ 8 min; full 10k suites run locally by CC, results committed as reports |
| deploy | ≤ 3 min |

## 15.5 Runtime error handling

- React error boundary per screen; on engine exception in UI: capture state hash + last 20 commands to console, offer "Export debug save" and "Reload autosave".
- Corrupt IndexedDB record: quarantine key `corrupt:<ts>`, continue with empty store.
- Worker crash: retry AI turn once, then fall back to main-thread AI with a notice.

## 15.6 Amendments to earlier sections (already applied in this file; listed for traceability)

1. 5.3 `GameConfig.rulesetId` is `packId: string` (validated against loaded packs), not a literal union.
2. 4.6 "11 workplaces" is 10 workplaces per 14.1; Clinic offers no jobs in v1.
3. 9.7 CI gate: 500 games per config, ≤ 8 minutes.
4. GDD hour values are authored in hours; engine stores half-hours per 13.1. Content loader converts.
5. 3.4 / 3.7 / 3.9 [ASSUMED] tables are provided in section 14; CC uses them instead of constructing its own.
6. MILESTONES M0.8, M1.7, M2.2, M5.1, M8.2 reference sections 12–15.
7. File map and precedence in section 0 include sections 12–15.
