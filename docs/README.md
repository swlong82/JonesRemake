# Spec pack — index

> Generated from `docs/SPEC_PACK.md` by `tools/split-spec.py`. Edit the pack, re-run the script; do not hand-edit the split files.

# 0. How to use this pack

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
| 12 | `docs/EXTENSIBILITY.md` | Rule modules, registries, overlays, v2 seams |
| 13 | `docs/STATE_MODEL.md` | Integer numerics, PlayerState, ErrorCode, DomainEvent |
| 14 | `docs/SEED_DATA.md` | Concrete classic job/item/event/market tables |
| 15 | `docs/BUILD_READINESS.md` | Toolchain files, scripts, seeds, CI budgets, amendments |
| 16 | `docs/ROADMAP_SCAFFOLDS.md` | v1 non-goals as stubs, multi-city world, MMO + leaderboard plan |
| 17 | `docs/ART_SPEC.md` | Art sets: slots, manifest, placeholders, user import, scene UI (M9) |

**Precedence when docs conflict:** GDD > STATE_MODEL > BALANCE_SPEC > EXTENSIBILITY > ROADMAP_SCAFFOLDS > ARCHITECTURE > CONTENT_SCHEMAS > UX_SPEC > SEED_DATA > ORIGINAL_REFERENCE > BUILD_READINESS > PRD. ORIGINAL_REFERENCE governs only the `classic` ruleset values; GDD governs all rules.

**Keywords:** MUST / MUST NOT / SHOULD / MAY per RFC 2119. Every MUST is testable and has a matching acceptance criterion in MILESTONES.
