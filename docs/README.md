# Spec pack — index

# 0. How to use this pack

Source of truth for this pack: the sections below were exported from the Claude Doc spec and split by file map. Edit the files here; the doc is the historical origin.


This doc is the complete, self-sufficient input for Claude Code (CC) to build a modern remake of a 1991 life-sim board game with zero human intervention. "Hustle Ring" is a placeholder title; CC proposes final names (see Templates → NAMING.md).

**Hand-over steps (human, once):**

1. Create empty GitHub repo; enable GitHub Pages (source: GitHub Actions).
2. Export each section below into the file path named in its heading (e.g. section 1 → `CLAUDE.md`, section 4 → `docs/GDD.md`).
3. Open repo in Claude Code, give the single prompt: `Read CLAUDE.md and execute the plan in docs/MILESTONES.md from M0 to M8 without asking questions.`

**File map:**

| Section | Repo path | Purpose |
| --- | --- | --- |
| 1 | `CLAUDE.md` | Operating contract, commands, invariants |
| 2 | `docs/PRD.md` | Vision, scope, locked decisions |
| 3 | `docs/ORIGINAL_REFERENCE.md` | Researched baseline of the 1991 original |
| 4 | `docs/GDD.md` | Authoritative game rules |
| 5 | `docs/ARCHITECTURE.md` | Packages, engine API, AI, save/replay |
| 6 | `docs/CONTENT_SCHEMAS.md` | CityPack schemas + content requirements |
| 7 | `docs/UX_SPEC.md` | Screens, HUD, tutorial, input, a11y |
| 8 | `docs/AUDIO_SPEC.md` | AudioBus, SFX, procedural music |
| 9 | `docs/BALANCE_SPEC.md` | Two-stage calibration + CI gates |
| 10 | `docs/MILESTONES.md` | M0–M8 tasks + acceptance criteria |
| 11 | `PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, `NAMING.md` | Living templates |

**Precedence when docs conflict:** GDD > BALANCE_SPEC > ARCHITECTURE > CONTENT_SCHEMAS > UX_SPEC > ORIGINAL_REFERENCE > PRD. ORIGINAL_REFERENCE governs only the `classic` ruleset values; GDD governs all rules.

**Keywords:** MUST / MUST NOT / SHOULD / MAY per RFC 2119. Every MUST is testable and has a matching acceptance criterion in MILESTONES.
