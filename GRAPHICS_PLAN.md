# Graphics plan — a modern look, and how to make the assets

Status: proposal (2026-09-30). Nothing here is built yet. It fits the art system that already ships (ART_SPEC 17): SVG art sets, a manifest, `extends`, tint keys, sanitizer, budgets, user zip packs.

## 1. Where the game looks today

Playing the scene UI on desktop (1440×900) and reading `tools/art-default/`:

- Flat cartoon SVG, thick black outlines, one flat fill per shape. Consistent, readable and tiny (908 kB for 197 files), but it reads as a 2010 browser game.
- No light: no gradients, shadows, ambient occlusion or time of day. Every building has the same front-on box.
- Interiors are one room per location, all the same perspective and floor. The host is one static pose.
- Avatars have 6 silhouettes, 4 directions × 3 poses. They walk but never react (no cheer or slump on the street, no idle).
- The chrome (panels, buttons, bars) is plain beige HTML. The HUD is dense and text-first.
- The board is one static image. Nothing changes between a boom and a recession, week 1 and week 40, or morning and night.

## 2. Direction: "soft-lit vector city"

Keep vector (SVG). It scales to any screen, stays inside the 1.5 MB budget, tints per player, and passes the sanitizer. Change the treatment, not the format:

| Layer           | Today                    | Target                                                                                                                            |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Shapes          | flat fill + 3 px outline | fill + subtle top-light gradient, thin (1–1.5 px) darker-tone outline, rounded corners                                            |
| Light           | none                     | one global light from top-left: soft drop shadow under every building and avatar, ambient-occlusion strip where wall meets ground |
| Palette         | 8 flat colours           | 3 palettes (day, dusk, night) built from one token set; each building has a base hue plus an accent                               |
| Detail          | sign pictogram           | awnings, plants, window reflections, lit windows at dusk, a roof object per building type                                         |
| Depth           | one plane                | 3 layers per scene (back, mid, front) so the stage can parallax a few pixels with the pointer or device tilt                      |
| Type and chrome | beige HTML               | frosted-glass panels, larger touch targets, icon-first buttons (lucide is already bundled), animated number counters              |
| Life            | walk cycle only          | idle breathing, blinking, traffic and pedestrians on the ring road, cloud drift, chimney steam, flag wave, window lights          |

Reference feel: modern mobile management sims (soft isometric lighting, saturated but friendly palette), not photoreal and not pixel art. This stays clear of any original artwork (PRD 2.6).

### Game-state driven visuals (the part that makes it feel alive)

The art set stays static; the presentation layer tints and overlays it from public state:

- **Time of day** from the hour clock: morning wash at 60 h left, warm dusk under 20 h, night with lit windows in the last 8 h.
- **Weather from the economy phase**: boom = clear sky and busy street, stable = light cloud, recession = grey overcast and a few closed shutters. The news digest already says the same thing in words.
- **Building state overlays**: a "closed" shutter or padlock icon at closed places, a `!` badge where rent is due, a moving-van icon at the home after a move, a help-wanted sign on places hiring what the player qualifies for.
- **Avatar reacts**: cheer on a raise or degree, slump after a fine or missed rent, sweat drop when wellbeing is low, phone in hand while delivery is ordered.
- **Wealth-tier home skin**: low, mid and secure homes already have three locations, so each gets its own exterior.
- **Micro-feedback**: coins and hour tokens fly from the panel to the HUD counter on every pay or spend (extend `DeltaToast`).

All of these are CSS/SVG overlays over existing `<img>` layers: no engine change, no golden change.

## 3. Phased plan

| Phase             | Goal                                 | Work                                                                                                                                                                                                                          | Assets                           | Effort    |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------- |
| P0 — foundations  | Prove the look on one street         | Extend `tools/art-default/svg.ts` with shared `<defs>` (light gradient, drop shadow, ambient strip) and a palette module with day/dusk/night variants; restyle 3 buildings and 1 interior as the benchmark; screenshot review | 3 buildings, 1 interior          | 2–3 days  |
| P1 — the block    | Whole street in the new style        | Regenerate all 16 `building:*` and `board:background` (roads with lane markings, kerbs, trees, park pond); roof and awning variants per location type                                                                         | 17 files                         | 3–4 days  |
| P2 — people       | Characters worth watching            | Rebuild avatars from modular parts (body, hair, outfit, accessory) composed by the generator so 6 + 4 rival styles share one skeleton; add `cheer`/`slump`/`idle-blink` frames; add pedestrian extras (untinted)              | 6 avatars × 14 frames + 4 rivals | 5–6 days  |
| P3 — rooms        | Interiors with depth                 | Three-layer interiors (`back`, `mid`, `front` overlays) with a fixed calm right 40% for the panel; host gets 3 poses (idle, talk, react)                                                                                      | 16 interiors, 16 hosts           | 6–8 days  |
| P4 — chrome       | Modern UI shell                      | New theme block (`frame:panel`, `frame:button` 9-slice, glass surface tokens), refreshed HUD layout, animated counters, icon set                                                                                              | tokens + ~12 icons               | 3–4 days  |
| P5 — living world | State-driven overlays from section 2 | Time-of-day filter (`feColorMatrix`), weather layer, overlays, coin-fly animation; respect reduced motion                                                                                                                     | overlays ~20                     | 4–5 days  |
| P6 — story art    | Illustrate the news and events       | One `weekend:<eventId>` illustration for each of the ~30 events and the six engine events (rent hike, breakdown, delivery lost…); masthead variants per economy phase                                                         | ~40                              | 8–10 days |

P0 is the go/no-go gate: if the benchmark street does not look clearly better in a screenshot pair, stop and revisit before spending more.

## 4. How to create the assets

The art system already accepts assets from any of these sources, because every route ends in the same place: SVG files in `packages/art/sets/<set-id>/files`, described by `manifest.json`, checked by `pnpm art:check`.

### A. Code-generated (recommended for buildings, roads, icons, overlays)

`tools/art-default/` already draws every slot from TypeScript, deterministically, with a test that fails when the committed set drifts from the generator.

1. Add primitives to `svg.ts`: `lit(fill)` (gradient), `shadow()`, `ao()`, `window(lit)`, `awning(color)`.
2. Parametrise each `building:*` by hue, roof type and sign pictogram.
3. `pnpm art:draw` writes the files; `pnpm art:check --report` shows drawn versus placeholder.

Pros: byte-stable output, consistent style, trivially themeable (the palette module gives day/dusk/night for free), tiny files. Cons: characters and organic shapes are laborious in code.

### B. Hand-drawn vector (recommended for characters, hosts, story illustrations)

Tools: Figma, Inkscape or Affinity Designer (all export clean SVG).

Rules that make a file pass the sanitizer and the runtime:

1. Artboard equals the catalog size (ART_SPEC 17.3), so the `viewBox` is exactly that size, for example `0 0 64 96` for an avatar.
2. Paint the recolourable regions with the tint keys: `#FF00FF` for the primary colour, `#00FFFF` for the secondary. Nothing else may use those two values.
3. No text (labels are HTML layers), no embedded raster, no `<script>`, no external `href` or `url()`; keep gradients, masks and simple blur filters (they are on the allowlist).
4. Under 60 kB per file and 5,000 elements. Run `npx svgo --multipass` with `removeViewBox: false`.
5. Name files as the catalog does (`avatar.player-2.walk1.e.svg`), add each to `manifest.json`, and run `pnpm art:check`.

Ship it as a new set `packages/art/sets/modern/` with `"extends": "default"`, so only the slots you have drawn override the default and everything else keeps working. Artists can therefore deliver a slot at a time.

### C. AI-assisted concepting, human-finished vector

Use image models for exploration only, not as the shipped file:

1. Write one style guide (palette hex codes, light direction, outline weight, camera angle) and keep it in `art/STYLE.md` so every prompt starts with the same paragraph.
2. Generate concept sheets per group (street, one interior, six characters) and pick a direction with a reviewer.
3. Rebuild the chosen concept as clean vector by hand (route B) or trace it (`vtracer`, Illustrator Image Trace), then simplify by hand until it fits the constraints.
4. Check licence terms of the tool used before anything is committed, record the prompt and tool in the set's `manifest.json` `license` and `author` fields, and run `pnpm check:banned` (no original names or lookalikes).

An LLM can also write the SVG for simple icons and overlays directly; treat the output as route A source: review it, put it through SVGO and the sanitizer.

### D. Community packs (already built)

Settings → Art packs imports a zip (`manifest.json` + `files/*.svg`). Publish the P0 street as a sample pack and document it in `EXTENDING.md` so artists can reskin the game without touching the repo.

## 5. Working together

The unit of work is the **slot** (a catalog key such as `building:bank`). Slots are independent files and the new `modern` set `extends` the default, so any number of people and AI agents can deliver different slots at the same time and the game keeps working with whatever is finished. The day-to-day guide is `art/README.md`; the look is `art/STYLE.md`; provenance is `art/ASSET_LOG.md`.

### Roles

| Role         | Does                                                          | Accountable for                                      |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| Art director | owns `art/STYLE.md`, approves batches from the contact sheet  | the look being consistent                            |
| Artists      | hand-drawn vector (lane B), concept work                      | their files meeting the checklist                    |
| AI operator  | drives Claude or other tools to produce slots (lanes A and B) | reviewing everything the AI made before opening a PR |
| Engineer     | generator, tooling, overlays and animation (lanes A and C)    | CI, budgets, performance                             |
| Maintainer   | merges, owns CODEOWNERS and ADRs                              | scope and licences                                   |

One person can hold several roles; an AI never approves its own work.

### Lanes, so nobody collides

- **A. Generated** (`tools/art-default/**` and the regenerated set): one owner at a time per generator file. Generated files carry a marker and are never hand-edited.
- **B. Hand-drawn** (`sets/modern/files/*.svg`): one file per PR where possible; files do not conflict.
- **C. Presentation** (`apps/web/src/ui/scene/**`): ordinary code review.
- **The manifest is the one shared file.** Manifest entries are derived from file names and `viewBox`, so a proposed `pnpm art:sync` (section 7) writes them and contributors never hand-edit it. Until then, add your entry in alphabetical order and rebase before merging.

### Workflow

1. **Brief.** An **Art asset** issue (`.github/ISSUE_TEMPLATE/art_asset.yml`) per slot group, labelled `art`, `lane:a|b|c` and a status label. A GitHub Project board mirrors the statuses: `art:brief` → `art:claimed` → `art:wip` → `art:review` → `art:approved` → done.
2. **Claim.** Assign yourself and comment. A human or an AI agent claims one group at a time.
3. **Make.** Branch `art/<group>-<slot>`, draft PR early, titled `art(<group>): <slot>`.
4. **Preview.** `pnpm art:preview` writes a contact sheet; attach a screenshot to the PR.
5. **Check.** CI runs `art:check`, the banned-terms scan and the budget; the checklist in `art/README.md` is the definition of done.
6. **Review.** The art director reviews the contact sheet in batches ("street pass", "people pass"); one style discussion settles many files.
7. **Log.** Every file gets a row in `art/ASSET_LOG.md` (route, tool, prompt or reference, licence).

### Cadence and control

- **P0 ends with a style freeze.** The director signs off the benchmark street and `STYLE.md` v1; later changes are pull requests to that file.
- Weekly contact-sheet review; the `modern` set carries a semver `version` bumped per batch.
- Direction changes get an ADR. Disagreements about taste are decided by the art director, about licences and scope by the maintainer.
- Parallel AI agents are fine when each takes a different group (separate branches or worktrees). Two agents never edit the same generator file.

## 6. Tools and MCP servers an AI can use

Findings come from searching the connector registry available to this account (all listed items were **not installed** here) plus what already runs in the repo. Nothing below has been run end to end for asset production yet, so treat each as something to trial in P0, not a commitment.

### Connectors found in the registry

| Need                         | Connector                            | What its tools offer (from the registry listing)                                                | Fit for this project                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Human design source of truth | **Figma**                            | `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_metadata`, `generate_diagram` | Best fit for the artist lane: artists draw in Figma, an agent reads frames and design variables (palette tokens) and screenshots them for review. Export still has to be SVG that passes the sanitizer |
| Design and export            | **Canva**                            | search, get, create, autofill and export designs                                                | Good for the title, masthead and story art if the team already uses it. Confirm SVG export is available on your plan before relying on it                                                              |
| Pro vector and animation     | **Adobe**                            | large toolset incl. asset and animation tools                                                   | Possible for illustration and animation. Check which tools produce clean SVG and what the licence says about generated content                                                                         |
| Quick AI vector              | **Goodnotes**                        | `draw_svg_image`                                                                                | Cheap way for an agent to sketch simple SVG icons or overlays. Quality varies; treat as a draft                                                                                                        |
| Moodboards and planning      | **Miro**                             | boards, diagrams, docs                                                                          | Collaborative moodboards, the asset pipeline board, style references                                                                                                                                   |
| Diagrams for docs            | **Mermaid Chart**                    | render and save Mermaid                                                                         | Pipeline and workflow diagrams in docs only                                                                                                                                                            |
| Review notifications         | **Slack** (registered, disconnected) | post messages, read channels                                                                    | Ping reviewers when `art:review` lands                                                                                                                                                                 |

No dedicated **image-generation** connector turned up in the registry. If the team wants raster concepts from an image model, pick one deliberately (licence, cost, terms on commercial use), run it outside the repo or through a server the team hosts, and treat its output as a reference only (route C). Do not name or depend on a product until it has passed a licence review.

### Already available with no new connector

| Tool                                                     | How an agent uses it                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repo generator** `tools/art-default` + `pnpm art:draw` | The main production line for buildings, roads, icons and overlays (route A)                                                                                         |
| **`pnpm art:check --report`**                            | Validates schema, sizes, sanitizer, tint keys, contrast and budgets; reports drawn versus wireframe per group                                                       |
| **`pnpm art:preview`** (added with this plan)            | Writes an HTML contact sheet per set so an agent or a human can see every slot, badged drawn, wireframe or inherited                                                |
| **Playwright + Chromium** (installed)                    | Screenshots of the contact sheet and of the running game at three viewports, for review and future visual regression; an agent can read the image and self-critique |
| **GitHub connector** (connected in this session)         | Create issues from the template, set labels, open draft PRs, request review, read review comments                                                                   |
| **svgo**                                                 | `npx svgo --multipass` to shrink files (keep `removeViewBox` off)                                                                                                   |
| **resvg** (`@resvg/resvg-js`) or **sharp**               | Rasterise SVG to PNG for contact sheets and diffs without a browser                                                                                                 |
| **vtracer** or **potrace**                               | Trace an approved raster concept into vector for route C; clean by hand afterwards                                                                                  |
| **Inkscape CLI** (optional)                              | Boolean operations, path simplification and text-to-path when hand-finishing                                                                                        |

### Recommended: a small first-party MCP server for the art system

The highest-leverage addition is a `hustle-art` MCP server that wraps code the repo already has (`packages/art`: schema, catalog, sanitizer, tint, contrast, validate). It lets any agent produce assets _inside the rules_ and get precise feedback before a human looks.

| Tool                                         | Does                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `list_slots(set, status)`                    | Catalog keys with size, tint flag and drawn/wireframe/inherited status                                             |
| `get_slot_brief(key)`                        | Size, tint rules, notes from ART_SPEC 17.3, neighbouring slots, the style guide excerpt, the ASSET_LOG history     |
| `validate_svg(key, svg)`                     | Sanitizer, `viewBox`, byte and element budgets, tint keys, banned terms: returns the same issues `art:check` would |
| `render_preview(key or svg, tint?, context)` | PNG of the slot alone, on the board at phone size, or beside its label plate                                       |
| `submit_slot(set, key, svg)`                 | Writes the file, updates the manifest, runs the checks; never overwrites a hand-drawn file without a flag          |
| `palette_check(svg)`                         | Reports colours outside the style tokens and contrast problems                                                     |

Estimated effort: 1–2 days on top of the existing packages. It also makes a human artist's life easier (the same validation from a chat), and keeps generated art from breaking the sanitizer or the budget. A `submit_slot` call still ends in a PR that a human reviews.

### Agent workflows worth trialling in P0

1. **Generator loop (route A).** Edit `tools/art-default`, run `pnpm art:draw`, `pnpm art:preview`, screenshot the sheet, compare with `STYLE.md`, iterate. Deterministic and cheap; best for the street.
2. **Direct SVG loop (route B).** With the MCP server, the agent drafts an SVG, calls `validate_svg` and `render_preview`, revises, then submits. Best for icons, overlays and simple props; expect an artist to finish characters.
3. **Concept then trace (route C).** Concept sheet from an approved image tool, human picks a direction, trace, clean, validate. Records the prompt in `ASSET_LOG.md`.
4. **Review agent.** After each batch an agent reads the contact sheet against the `STYLE.md` checklist and lists deviations (outline weight, off-palette colours, unreadable at 44 px). It comments; a human decides.

Human gates stay: director approves style, maintainer approves licences, an AI never approves its own asset.

## 7. Tooling to add

1. ~~`pnpm art:preview`~~ — done: an HTML contact sheet per set with drawn / wireframe / inherited badges. Next: a CI job that uploads it as an artifact on PRs that touch `packages/art/**` or `tools/art-default/**`, and a Playwright screenshot of it for the PR body.
1. `pnpm art:sync`: derive manifest asset entries from file names and `viewBox` so nobody hand-edits `manifest.json` (removes the one shared-file conflict).
1. The `hustle-art` MCP server from section 6.
1. Visual regression: screenshot the title, board, one interior and the phone map at three viewports; diff against approved images.
1. `art:check --report` in CI as a summary comment (drawn versus placeholder per group).
1. A palette module shared by the generator and the web theme so a colour change in one place rethemes both.
1. Size budget guard already exists (`pnpm budget --max-art-kb 1536`); with richer files expect around 1.2–1.4 MB, so keep decorative detail in `<defs>` and `<use>` rather than repeated paths.

## 8. Asset checklist (all counts from the current catalog)

| Group                 | Slots                                               | Notes                                                                           |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Board background      | 1                                                   | roads, park, sky; day/dusk/night variants come from the filter, not extra files |
| Buildings             | 16                                                  | one per location; 3 home tiers                                                  |
| Interiors             | 16                                                  | calm right 40% for the panel                                                    |
| Hosts                 | 16                                                  | 3 poses in P3                                                                   |
| Avatars               | 6 human + 4 rival                                   | 12 walk frames + cheer + slump each; add idle-blink                             |
| Weekend and event art | 3 moods now, ~40 wanted                             | P6                                                                              |
| UI                    | title, setup, masthead ×3 phases, frames, ~12 icons |                                                                                 |
| Overlays              | ~20                                                 | closed, due, hiring, weather, rain, night lights                                |

## 9. Risks and decisions

- **Budget**: gradients and shadows cost bytes. Mitigation: shared `<defs>`, `<use>`, and generator-only detail.
- **Contrast**: art must not fight the text plates (17.1). Keep the label plate opaque; the contrast checks in `packages/art` already cover theme tokens.
- **Performance**: a filter-heavy stage can drop frames on phones. Use one full-stage colour-matrix per time of day, no per-building filters, and turn parallax off under reduced motion or on low-end devices.
- **Raster**: photographic or painterly hero art would need WebP support in the sanitizer, the budget and the user-pack rules. Not recommended for v1.x; revisit after P3 if the vector look plateaus.
- **Licensing and provenance**: every committed file must be first-party or under a licence compatible with `LICENSE`; `art/ASSET_LOG.md` records file, route A–D, tool, prompt or reference and licence.

## 10. Suggested first step

Approve P0 and set up the collaboration scaffolding in this order: (1) create the labels and Project board from section 5; (2) ratify `art/STYLE.md` v0 with the art director; (3) add the `modern` set (`extends: default`) and `art:sync`; (4) build the `hustle-art` MCP server; (5) run the benchmark street (3 buildings, 1 interior) through both the generator loop and the direct SVG loop and compare. That is 3–5 days and ends with a before/after screenshot pair and a style freeze.
