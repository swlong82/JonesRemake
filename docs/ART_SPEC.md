# 17. docs/ART_SPEC.md — art sets and scene UI (M9)

The v1 UI draws an abstract ring of tiles. M9 replaces it with the presentation the original intended: a city block seen in 3/4 view, a character who walks the street, and an interior scene with a host behind the counter at every location. The look is modern cartoon, not a pixel-art copy. PRD 2.6 still applies to every file: no original names, art, audio or text. Decisions and their alternatives are recorded in ADR-0051…0058.

## 17.1 Principles

- Art is **data**. Pictures live in art sets (SVG files + a manifest), never in components. A component asks for a key; the registry returns a URL or a wireframe.
- The **art set owns the look, the content pack owns the rules.** An art set may be used with any pack whose location ids it covers; packs never carry coordinates or file paths.
- **Every slot always renders.** A missing file, a failed load or an unknown key renders the slot's generated wireframe, labelled with its key. Nothing throws.
- **Text is never baked into art.** Location names, speech, headlines and HUD numbers are HTML/SVG text layers from i18n, so translation, the banned-terms scan and contrast checks keep working with any art set.

## 17.2 Art set layout and manifest

```text
packages/art/
├─ src/          # schema, catalog, sanitize, tint, contrast, validate, resolve, placeholder, generate
└─ sets/<set-id>/
   ├─ manifest.json
   └─ files/*.svg
tools/art-default/   # generator of the drawn default set (17.3)
apps/web/src/assets/art/   # ArtRegistry, theme, prefetch, zip import, art-pack library (17.5–17.7)
```

`manifest.json` (Zod `ArtManifestSchema`, `schemaVersion: 1`):

| Field | Meaning |
| --- | --- |
| `id`, `name`, `version`, `author?`, `license?` | Identity. `id` matches `^[a-z0-9-]+$`. |
| `extends?` | Base set id. Keys this set does not define resolve from the base (user sets extend `default`). A base set (no `extends`) MUST define every catalog slot (17.3). |
| `stage` | `{ width: 1600, height: 1000 }` — the 16:10 coordinate space of the board, interiors and full-screen scenes. |
| `tintKeys` | `{ primary: "#FF00FF", secondary: "#00FFFF" }` — key colours replaced per player (17.4). |
| `theme` | Palette tokens, font id and optional 9-slice frame keys (17.7). |
| `board` | `slots[]` (one per ring index: building `rect`, `door` point, `label` anchor) and `path[]` (closed street polyline, one waypoint per slot, walked in ring order). Slot count MUST equal the pack's board size. |
| `assets` | `Record<key, { file, width, height }>` — `file` is relative to `files/`; `width`/`height` MUST equal the SVG's `viewBox` size. |

## 17.3 Slot catalog

The catalog is computed from the playable packs (`catalogFor({ locationIds, personalityIds })`), so a pack that adds a location adds its three slots. Sizes are viewBox units.

| Key | Size | Tint | Notes |
| --- | --- | --- | --- |
| `board:background` | 1600×1000 | – | Streets, park, sky. No building art. |
| `building:<locationId>` | 240×240 | – | 3/4 front, fitted into its board slot `rect`; bottom-centre is the kerb. |
| `interior:<locationId>` | 1600×1000 | – | Room; the right 40% stays calm for the action panel. |
| `host:<locationId>` | 400×600 | – | Host character, feet on the bottom edge; speech bubble anchored top-right. |
| `avatar:<avatarId>:<pose>:<dir>` | 64×96 | primary (+ secondary) | `pose` ∈ `idle`, `walk1`, `walk2`; `dir` ∈ `n`, `e`, `s`, `w` (12 files per avatar). |
| `avatar:<avatarId>:<mood>:s` | 64×96 | primary | `mood` ∈ `cheer`, `slump` — weekend recap and end screen. |
| `weekend:<mood>` | 1600×1000 | – | `mood` ∈ `positive`, `negative`, `neutral`; optional `weekend:<eventId>` overrides. |
| `ui:title` | 1600×1000 | – | Title key art. |
| `ui:setup` | 1600×1000 | – | Setup background. |
| `ui:newspaper-masthead` | 1200×200 | – | Masthead only; the paper's name is an i18n text layer. |
| `frame:panel`, `frame:button` | 96×96 | – | 9-slice, 32-unit border. |

Avatars: `player-1`…`player-6` are selectable by humans (distinct silhouettes); `rival-<personalityId>` is the AI's own avatar per personality. Each avatar also carries a code-drawn shape badge (circle, square, triangle, diamond), so colour is never the only signal (UX 7.8).

Placeholders: `pnpm art:placeholders` writes a wireframe for every catalog slot that has no file, and the board layout if the manifest has none. A wireframe shows the key, the frame, a diagonal cross, the anchor and the tint region, and carries the marker comment `<!-- art:placeholder -->`. The generator overwrites only files with that marker, so drawn art is never touched; output is byte-stable.

Default set (M9.13): `tools/art-default/` draws every catalog slot deterministically in the modern-cartoon style (building fronts with pictogram signs, the board background around the set's own layout, interiors, hosts in uniform, avatars, weekend moods, title, setup, masthead, frames); `pnpm art:draw` writes them. Its files carry `<!-- art:default generated by tools/art-default -->`; it rewrites only wireframes and its own output, never a hand-drawn file (one without either marker). A tools test fails when the committed set drifts from the generator.

## 17.4 Tint by key colour

A tintable file paints recolourable regions in the manifest's key colours. At render the registry replaces each key colour (case-insensitive `#RRGGBB`, in attributes and `style`) with the player's palette colour (primary) and a darker shade of it (secondary), and serves the result as a cached `blob:` URL per (key, colour). The same path serves bundled and user art, so there is one renderer and no inline SVG. `art:check` fails a base set whose avatar files contain no primary key colour.

## 17.5 `ArtRegistry` (web)

```ts
interface ArtRegistry {
  has(key: string): boolean;                       // key defined by a set in the chain, or an optional override's fallback
  hasOwn(key: string): boolean;                    // key defined by a set in the chain (no fallback)
  url(key: string, tint?: PaletteId): Promise<string>; // static URL, tinted blob URL, or wireframe data URL
  wireframe(key: string): string;                  // synchronous data: URL, always available
  prefetch(requests: { key: string; tint?: PaletteId }[]): Promise<void>; // warm the cache (17.8)
  board(): BoardLayout | undefined;                // slots + path from the active chain
  theme(): ArtTheme | undefined;                   // theme from the active chain (17.7)
}
```

- Bundled set files are emitted as hashed static files (Vite `import.meta.glob(..., { query: '?url' })`, never inlined: `vite.config.ts` excludes `packages/art/sets/` from `assetsInlineLimit`); the manifest is a small JSON import.
- Resolution order: user set → its `extends` chain → `default` → wireframe.
- `artRegistryFor(pack)` builds one registry per pack over the active chain; `installArtSets(packs, active)` replaces the installed user sets (their files as `blob:` URLs, old ones revoked) and rebuilds every registry. Components subscribe to the art-set version so a switch re-renders them.
- The existing `AssetRegistry` (tokens, icons) stays for code-drawn chrome and item icons.

## 17.6 User art packs

- Import: a `.zip` with `manifest.json` + `files/*.svg` (optionally under one shared top folder), from Settings → Art packs. At most 400 entries and 4 MB unpacked, checked on the declared sizes before inflating; text must be UTF-8; other entries are ignored and listed. It is validated with the same schema and validator as bundled sets, then stored on the device through `ArtPackStore` (`packages/platform/src/artpacks`, IndexedDB database `art-packs`) and becomes the active set (Settings `artSet`). Nothing is uploaded. Re-importing an id replaces the stored pack; the id `default` is reserved (ADR-0057).
- `extends` defaults to `default`, so a partial pack is valid and falls back per key. Stored packs are re-validated against the manifest schema on every load; one that no longer parses is skipped.
- Every SVG passes the **sanitizer** before storage. Allowlisted elements and attributes only. The import is rejected (with a per-file report) on `<!DOCTYPE`/`<!ENTITY`, `<script>`, `<foreignObject>`, event-handler attributes, `href`/`xlink:href` not starting with `#`, `url(` not starting with `url(#`, `@import`, `javascript:` or `data:` anywhere, more than 5,000 elements, or more than 256 kB per file.
- User art renders only as `<img src="blob:…">`: even if the sanitizer missed something, an SVG image cannot run script or fetch.
- The theme block of a user set is contrast-checked (17.7); a failing theme is rejected, not auto-fixed.

## 17.7 Theme

`theme` = `{ font, palette, frames? }`. `font` is an id from the bundled OFL font list (no CDN, CLAUDE.md 1.3): `system` or `nunito` (`@fontsource/nunito`, 400 and 700). `palette` provides `surface`, `surface2`, `ink`, `inkMuted`, `line`, `accent`, `onAccent`, `focus`, `danger`, `onDanger` as `#RRGGBB`, applied as the CSS tokens of `index.css`. Contrast MUST be ≥ 4.5:1 for `ink`/`surface`, `ink`/`surface2`, `inkMuted`/`surface`, `onAccent`/`accent` and `onDanger`/`danger`, and ≥ 3:1 for `focus`/`surface`. The default set ships a rounded, chunky cartoon kit. The art theme drives the tokens while `sceneUi` is on, except when the player chose Dark explicitly (ADR-0054); `.art-frame` elements get the 9-slice panel frame as a border image.

## 17.8 Budgets and `pnpm art:check`

- Per file ≤ 60 kB for bundled sets (user sets: 256 kB); total bundled set ≤ 1.5 MB, checked on the source by `art:check` and on the emitted build by `pnpm budget --max-art-kb 1536`.
- `pnpm art:check` validates every set under `packages/art/sets/`: schema, catalog coverage for every playable pack (base sets), file presence, viewBox size, sanitizer, tint keys on avatars, theme contrast, budgets. `--report` prints drawn vs placeholder per slot group (the M9.13 tracker).
- Art files are fetched lazily per scene (board on game start, interiors on first entry; interiors, hosts, weekend art and each player's tinted walk frames are prefetched when the browser is idle) and precached by a service worker for offline play (M9.11): the `hustle-ring-sw` Vite plugin writes `sw.js` from `apps/web/sw/template.js` with every emitted file except source maps, the build manifest and non-Latin font subsets; pages are network-first, other same-origin GETs cache-first; only production builds register it (ADR-0056). The initial JS budget (15.4) is unchanged.

## 17.9 Scene UI

- **Desktop/tablet:** the scene fills a 16:10 stage, letterboxed and scaled. A bottom HUD bar holds the active avatar, the clock (hours left), cash, bank, four goal meters and buttons for the full HUD (Details), the newspaper (when bought this week), standings, the log and the menu. Sheets (travel, standings, log, menu, full HUD, newspaper, the outside location panel) open in a 360-px column beside the stage at ≥ 1024 px and under it on narrower screens, so they never cover a square or an avatar (ADR-0058).
- **Board:** `board:background`, then each `building:<id>` in its slot rect, then the avatars on the street path, then a label plate per square (i18n name on a contrast-guaranteed plate at `label`, drawn last so an avatar never hides it). Each slot is a focusable `<button>` over its rect that keeps the UX 7.7 keyboard map and 7.8 labels; art is decorative (`alt=""`).
- **Walking:** avatars follow `board.path` square by square the short way round (a tie goes clockwise), 180 ms a square, swapping `walk1`/`walk2` every 120 ms and facing the direction of travel, then stand `idle` facing the viewer; reduced motion (the setting or the OS preference) jumps to the destination with no intermediate frame. Humans pick their avatar in setup; the choice is the optional, presentation-only `SeatConfig.avatar` (ADR-0055); AI seats show `rival-<personality>`.
- **Interior:** entering a location swaps the stage to `interior:<id>` with `host:<id>`, a speech bubble with the pack's greeting, and the action panel (UX 7.4) drawn inside the scene.
- **Phone (< 768 px):** a Map/List toggle; the map fills a 4:3 viewport at 1–3× zoom (buildings ≥ 44 px at 1×), drag pans, pinch or ± buttons zoom, a drag never counts as a tap, and the view opens on the active player. The list is the existing location list (the accessible equivalent). Interiors show a cropped header (host + bubble) above the action sheet.
- **Other screens:** title key art behind an opaque menu panel; a setup banner and the avatar picker; a weekend event card shows `weekend:<eventId>` (else the picture for its tone) with the avatar cheering, slumping or standing by; the newspaper, bought with `ReadNews`, shows the masthead, the paper's name as text, the headline for the hinted phase and this week's economy stories — never whether the hint is accurate.
- **Art packs:** Settings lists the default set and every imported pack, switches between them, imports a zip with a per-issue report, and deletes packs (17.6).
- **Rollout:** app flag `sceneUi` (default off) until the M9 gate; e2e runs both UIs while the flag exists. The ring board is removed in the milestone after M9; the location list stays.

## 17.10 Amendments (already applied in this file; listed for traceability)

1. CLAUDE 1.2 adds `pnpm art:check`; 1.3's visuals invariant allows first-party SVG art sets and sanitized user art as `<img>`.
2. PRD 2.3 moves the art scaffold into scope; 2.4 #7 and #17 describe the scene and art sets.
3. ARCHITECTURE 5.1 adds `packages/art/` and `shared ← art`; 5.6 points to `ArtRegistry`.
4. MILESTONES adds M9; EXTENSIBILITY 12.5 and ROADMAP 16.1 point to this section; BUILD_READINESS 15.2 adds `art:check`, `art:placeholders`, `art:draw` and the art budget.
5. File map in section 0 includes section 17.
6. ROADMAP 16.1 adds the `artpacks` stub area (`ArtPackStore`).
7. After the M9.1 draft: sheets moved beside the stage (ADR-0058); the service worker, zip limits, theme precedence and seat avatar are ADR-0054…0057.
