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

## 5. Tooling to add first

1. `pnpm art:preview`: a Playwright script that renders every slot in a contact sheet (buildings on the board, each interior, avatars on a grid) as one PNG per group. Use it in PRs.
2. Visual regression: screenshot the title, board, one interior and the phone map at three viewports; diff against approved images.
3. `art:check --report` in CI as a summary comment (drawn versus placeholder per group).
4. A palette module shared by the generator and the web theme so a colour change in one place rethemes both.
5. Size budget guard already exists (`pnpm budget --max-art-kb 1536`); with richer files expect around 1.2–1.4 MB, so keep decorative detail in `<defs>` and `<use>` rather than repeated paths.

## 6. Asset checklist (all counts from the current catalog)

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

## 7. Risks and decisions

- **Budget**: gradients and shadows cost bytes. Mitigation: shared `<defs>`, `<use>`, and generator-only detail.
- **Contrast**: art must not fight the text plates (17.1). Keep the label plate opaque; the contrast checks in `packages/art` already cover theme tokens.
- **Performance**: a filter-heavy stage can drop frames on phones. Use one full-stage colour-matrix per time of day, no per-building filters, and turn parallax off under reduced motion or on low-end devices.
- **Raster**: photographic or painterly hero art would need WebP support in the sanitizer, the budget and the user-pack rules. Not recommended for v1.x; revisit after P3 if the vector look plateaus.
- **Licensing and provenance**: every committed file must be first-party or under a licence compatible with `LICENSE`; keep an `ASSET_LOG.md` (file, source route A/B/C, tool, date).

## 8. Suggested first step

Approve P0. It is 2–3 days, touches only `tools/art-default/` and a new `sets/modern` manifest, and gives a before/after screenshot of the street to judge the direction with.
