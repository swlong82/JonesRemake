# Handoff

State of the build after M4, for the session that picks this up. Read `CLAUDE.md` first, then this
file, then resume at the first unchecked task in `PROGRESS.md`.

## Where the build is

| Area                                   | State                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| `packages/shared`, `engine`, `content` | Complete through M1–M2, tagged `m1`, `m2` locally (KI-001)    |
| `packages/ai`                          | Complete through M2.5                                         |
| `packages/sim`                         | Runner, bots, metrics, reports and gates complete (M3.1–M3.2) |
| Classic baseline (M3.3)                | Suite run and `BASELINE_REPORT.md` written; tuning still open |
| Classic gate (M3.4)                    | Wired and green except the two KI-005 `pending` assertions    |
| `apps/web`                             | **Complete through M4.8 — the classic ruleset is playable**   |
| M5–M8                                  | Not started                                                   |

`pnpm verify` is green, with one caveat: `pnpm sim:gate` reports two BALANCE 9.3 targets as
**pending** rather than failing (career and happiness are never the last goal completed — KI-005,
ADR-0019). `pnpm sim:gate --strict` fails on them, and the M3 milestone gate must be run strict.

## Resume here

1. **M3.3 tuning** — the measurement half is done: the 24-config stage-1 suite ran to completion,
   `BASELINE_REPORT.md` and `reports/baseline.json` hold B(metric, config) and every 9.3 gate with
   its achieved value. What is left is the balance work itself, and ADR-0024 records the plan:
   career saturates because it is `dependability × 1.25` (only ≥ 10000 bp keeps career 100 reachable
   at `statMax`), and happiness has no decay at all, so it climbs monotonically to any target.
   Expect to change `goals.careerDependabilityBp` and to add happiness decay (a mechanic, so an ADR
   plus a `core-decay` change), then regenerate the golden replays (`UPDATE_GOLDEN=1 pnpm test`)
   and re-run the suite before writing the frozen baseline.

   ```bash
   mkdir -p reports
   pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 2 --out reports/stage1
   pnpm baseline           # rewrites BASELINE_REPORT.md + reports/baseline.json
   pnpm sim:gate --strict  # what the M3 gate requires
   ```

   Budget roughly 1 s per Normal game and 3–6 s per Hard or goals-100 game (ADR-0016); the whole
   suite is about 1.5 hours on two workers. It no longer clashes with `pnpm test` (KI-004 fixed).

2. **M3.4** — once KI-005 clears, delete the two `pending` blocks from `sim/gates.json`, run
   `pnpm sim:gate --strict`, tag `m3` and `baseline-frozen`, and fill in the PROGRESS gate log.

3. **M5** — modern systems (transport, wellbeing, gigs, loans, subscriptions). The module pipeline,
   pack `FeatureFlags` and the `modern-western` pack skeleton already exist; the web UI reads
   everything from `candidateCommands`/`previewCommand`, so a new command with a handler and a
   panel section key shows up in the UI without a UI change (ADR-0020).

## How the app flags work

`apps/web/src/flags/appFlags.ts` gates screens that are specified but not built (ADR-0017). These
are not the CityPack `FeatureFlags` of EXTENSIBILITY 12.4, which gate rules per ruleset.

- Five flags are left, all default off, each naming the milestone that deletes it: `saves` (M7.2),
  `tutorial` (M7.3), `audio` (M7.1), `leaderboard` (M8.1), `debugTools` (UX 7.9).
  `gameBoard` and `endScreen` were deleted when M4 landed their screens — that is the pattern:
  the flag goes away with the milestone, it is not left behind switched on.
- Resolution: registry default → build env `VITE_FF_<ID>` → URL `?ff=audio,-saves`.
- `debugTools` also needs `VITE_DEBUG_ALLOWED=true`, so a deployed build cannot enable it. The e2e
  build sets that variable, which also exposes the store as `globalThis.__hustleRing` for the two
  specs that need a state a full game away (ADR-0022).
- `apps/web/src/ui/screens/registry.tsx` maps each screen to its component and, while gated, its
  flag. A screen whose flag is off, or that has no component yet, renders `UnavailableScreen`.

## Where the UI pieces live

| Piece                                           | File                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| Router                                          | `apps/web/src/App.tsx` + `ui/screens/registry.tsx`                 |
| Store (only mutation path)                      | `apps/web/src/store/gameStore.ts`                                  |
| Board, HUD, panel, travel, cards, log           | `apps/web/src/ui/game/*`                                           |
| Wording helpers (commands, previews, log lines) | `apps/web/src/ui/game/labels.ts`                                   |
| Layout, keyboard, live region                   | `apps/web/src/ui/screens/GameScreen.tsx`, `ui/game/useKeyboard.ts` |
| End screen + goal chart                         | `apps/web/src/ui/screens/EndScreen.tsx`, `ui/game/GoalChart.tsx`   |
| Debug switches                                  | `apps/web/src/debug/useDebugBoot.ts`, `ui/game/DebugPanel.tsx`     |

To preview a gated feature while building it: `pnpm dev`, then `http://localhost:5173/?ff=<flag>`.
For the debug panel: `VITE_DEBUG_ALLOWED=true pnpm dev` and `?debug=1&ff=debugTools`.

## Things that will bite you

- **Never mutate `state.players[i]` directly.** Copy-on-write cloning (ADR-0009) shares player
  objects until `Ctx.playerAt` deep-clones one. Go through `applyCommand`.
- **The UI must not re-derive rules.** Action legality, previews, travel times and open/closed
  state all come from the engine (ADR-0020); if the UI needs a number, add it to `ActionPreview`.
- **Engine purity is lint-enforced**: no DOM, `Date.now()`, `Math.random()`, `Math.exp/log/pow`, or
  I/O in `packages/engine`. Randomness comes from the injected seeded RNG only.
- **Units**: money is integer dollars, asset prices cents, hours are half-hours (a 60-hour week is
  `weekHours: 120`), probabilities basis points, the economy index per-mille. Content is authored in
  human units and converted in `packages/content/src/resolve.ts`.
- **A balance target you cannot meet yet** goes in `sim/gates.json` as `pending: { issue, until }`
  (ADR-0019), never deleted or widened. It reports on every run and fails `--strict`.
- **Changing classic rules invalidates the golden replays** (`packages/engine/test/golden/`) and the
  committed baseline. Regenerate with `UPDATE_GOLDEN=1 pnpm test` and re-run the stage-1 suite.
- **Tags cannot be pushed from the build session** (KI-001) — create them locally and record the SHA
  in the PROGRESS gate log.
- **Never hand-edit a split doc.** `docs/*.md` and `CLAUDE.md` §1 are generated from
  `docs/SPEC_PACK.md` by `tools/split-spec.py`. `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`,
  `BASELINE_REPORT.md`, `NAMING.md` and this file are living documents and are edited directly.
- **Regenerate command types** with `pnpm gen:types` after adding a command handler; `pnpm verify`
  checks the generated file is current.
- E2E in this sandbox needs the preinstalled browser:
  `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`.
  Never set that in CI.
