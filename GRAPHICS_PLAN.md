# Graphics plan — a modern look, and how to make the assets

Status: proposal (updated 2026-10-01 with 2D animation and 3D options, section 3). Nothing here is built yet except `pnpm art:preview`. It fits the art system that already ships (ART_SPEC 17): SVG art sets, a manifest, `extends`, tint keys, sanitizer, budgets, user zip packs.

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

## 3. Motion and 3D

The direction in section 2 is 2D vector. This section says what motion and 3D the system can carry, three ways to get a 3D look (with and without animation), and how to decide. Facts marked **tested** were run on 2026-10-01 against this repo.

### 3.1 What the system supports today

| Capability                                                               | Status                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame-swap animation (the walk cycle: `walk1`/`walk2` per direction)     | Works; the pattern extends to any pose set                                                                                                                                                                                                                                |
| Code-driven motion over `<img>` layers (CSS transforms, `framer-motion`) | Works; `framer-motion` is already bundled; reduced motion is honoured                                                                                                                                                                                                     |
| CSS `@keyframes` inside an art SVG                                       | **Tested:** passes `checkSvg` (`<style>` is allowed; `@import` and external `url()` are not) and animates when the file is drawn as `<img>` in Chromium. Not yet tested: Safari and Firefox, and `blob:` URLs (the tint path)                                             |
| SMIL (`<animate>`, `<animateTransform>`)                                 | **Tested:** rejected, `<animate>` is not on the sanitizer allowlist. Keep it that way                                                                                                                                                                                     |
| Scripted or runtime-driven vector animation (Lottie, Rive, JS in SVG)    | Not supported: no runtime, and the sanitizer forbids script                                                                                                                                                                                                               |
| Raster art (PNG, WebP)                                                   | Not supported in art sets: the catalog, sanitizer, budgets and user-pack rules are SVG-only                                                                                                                                                                               |
| 3D (models, WebGL, a 3D camera)                                          | Not supported: no 3D dependency, no model loader, no GLB handling                                                                                                                                                                                                         |
| In-app "Reduced motion" inside an `<img>` SVG                            | Gap: the OS `prefers-reduced-motion` query reaches an SVG image, but the app's own setting does not. The registry must serve a motion-free variant (it already rewrites SVG text for tinting) or the animated layer must be a separate overlay that can simply be omitted |

### 3.2 2D animation tiers

| Tier                                | What                                                                                                                                                                                  | Where it lives                                      | Cost and limits                                                                                                                             | Use for                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Presentation motion              | Transforms and fades the app applies to existing layers: parallax, avatar tweening, door-open on enter, time-of-day filter, coin and hour tokens flying to the HUD, animated counters | `apps/web/src/ui/scene/**` (lane C)                 | No asset or format change; keep it to `transform` and `opacity`; pause when the tab is hidden                                               | Feedback and state: every pay, spend, raise, rent due, week change                         |
| 2. CSS-animated SVG                 | Ambient loops inside the file: chimney steam, flag wave, window flicker, fountain, traffic light, blinking, breathing                                                                 | The art file, or better an **overlay slot** (below) | +1–3 kB a file; only `transform` and `opacity`; use `transform-box: fill-box`; cap simultaneously animated images (suggest 12 on the board) | Life on the street and in rooms                                                            |
| 3. Frame-by-frame SVG               | Several static SVGs swapped on a timer (what the avatars do now)                                                                                                                      | The art set (lane A/B)                              | One file per frame; budget grows linearly (14 frames × 10 avatars)                                                                          | Characters: walk, idle-blink, cheer, slump, phone-in-hand                                  |
| 4. Rigged or Lottie-style animation | A runtime plays a skeleton or JSON timeline                                                                                                                                           | New format and player (lazy-loaded)                 | New dependency, new sanitizer rules, an ADR and an ART_SPEC amendment                                                                       | Hero moments only (title, win screen, end card). Defer until tiers 1–3 have been exhausted |

**Overlay slots (proposed catalog extension).** Add optional `anim:<key>` slots, a transparent SVG holding only the animated parts of a building, room or avatar, drawn above the static `<key>` art. The static file stays cached and cheap; the overlay is simply not rendered under reduced motion, battery saver, an off-screen tile or a low-end device; and a missing overlay renders nothing, so the "every slot always renders" rule (17.1) holds. This also answers the in-app reduced-motion gap above without rewriting files.

**Motion principles.**

- Motion carries state or feedback, never information that appears nowhere else.
- UI transitions 150–300 ms, ambient loops slow (4–12 s) and low amplitude.
- Respect the in-app Reduced motion setting and the OS preference; pause when the tab is hidden.
- Target 60 fps on a mid-range phone; measure with the Playwright screenshots and a throttled CPU profile, not by eye.
- Never animate the label plates or action panel text.

### 3.3 Getting a 3D look

Three approaches, each with a static form and an animated form.

| Option                                          | Static (no animation)                                                                                                                           | Animated                                                                                        | Runtime cost                                                                  | Art-system change                                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3A. Pre-rendered 3D as sprites** ("2.5D")     | Model buildings, rooms and props in 3D once; render fixed views to images (or trace to vector); the game shows them like today's files          | Render frame sequences (walk, idle, cheer) and sprite loops; ambient loops from tier 2 overlays | Almost none at run time; cost moves to asset size                             | Allow raster (WebP) in bundled sets with its own budget; keep user packs SVG-only or sanitize rasters; tint needs a mask render pass; lighting is baked, so time of day is a filter |
| **3B. Real-time 3D scene** (WebGL, lazy-loaded) | The block as a 3D diorama: GLB models, real lights and shadows, a gently orbiting or snapping camera, day-night from the light, SVG as fallback | Skeletal clips for avatars and hosts (idle, walk, cheer), vehicles, particles, water            | Highest: a 3D library in the bundle, GPU and battery use, per-device variance | New renderer behind a feature flag; first-party GLB only (never user-imported); DOM buttons stay over each building so keyboard and screen-reader access are unchanged              |
| **3C. Hybrid: 2D game, 3D for hero moments**    | A turntable in the avatar picker, a title diorama, an end-screen scene                                                                          | Short skeletal clips for those screens only                                                     | Paid only on those screens; lazy-loaded                                       | Same renderer as 3B but isolated; the board and interiors stay SVG                                                                                                                  |

How the options differ:

- **Size.** 3A moves weight into image files (tens of kB per large asset, hedged: measure it). 3B moves weight into code and models. 3C pays only on a few screens.
- **Characters.** 3A needs 4 directions × frames of rendered sprites and a tint mask. 3B animates one skinned model and reuses clips across avatars; recolouring is a material parameter, which is simpler than SVG key colours.
- **Accessibility.** Canvas content is not in the DOM. Every option keeps the focusable per-building buttons and text layers that exist today (17.9), so access does not depend on the picture.
- **Testing.** Headless Chromium can run WebGL slowly. 3B needs a deterministic "freeze" mode for screenshots and axe runs; 3A and 2D do not.
- **Offline and budgets.** The service worker precaches the art set. GLB or WebP assets need their own budget line next to the 1.5 MB SVG cap and `pnpm budget`.
- **Security.** Bundled GLB and WebP are first-party. User-imported 3D models and rasters are out of scope: file parsers are a larger attack surface than the SVG sanitizer.

**Recommendation.** Stay 2D with tiers 1–3 for v1.x (cheapest, safest, already supported). Treat 3D as an experiment gated by a spike (phase P8) with explicit exit criteria, and expect 3C to be the first thing worth shipping if the spike goes well.

### 3.4 P8 spike: decide on 3D with numbers

Time-box 3–4 days. Build the same two things both ways: the bank building and one avatar with an idle and a walk loop, placed on the existing board.

| Measure                                      | 3A sprites              | 3B real-time            | Pass if                                                                            |
| -------------------------------------------- | ----------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Initial JS gzip delta                        | ~0                      | measure                 | initial bundle stays under the 350 kB budget (it is 229 kB now), or is lazy-loaded |
| Bytes per building and per avatar            | measure                 | measure                 | full set fits a stated raster/GLB budget (propose 3 MB total)                      |
| Frame time, mid-range phone, throttled       | measure                 | measure                 | 60 fps idle, no frame over 33 ms while walking                                     |
| Battery and heat (10 min on the board)       | measure                 | measure                 | no visible throttling on the test phone                                            |
| Keyboard, screen reader, axe                 | measure                 | measure                 | unchanged from today                                                               |
| Deterministic screenshot for e2e             | yes                     | needs a freeze mode     | works in CI without flake                                                          |
| Art effort for the full set (estimate)       | measure                 | measure                 | within 2× the vector plan                                                          |
| Looks clearly better than P0's vector street | side-by-side screenshot | side-by-side screenshot | art director signs off                                                             |

The outcome is an ADR: stay 2D, ship 3A, ship 3C, or ship 3B. If none passes, 2D tiers 1–3 are the plan and nothing is lost.

### 3.5 Producing the 3D and animation assets

| Need                             | Tool or route                                                                                                                                                                          | Notes                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Model buildings and rooms        | A scriptable 3D tool (for example Blender with Python, runnable headless) or a modelling connector; a parametric generator like `tools/art-default` but in 3D keeps the set consistent | An AI can write the generation script and review the render, as it does with the SVG generator |
| Render sprites (3A)              | Headless render of fixed cameras and a mask pass for tint, then convert to WebP and measure                                                                                            | Fix the camera, light and resolution in `art/STYLE.md` so every asset matches                  |
| Optimise models (3B, 3C)         | A glTF optimiser (mesh compression, texture resizing) in CI                                                                                                                            | Keep polygon counts and texture sizes in a budget table                                        |
| Author 2D animation (tiers 2, 3) | Hand-written CSS in the SVG, a design tool's animation export where the plan allows it, or generator code                                                                              | Always run `pnpm art:check`; only `transform` and `opacity` keyframes                          |
| Preview and review               | `pnpm art:preview` today; extend the contact sheet to show animated overlays playing and a "reduced motion" toggle; add a 3D viewer page for GLB review if 3B or 3C proceeds           | A 3D viewer demo connector exists in the registry (below)                                      |

Registry search on 2026-10-01 (all **not installed** here):

- **Trimble SketchUp** (`build_model`, `save_model`): AI-driven 3D modelling. A possible way to block out buildings; confirm it can export a format the pipeline accepts before relying on it.
- **Three.js 3D Viewer**: a demo viewer for interactive 3D scenes and models; no tools listed. Useful for reviewing models in chat, not for production.
- **Adobe** (`animate_design` among its tools): a candidate for 2D motion work; check what it exports and the licence terms.
- No Blender, glTF or sprite-rendering connector turned up. The practical route is local tooling driven by an agent, plus a first-party `hustle-art` MCP server (section 7) extended with `render_3d_preview` and `optimise_model` if the spike passes.

## 4. Phased plan

| Phase             | Goal                                 | Work                                                                                                                                                                                                                          | Assets                                | Effort    |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------- |
| P0 — foundations  | Prove the look on one street         | Extend `tools/art-default/svg.ts` with shared `<defs>` (light gradient, drop shadow, ambient strip) and a palette module with day/dusk/night variants; restyle 3 buildings and 1 interior as the benchmark; screenshot review | 3 buildings, 1 interior               | 2–3 days  |
| P1 — the block    | Whole street in the new style        | Regenerate all 16 `building:*` and `board:background` (roads with lane markings, kerbs, trees, park pond); roof and awning variants per location type                                                                         | 17 files                              | 3–4 days  |
| P2 — people       | Characters worth watching            | Rebuild avatars from modular parts (body, hair, outfit, accessory) composed by the generator so 6 + 4 rival styles share one skeleton; add `cheer`/`slump`/`idle-blink` frames; add pedestrian extras (untinted)              | 6 avatars × 14 frames + 4 rivals      | 5–6 days  |
| P3 — rooms        | Interiors with depth                 | Three-layer interiors (`back`, `mid`, `front` overlays) with a fixed calm right 40% for the panel; host gets 3 poses (idle, talk, react)                                                                                      | 16 interiors, 16 hosts                | 6–8 days  |
| P4 — chrome       | Modern UI shell                      | New theme block (`frame:panel`, `frame:button` 9-slice, glass surface tokens), refreshed HUD layout, animated counters, icon set                                                                                              | tokens + ~12 icons                    | 3–4 days  |
| P5 — living world | State-driven overlays from section 2 | Time-of-day filter (`feColorMatrix`), weather layer, overlays, coin-fly animation; respect reduced motion                                                                                                                     | overlays ~20                          | 4–5 days  |
| P6 — story art    | Illustrate the news and events       | One `weekend:<eventId>` illustration for each of the ~30 events and the six engine events (rent hike, breakdown, delivery lost…); masthead variants per economy phase                                                         | ~40                                   | 8–10 days |
| P7 — motion       | Tier 1–3 animation                   | Overlay slots (`anim:<key>`) in the catalog and registry; ambient loops for 6 buildings, 4 rooms and the avatars' idle/blink; reduced-motion and tab-hidden handling; contact-sheet playback toggle                           | ~20 overlays, ~40 frames              | 5–7 days  |
| P8 — 3D spike     | Decide on 3D with numbers            | Section 3.4: the same building and avatar as sprites (3A) and as a real-time model (3B); measure; write the ADR                                                                                                               | 2 buildings-worth of assets, 1 avatar | 3–4 days  |

P0 is the go/no-go gate: if the benchmark street does not look clearly better in a screenshot pair, stop and revisit before spending more. P7 can start after P1 and does not depend on P8. P8 can run in parallel with P2–P4 and only blocks 3D work; nothing else waits on it.

## 5. How to create the assets

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

## 6. Working together

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
- **The manifest is the one shared file.** Manifest entries are derived from file names and `viewBox`, so a proposed `pnpm art:sync` (section 8) writes them and contributors never hand-edit it. Until then, add your entry in alphabetical order and rebase before merging.

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

## 7. Tools and MCP servers an AI can use

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

## 8. Tooling to add

1. ~~`pnpm art:preview`~~ — done: an HTML contact sheet per set with drawn / wireframe / inherited badges. Next: a CI job that uploads it as an artifact on PRs that touch `packages/art/**` or `tools/art-default/**`, and a Playwright screenshot of it for the PR body.
1. `pnpm art:sync`: derive manifest asset entries from file names and `viewBox` so nobody hand-edits `manifest.json` (removes the one shared-file conflict).
1. The `hustle-art` MCP server from section 7.
1. Visual regression: screenshot the title, board, one interior and the phone map at three viewports; diff against approved images.
1. `art:check --report` in CI as a summary comment (drawn versus placeholder per group).
1. A palette module shared by the generator and the web theme so a colour change in one place rethemes both.
1. Animation support (P7): optional `anim:<key>` catalog slots, a registry option that omits them under reduced motion, a contact-sheet toggle to play and pause overlays, and a Safari and Firefox check of CSS-animated SVG images in `art:check` docs or an e2e.
1. Raster and GLB budget lines next to the SVG budget in `pnpm budget`, only if the P8 ADR approves 3A, 3B or 3C.
1. Size budget guard already exists (`pnpm budget --max-art-kb 1536`); with richer files expect around 1.2–1.4 MB, so keep decorative detail in `<defs>` and `<use>` rather than repeated paths.

## 9. Asset checklist (all counts from the current catalog)

| Group                 | Slots                                               | Notes                                                                           |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Board background      | 1                                                   | roads, park, sky; day/dusk/night variants come from the filter, not extra files |
| Buildings             | 16                                                  | one per location; 3 home tiers                                                  |
| Interiors             | 16                                                  | calm right 40% for the panel                                                    |
| Hosts                 | 16                                                  | 3 poses in P3                                                                   |
| Avatars               | 6 human + 4 rival                                   | 12 walk frames + cheer + slump each; add idle-blink                             |
| Weekend and event art | 3 moods now, ~40 wanted                             | P6                                                                              |
| UI                    | title, setup, masthead ×3 phases, frames, ~12 icons |                                                                                 |
| Overlays (state)      | ~20                                                 | closed, due, hiring, weather, rain, night lights                                |
| Overlays (animated)   | ~20 `anim:<key>` slots                              | steam, flags, window flicker, fountain, blink and idle loops (P7)               |
| 3D spike assets       | 2 buildings, 1 avatar, both ways                    | P8 only; kept out of the shipped set unless the ADR says otherwise              |

## 10. Risks and decisions

- **Budget**: gradients and shadows cost bytes. Mitigation: shared `<defs>`, `<use>`, and generator-only detail.
- **Contrast**: art must not fight the text plates (17.1). Keep the label plate opaque; the contrast checks in `packages/art` already cover theme tokens.
- **Performance**: a filter-heavy stage can drop frames on phones. Use one full-stage colour-matrix per time of day, no per-building filters, and turn parallax off under reduced motion or on low-end devices.
- **Raster and 3D**: sprites (3A) and 3D models (3B, 3C) need bundled WebP or GLB support, their own budget lines and an ART_SPEC amendment. They are gated by the P8 spike (section 3.4); until then v1.x stays vector. User-imported rasters and models stay out of scope.
- **Animation cost**: many animated images at once can drop frames. Cap simultaneously animated overlays, animate only `transform` and `opacity`, pause when hidden, and keep overlays optional so they can be switched off.
- **Reduced motion**: an `<img>` SVG cannot see the app's own setting. Overlay slots (section 3.2) solve it by not rendering; do not rely on CSS media queries alone.
- **Browser coverage**: CSS animation in SVG images is tested in Chromium only. Add Safari and Firefox to the P0 check before relying on it.
- **Licensing and provenance**: every committed file must be first-party or under a licence compatible with `LICENSE`; `art/ASSET_LOG.md` records file, route A–D, tool, prompt or reference and licence.

## 11. Suggested first step

Approve P0 and set up the collaboration scaffolding in this order: (1) create the labels and Project board from section 6; (2) ratify `art/STYLE.md` v0 with the art director; (3) add the `modern` set (`extends: default`) and `art:sync`; (4) build the `hustle-art` MCP server; (5) run the benchmark street (3 buildings, 1 interior) through both the generator loop and the direct SVG loop and compare. That is 3–5 days and ends with a before/after screenshot pair and a style freeze.
