# Known Issues

## KI-001: Git tags cannot be pushed from the build session

- Severity: minor
- Area: ci
- Found in: M1 gate
- Repro: `git push origin refs/tags/m1` → `HTTP/1.1 403 Forbidden` from `git-receive-pack` (the session's egress policy only permits pushes to the working branch). Branch pushes succeed.
- Attempts: 1) `git push --tags` 2) `git push origin m1` 3) `git push origin refs/tags/m1` with trace — all 403.
- Mitigation: milestone tags (`m1`, `m2`, …) are created locally and listed in the PROGRESS gate log with their commit SHAs; the human pushes tags (`git push origin --tags`) or CI recreates them from the gate log. `git tag` names in this repo are still authoritative once pushed.
- Status: open

## KI-002: Game board, HUD, location panel and end screen are not implemented

- Severity: major
- Area: web
- Found in: M4 (M4.3–M4.8)
- Repro: open the app, go to New Game — Start is disabled and a note names the milestone. Forcing the route (`?ff=gameBoard` then navigating to the board) shows the Unavailable screen.
- Attempts: not a defect — unfinished work, checkpointed deliberately (ADR-0018).
- Mitigation: app flags `gameBoard` and `endScreen` = off (ADR-0017). The engine, content, AI and sim beneath them are complete and tested, so no game is playable end to end in the browser yet.
- Status: fixed in M4.3–M4.8 — both flags deleted, the classic ruleset is playable end to end and covered by e2e on three viewports.

## KI-003: Stage-1 balance suite has not been run to completion

- Severity: major
- Area: balance
- Found in: M3.3
- Repro: `mkdir -p reports && pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 3 --out reports/stage1` — 15 of 24 configs had been written when the session ended; the partial `reports/stage1/` output is not committed.
- Attempts: not a defect — a long run (≈ 0.9 s per Normal game, ADR-0016) that outlived the session.
- Mitigation: none needed; re-run it. `BASELINE_REPORT.md`, `reports/baseline.json` and any [ASSUMED] classic tuning depend on it, and so does the `baseline-frozen` tag.
- Status: fixed — the suite ran to completion (24 configs, 3,200 games); `BASELINE_REPORT.md` and `reports/baseline.json` are committed. The raw per-config output stays out of git (`.gitignore`), regenerate with `pnpm tsx packages/sim/cli.ts --config sim/stage1.json --workers 2 --out reports/stage1 && pnpm baseline`.

## KI-004: Engine replay test times out when the machine is saturated

- Severity: minor
- Area: engine
- Found in: M4 checkpoint
- Repro: run `pnpm test` while the stage-1 sim occupies 3 worker threads — `src/core/replay.test.ts > 200 random seeds × random legal logs` exceeds the 5 s default timeout. Alone it takes ≈ 1.5 s and passes.
- Attempts: 1) re-ran the file alone (passes, 1.5 s) 2) confirmed the failure only appears under concurrent sim load 3) raised that one test's timeout to 20 s, keeping the 200-seed acceptance criterion.
- Mitigation: the per-test timeout is now 20 s (M4), so a busy machine no longer fails the sweep; the seed count was not reduced.
- Status: fixed in M4 (`packages/engine/src/core/replay.test.ts`)

## KI-005: Career is never the last goal completed (classic, goals 50)

- Severity: minor (accepted; happiness half fixed)
- Area: balance
- Found in: M3.4 (`pnpm sim:gate`)
- Repro: `pnpm sim:gate` → `classic-50-normal-2 lastGoalPct.career` under 1%, against BALANCE 9.3's "each goal last-completed ≥ 10%".
- Measured (120 games, `classic-50-normal-2`, after the M3.3 tuning): last goal completed is education 42.5%, wealth 40.8%, happiness 16.7%, career 0%. Full numbers per config in `BASELINE_REPORT.md`.
- Attempts: 1) happiness — fixed: `rules.happiness.decayPerWeek` 4, headroom above the goal ceiling and `oncePerTurn` on both tickets took happiness from 0% to 16.7% (ADR-0025, ADR-0027). 2) career — `stats.workDependabilityGain` 2 → 1, the only [ASSUMED] value with leverage: 0.00%, worse. 3) career — proved structural: education 50 needs six degrees, six degrees grant +30 dependability and career is `dependability × 1.25`, all three [SRC], so career 50 is met long before the sixth degree (ADR-0026).
- Mitigation: the career assertion stays asserted and `pending: { issue: KI-005, until: M6.3 }` in `sim/gates.json` (ADR-0019), so every gate run prints it and `pnpm sim:gate --strict` fails on it; the M3 gate records it per CLAUDE.md 1.5 instead of meeting it (ADR-0026). Only `careerDependabilityBp` 12500 → 10000 would meet it, at the cost of an ORIGINAL_REFERENCE [SRC] anchor.
- Status: open, accepted — revisited for `modern-western` at M6.3. Not degenerate at every goal level: at goals 100 all four goals are last-completed between 18% and 42%.

## KI-006: The modern ruleset has never been balance-run

- Severity: minor
- Area: balance
- Found in: M5 gate
- Repro: `pnpm sim:gate` covers `classic` only; `sim/stage1.json` and `sim/gates.json` have no `modern-western` config, so the nine modern systems have been exercised by unit tests and a 200-turn AI self-play smoke test, never by a seeded suite.
- Attempts: not a defect — M6.3 is the milestone that does it (BALANCE 9.5/9.6), with `reports/modern-targets.json` locked first at M6.2.
- Mitigation: none needed for `classic`, which is unaffected: every modern module is gated by a CityPack flag that `classic` leaves off, and classic's golden replays did not move across the whole of M5.
- Status: open — closes with M6.3.

## KI-007: `pnpm test` fails on Node 24+ because the runtime shadows jsdom's `localStorage`

- Severity: major
- Area: ci
- Found in: M6 resume (verifying the M6.1/M6.5 `pnpm verify` claims on a Node 26 machine)
- Repro: `pnpm test` on Node >= 24 → 93 of the 140 `apps/web` tests fail with `TypeError: Cannot read properties of undefined (reading 'clear')` at `globalThis.localStorage.clear()`. Node owns a built-in `globalThis.localStorage` that stays `undefined` without `--localstorage-file`, and the key existing stops vitest's jsdom environment from installing jsdom's own storage. CI pins Node 22 (`.nvmrc`), so CI never saw it although `engines.node` is `>= 22`.
- Attempts: 1) copy `window.localStorage` onto the global — there is none, `globalThis === window` under the jsdom environment and the built-in shadows it; 2) install a `Storage`-shaped in-memory stand-in in `apps/web/src/test-setup.ts` when `globalThis.localStorage` is `undefined` — 140/140 web tests pass, and Node 22 is untouched because the branch never runs there.
- Mitigation: none needed; fixed by the setup guard (ADR-0032). Local e2e on a machine whose Playwright cache lacks the pinned revision still needs `PW_CHROMIUM_EXECUTABLE` (CLAUDE.md 1.9); that is unrelated to this issue.
- Status: fixed in M6 resume (`apps/web/src/test-setup.ts`, ADR-0032)

## KI-008: Nine stage-2 modern balance targets are unmet after the tuning budget

- Severity: minor (accepted)
- Area: balance
- Found in: M6.3 (`pnpm tsx packages/sim/cli.ts --config sim/stage2.json`)
- Repro: run the stage-2 suite; 17 of the 26 targets locked in `reports/modern-targets.json` pass and these nine do not, with the achieved value beside each: wealth last-completed 1.0% and career last-completed 0.5% (target ≥ 10% each); Normal-AI collapse 71% (target 15–40%); median at goals 80 is 45 weeks (target 49–75); Hard beats Easy 70% one way round (target ≥ 80%; the swapped-seat config reads 95%); StudyFirst wins 0% (target 30–60%); LoanMax defaults in 0% of its games (target 20–60%); the `viral` family never appears in the family counts and `gadget-breakdown` fires 0.12 per 100 player-weeks (target ≥ 1 each, at Chaos Modern).
- Attempts: 17 tuning iterations, logged one by one in `BALANCE_REPORT.md` with the value each produced. The ruleset went from 100% stalls and no winner at all to a 48-week median and 0.5% stalls; every remaining miss moves in the opposite direction to a target already met. Two were proved structural rather than under-tuned: career repeats classic's ADR-0026 result (degrees grant dependability, career is a multiple of dependability, so career lands with the degrees), and `careerDependabilityBp` below 10000 makes goals-100 unwinnable because career then caps under 100. Collapse frequency is a cliff in the band rather than a dial: bands 4/6/8 measured 0%/71%/96% on identical content.
- Mitigation: the nine targets stay asserted in `sim/gates.json` with `pending: { issue: KI-008, until: M8.5 }` (the ADR-0019 mechanism), so every gate run prints them and `pnpm sim:gate --strict` fails on them; the M6 gate records them per CLAUDE.md 1.5 rather than meeting them. `classic` is unaffected — no classic file changed during M6.3 and its goldens and gate results did not move.
- Status: open, accepted — the `viral` family reading zero while the other three respond to weight looks like a defect rather than a tuning miss, and is the one worth looking at first.

## KI-009: The setup form's Start button cannot be clicked at 150% text on a phone viewport

- Severity: minor
- Area: web
- Found in: M7.5 (the final a11y and text-scale pass)
- Repro: on the `phone` Playwright project (485×1050 CSS px at a 24px root font), open Settings, set text scale 150%, go to New game and click Start. The click times out with `<label class="flex items-center gap-2">… from <div class="mt-2 grid gap-3 sm:grid-cols-2"> subtree intercepts pointer events`. Every other viewport, and the same form at 100% and 125%, are fine.
- Measured: scrolled to the foot of the page the geometry is correct — the options grid ends at y = 94 and the button sits at y = 960–1026, and `document.elementFromPoint` at the button's centre returns the button itself. The interception only appears during Playwright's own scroll-then-hit-test, so the two disagree about where the button is on a page 3,308 px tall.
- Attempts: 1) `scrollIntoViewIfNeeded()` before the click — still intercepted; 2) `scrollTo(0, document.body.scrollHeight)` first — still intercepted; 3) measured both boxes and the hit test at the click point, which say the button is on top and clickable. Three attempts, so CLAUDE.md 1.5 applies.
- Mitigation: none needed for the a11y pass itself, which is what M7.5 is about — `presentation.spec.ts` now reaches the board first and turns the scale and theme up from the in-game menu, so the axe gate, the contrast check and the no-clipped-text check all still run on the board in the dark theme at 150% on all three viewports. Nothing is disabled and no assertion was weakened. A player on a phone can still start a game at 150%: the button is visible and on top, and only the automated click disagrees.
- Status: open — worth a look at the setup form's grid at large root font sizes before release; it may be the harness rather than the layout.

<!--
## KI-001: <title>
- Severity: blocker | major | minor
- Area: engine | ai | content | web | audio | save | balance | ci
- Found in: <milestone/task>
- Repro: (seed, command log path or steps)
- Attempts: 1) ... 2) ... 3) ...
- Mitigation: feature flag <name> = off | workaround
- Status: open | fixed in <sha>
-->
