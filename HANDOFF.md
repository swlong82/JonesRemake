# Handoff

State of the build after M6 and M7 closed on `task/local-save-load`. Read `CLAUDE.md` first, then
this file, then resume at the first unchecked task in `PROGRESS.md` — **M8.1**.

## Where the build is

| Area                                   | State                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/shared`, `engine`, `content` | Complete through M6; the modern overlay lives in `modern-western/rules.json` |
| `packages/ai`                          | M2.4–M2.5, M5.9, plus the two M6.3 scorer fixes (ADR-0034)                   |
| `packages/sim`                         | Runner, 6 bots, metrics (now including the three bot rates), gates           |
| Classic balance (M3)                   | Closed. One target recorded unmet: ADR-0026, KI-005                          |
| Modern balance (M6)                    | **Closed.** 17 of 26 stage-2 targets met; nine recorded unmet, KI-008        |
| `apps/web`                             | Classic and modern playable; audio, tutorial, opacity, themes, locale        |
| M7                                     | **Closed** — M7.1–M7.5 all landed; tag `m7` local                            |
| M8                                     | Not started                                                                  |

`pnpm verify` was green locally on 2026-09-23 at `ad32369`: 71 test files / 659 passed / 11 todo,
51 Playwright + axe checks on three viewports with 0 serious or critical violations, initial bundle
175.1 kB gzip of 350, and `sim:gate` 17 configs / 42 assertions / 0 failed / 8 accepted pending.
There is still **no CI evidence** — nothing on this branch has been through a CI run, and the tags
are local only.

## Branch and tags

- Everything is on `origin/task/local-save-load`, which starts from `origin/main` at `4e3964d`.
- Tags `m6` (c3525d0) and `m7` (3454842) exist **locally only** (KI-001: this session cannot push
  tags); each points at its gate commit, and the verify run behind it was taken one commit
  earlier (126b24b and ad32369), which only added the gate record itself. `m0` is the only other tag in this clone — `m1`…`m5` were created in earlier sessions
  elsewhere and never pushed, so their SHAs live in the PROGRESS gate log and nowhere else.
- No PR was opened and nothing was merged to `main`; that is deliberately left to the human.

## What landed in M6

1. **M6.2** — `reports/modern-targets.json` holds all 23 target entries of BALANCE 9.5, derived from
   the classic baseline and locked by sha256 in ADR-0033. `tools/lib/targets.test.ts` fails
   `pnpm test` if the file changes, and re-derives every median band from the recorded baseline
   medians, so tuning can never move the bar.
2. **M6.3** — the first modern measurement **stalled 100% of games**: no winner at goals 50 in 300
   weeks, every seat bankrupt, 10–15 wellbeing collapses a game. Seventeen iterations later the
   suite reads a 48-week median (classic B = 40), 0.5% stalls and 53.8% seat bias.
   `BALANCE_REPORT.md` has the iteration log and the nine targets still unmet, each with its
   achieved value.
3. **M6.4** — `sim/gates.json` went from 8 configs / 18 assertions to 17 / 42: every classic sanity
   gate kept, nine modern configs added, and the eight unmet targets asserted with
   `pending: { issue: KI-008, until: M8.5 }` so a gate run prints them and `--strict` fails on them.

Two AI defects came out of the balance runs and are fixed under **ADR-0034**: the `wellbeing`
scorer was a staircase with no gradient inside a band (a rest from 13 → 21 scored the same as not
resting, so seats refused to work), and nothing credited buying a gadget that unlocks a system.
The balance itself is a `modern-western` overlay under **ADR-0035** — GDD 4.5's wellbeing deltas are
untouched; what changed is how fast rest pays them back, plus the wage, the happiness upkeep, the
degree ladder and the wealth point value.

## What landed in M7

- **M7.1 audio** — `apps/web/src/audio/`. `AudioBus` with a `WebAudioBus` and the `NullAudioBus`
  tests fall back to; all 14 SFX of AUDIO_SPEC 8.2 as recipes; the six moods of 8.3 as data. Sound
  is driven only by `DomainEvent`s through `eventMap`, so the engine keeps no audio knowledge.
  Music is a real lazy chunk (`music-*.js`, ~3 kB) and is plain WebAudio, not Tone.js (ADR-0036).
- **M7.2 saves** — landed in the isolated task that started this branch; re-verified at the gate
  rather than taken on trust (the classic and modern round trips in `saves.spec.ts` pass on all
  three viewports).
- **M7.3 tutorial** — `apps/web/src/tutorial/`. Ten scripted steps as data, each naming the element
  it spotlights and the `DomainEvent` that advances it. The `tutorial` app flag now defaults on.
- **M7.4 classic opacity** — an audit test that scans every number in `innerHTML`, attributes
  included. It found one real leak (the modern wellbeing line) and it is fixed.
- **M7.5 themes, locale, a11y** — the pseudo-locale is generated from the English bundle at startup,
  so a key can never be missing from it. The contrast test reads the theme tokens out of the
  stylesheet; it and the axe pass caught white-on-pale-blue at 2.54:1 on the dark theme's primary
  button, now fixed with per-theme `--c-on-accent` / `--c-on-danger`.

## Things to know before touching any of it

- **The `tutorial` and `audio` app flags default on.** Any e2e that is testing something else turns
  the tutorial off with `?ff=-tutorial`, which is the flag registry's own mechanism. A spec that
  starts a game without it will find the spotlight in the way.
- **Modern content changes go in `modern-western/rules.json`**, which deep-merges over `classic`.
  Changing a classic number means re-justifying it against the frozen classic baseline.
- **`goals.careerDependabilityBp` must stay at or above 10000.** Below it the career goal caps under
  100 and goals-100 becomes unwinnable; M6.3 found that the hard way.
- **Balance runs are slow.** A modern Normal game is about 0.9 s and a goals-100 game about 5.7 s,
  so `sim/stage2.json` is roughly 20 minutes on six workers. `sim/probe.json` is the inner loop —
  24 games, about 5 seconds — and is what the tuning iterations actually used.
- Everything else from the M5/M6 handoff still holds: nothing random in `cost()` or `validate()`,
  modules talk through exported selectors only, `takeMoneyCascade` returns the shortfall, run
  `pnpm gen:types` after adding a command, and any rule or content change moves the golden replays.
- **Local runs need two things this sandbox lacks by default**: `pnpm` (installed under a scratch
  prefix) and a Playwright browser. Use `PW_CHROMIUM_EXECUTABLE` pointing at an installed Chromium
  (CLAUDE.md 1.9). Node 26 is fine now — ADR-0032 fixed the `localStorage` break that made 93 web
  tests fail on it while CI's Node 22 stayed green.

## Open issues worth reading first

- **KI-008** — the nine unmet stage-2 balance targets, with achieved values. Two are structural
  (career repeats ADR-0026's classic result; collapse frequency is a cliff in the band, not a dial).
  The one that looks like a defect rather than a tuning miss: the `viral` event family reads ~0.1
  per 100 player-weeks while the other three families respond to weight as expected.
- **KI-009** — the setup form's Start button cannot be clicked at 150% text on a phone viewport.
  Three attempts are logged; the geometry says the button is on top and clickable, so it may be the
  harness rather than the layout.
- **KI-005** — classic career is never the last goal completed; accepted since M3.
- **KI-001** — tags cannot be pushed from a build session.

## Resume here: M8 — release

1. **M8.1** — `score()` + `LocalLeaderboard` + the Stats board with scopes (16.7); `NAMING.md` final.
   The `leaderboard` app flag is still off and still names M8.1, which is where it gets deleted.
2. **M8.2** — README + `docs/EXTENDING.md` with executable examples.
3. **M8.3** — the full e2e regression (4-seat hotseat modern game to week 10, save/load mid-game,
   phone autoplay to a winner).
4. **M8.4** — deploy to GitHub Pages with the post-deploy smoke test.
5. **M8.5** — close-out: every open issue gets a severity and a workaround, and the eight `pending`
   gate assertions are due here — either met or re-recorded.

## Commands

```bash
pnpm verify                     # everything, in the order CI runs it
pnpm sim:gate                   # 17 configs, 42 assertions, ~3 min on six workers
pnpm sim:gate --strict          # also fails on the 8 accepted pending targets
pnpm tsx packages/sim/cli.ts --config sim/stage2.json --workers 6 --out reports/stage2
pnpm tsx packages/sim/cli.ts --config sim/probe.json  --workers 6   # the tuning inner loop
pnpm baseline                   # rewrites BASELINE_REPORT.md + reports/baseline.json
UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts --root packages/engine
PW_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e
```
