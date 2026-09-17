# Handoff

State of the build at the M4 checkpoint, for the session that picks this up. Read `CLAUDE.md`
first, then this file, then resume at the first unchecked task in `PROGRESS.md`.

## Where the build is

| Area                                          | State                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| `packages/shared`, `engine`, `content`        | Complete through M1–M2, tagged `m1`, `m2` locally (KI-001)    |
| `packages/ai`                                 | Complete through M2.5                                         |
| `packages/sim`                                | Runner, bots, metrics, reports and gates complete (M3.1–M3.2) |
| Classic baseline (M3.3–M3.4)                  | Not done — the stage-1 suite never finished (KI-003)          |
| `apps/web` store, AI worker, non-game screens | Complete (M4.1–M4.2)                                          |
| `apps/web` board, HUD, panel, events, end     | Not built; gated off behind app flags (KI-002, ADR-0017)      |
| M5–M8                                         | Not started                                                   |

`pnpm verify` is green on this checkpoint, with one caveat: `pnpm sim:gate` reports two BALANCE 9.3
targets as **pending** rather than failing (career and happiness are never the last goal completed —
KI-005, ADR-0019). Everything else passes: lint, typecheck, 414 unit tests with coverage thresholds,
content validation, generated-types check, bundle budget, and 9 e2e tests across three viewports with
zero axe violations. No milestone tag was created: M3 and M4 are both mid-milestone.

Run `pnpm sim:gate --strict` to see the gate the M3 milestone must clear — it fails while KI-005 is
open.

## Resume here

1. **M3.3** — re-run the stage-1 suite to completion, then write `BASELINE_REPORT.md` and
   `reports/baseline.json`, tune any `[ASSUMED]` classic values within ±25% (ADR required per
   CLAUDE.md 1.4), and tag `baseline-frozen`.

   ```bash
   mkdir -p reports
   pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 3 --out reports/stage1
   ```

   Budget roughly 0.9 s per Normal game (ADR-0016); the suite is 24 configs at reduced counts.
   Do not run `pnpm test` at the same time (KI-004).

2. **M3.4** — the gate is wired and runs in CI in about two minutes (8 configs, 18 assertions).
   What is left is clearing KI-005 so `pnpm sim:gate --strict` passes, then removing the two
   `pending` blocks from `sim/gates.json`.

3. **M4.3–M4.8** — build the board UI. Everything it needs from the engine exists:
   `legalCommands`, `candidateCommands` (each candidate carries its `ErrorCode` for disabled
   reasons), `previewCommand` (hours, money, stat deltas, risk in basis points, note keys), and
   `PlayerState.history` for the end-screen chart. Every i18n key the spec calls for is already in
   `apps/web/src/i18n/en.json` — board, HUD, panel sections, travel sheet, event cards, log lines,
   ticker, end screen, phone layout, debug. Pack strings come from `loadPackStrings` in the `pack`
   namespace; read them with `tp('location.bank.name')`.

## How the app flags work

`apps/web/src/flags/appFlags.ts` gates screens that are specified but not built (ADR-0017). These
are not the CityPack `FeatureFlags` of EXTENSIBILITY 12.4, which gate rules per ruleset.

- All seven flags default off. Each names the milestone that removes it.
- Resolution: registry default → build env `VITE_FF_<ID>` → URL `?ff=gameBoard,-endScreen`.
- `debugTools` also needs `VITE_DEBUG_ALLOWED=true`, so a deployed build cannot enable it.
- `apps/web/src/ui/screens/registry.tsx` maps each screen to its flag and component. A screen whose
  flag is off, or that has no component yet, renders `UnavailableScreen`.

**To land the board:** add `game: { flag: 'gameBoard', component: GameScreen }` to the registry,
build the screen, then set `gameBoard.default` to `true` and delete the flag once M4.8 is done.
Flipping a flag on without a registered component is safe — the Unavailable screen still shows.

To preview gated work while building it: `pnpm dev`, then `http://localhost:5173/?ff=gameBoard`.

## Things that will bite you

- **Never mutate `state.players[i]` directly.** Copy-on-write cloning (ADR-0009) shares player
  objects until `Ctx.playerAt` deep-clones one. Go through `applyCommand`.
- **Engine purity is lint-enforced**: no DOM, `Date.now()`, `Math.random()`, `Math.exp/log/pow`, or
  I/O in `packages/engine`. Randomness comes from the injected seeded RNG only.
- **Units**: money is integer dollars, asset prices cents, hours are half-hours (a 60-hour week is
  `weekHours: 120`), probabilities basis points, the economy index per-mille. Content is authored in
  human units and converted in `packages/content/src/resolve.ts`.
- **A balance target you cannot meet yet** goes in `sim/gates.json` as `pending: { issue, until }`
  (ADR-0019), never deleted or widened. It reports on every run and fails `--strict`.
- **Tags cannot be pushed from the build session** (KI-001) — create them locally and record the SHA
  in the PROGRESS gate log.
- **Never hand-edit a split doc.** `docs/*.md` and `CLAUDE.md` §1 are generated from
  `docs/SPEC_PACK.md` by `tools/split-spec.py`. `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`,
  `NAMING.md` and this file are living documents and are edited directly.
- **Regenerate command types** with `pnpm gen:types` after adding a command handler; `pnpm verify`
  checks the generated file is current.
- E2E in this sandbox needs the preinstalled browser:
  `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm test:e2e`. Never set that in CI.
