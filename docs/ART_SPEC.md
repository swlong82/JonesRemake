# 17. docs/ART_SPEC.md — art sets and scene UI (M9)

The v1 UI draws an abstract ring of tiles. M9 replaces it with the presentation the original intended: a city block seen in 3/4 view, a character who walks the street, and an interior scene with a host behind the counter at every location. The look is modern cartoon, not a pixel-art copy. PRD 2.6 still applies to every file: no original names, art, audio or text. Decisions and their alternatives are recorded in ADR-0051…0053.

## 17.1 Principles

- Art is **data**. Pictures live in art sets (SVG files + a manifest), never in components. A component asks for a key; the registry returns a URL or a wireframe.
- The **art set owns the look, the content pack owns the rules.** An art set may be used with any pack whose location ids it covers; packs never carry coordinates or file paths.
- **Every slot always renders.** A missing file, a failed load or an unknown key renders the slot's generated wireframe, labelled with its key. Nothing throws.
- **Text is never baked into art.** Location names, speech, headlines and HUD numbers are HTML/SVG text layers from i18n, so translation, the banned-terms scan and contrast checks keep working with any art set.

## 17.2 Art set layout and manifest

```text
packages/art/
├─ src/          # schema.ts, catalog.ts, sanitize.ts, tint.ts, validate.ts, placeholder.ts, contrast.ts
└─ sets/<set-id>/
   ├─ manifest.json
   └─ files/*.svg
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

## 17.4 Tint by key colour

A tintable file paints recolourable regions in the manifest's key colours. At render the registry replaces each key colour (case-insensitive `#RRGGBB`, in attributes and `style`) with the player's palette colour (primary) and a darker shade of it (secondary), and serves the result as a cached `blob:` URL per (key, colour). The same path serves bundled and user art, so there is one renderer and no inline SVG. `art:check` fails a base set whose avatar files contain no primary key colour.

## 17.5 `ArtRegistry` (web)

```ts
interface ArtRegistry {
  has(key: string): boolean;                       // key defined by the set or its base
  url(key: string, tint?: PaletteId): Promise<string>; // static URL, tinted blob URL, or wireframe data URL
  wireframe(key: string): string;                  // synchronous data: URL, always available
  board(): BoardLayout;                            // slots + path from the active set
}
```

- Bundled set files are emitted as hashed static files (Vite `import.meta.glob(..., { query: '?url' })`), not inlined into JS; the manifest is a small JSON import.
- Resolution order: user set → its `extends` chain → `default` → wireframe.
- The existing `AssetRegistry` (tokens, icons) stays for code-drawn chrome and item icons.

## 17.6 User art packs

- Import: a `.zip` with `manifest.json` + `files/*.svg`, from the Art Packs screen. It is validated with the same schema and validator as bundled sets, then stored on the device through `ArtPackStore` (`packages/platform`, IndexedDB). Nothing is uploaded.
- `extends` defaults to `default`, so a partial pack is valid and falls back per key.
- Every SVG passes the **sanitizer** before storage. Allowlisted elements and attributes only. The import is rejected (with a per-file report) on `<!DOCTYPE`/`<!ENTITY`, `<script>`, `<foreignObject>`, event-handler attributes, `href`/`xlink:href` not starting with `#`, `url(` not starting with `url(#`, `@import`, `javascript:` or `data:` anywhere, more than 5,000 elements, or more than 256 kB per file.
- User art renders only as `<img src="blob:…">`: even if the sanitizer missed something, an SVG image cannot run script or fetch.
- The theme block of a user set is contrast-checked (17.7); a failing theme is rejected, not auto-fixed.

## 17.7 Theme

`theme` = `{ font, palette, frames? }`. `font` is an id from the bundled OFL font list (no CDN, CLAUDE.md 1.3). `palette` provides `surface`, `surface2`, `ink`, `inkMuted`, `line`, `accent`, `onAccent`, `focus`, `danger`, `onDanger` as `#RRGGBB`, applied as the CSS tokens of `index.css`. Contrast MUST be ≥ 4.5:1 for `ink`/`surface`, `ink`/`surface2`, `inkMuted`/`surface`, `onAccent`/`accent` and `onDanger`/`danger`, and ≥ 3:1 for `focus`/`surface`. The default set ships a rounded, chunky cartoon kit.

## 17.8 Budgets and `pnpm art:check`

- Per file ≤ 60 kB for bundled sets (user sets: 256 kB); total bundled set ≤ 1.5 MB.
- `pnpm art:check` validates every set under `packages/art/sets/`: schema, catalog coverage for every playable pack (base sets), file presence, viewBox size, sanitizer, tint keys on avatars, theme contrast, budgets. `--report` prints drawn vs placeholder per slot group (the M9.13 tracker).
- Art files are fetched lazily per scene (board on game start, interiors on first entry, the rest prefetched when idle) and precached by a service worker for offline play (M9.11). The initial JS budget (15.4) is unchanged.

## 17.9 Scene UI

- **Desktop/tablet:** the scene fills a 16:10 stage, letterboxed and scaled. A bottom HUD bar holds the clock (hours left), cash, four goal meters, the active avatar and the menu. Standings and the event log are overlays.
- **Board:** `board:background`, then each `building:<id>` in its slot rect, then a label plate (i18n name on a contrast-guaranteed plate at `label`), then the avatars on the street path. Each slot is a focusable `<button>` over its rect that keeps the UX 7.7 keyboard map and 7.8 labels; art is decorative (`alt=""`).
- **Walking:** avatars follow `board.path` square by square, swapping `walk1`/`walk2` on a timer and facing the direction of travel; reduced motion jumps to the destination and shows `idle`.
- **Interior:** entering a location swaps the stage to `interior:<id>` with `host:<id>`, a speech bubble with the pack's greeting, and the action panel (UX 7.4) drawn inside the scene.
- **Phone (< 768 px):** the scene fills the width with drag and pinch pan/zoom; a toggle switches to the existing location list (the accessible equivalent). Interiors show a cropped header (host + bubble) above the action sheet.
- **Other screens:** title key art; setup with avatar picker and goal sliders; a weekend recap per player (`weekend:*` + avatar mood); a newspaper page (masthead art + i18n headlines from the economy phase and events).
- **Rollout:** app flag `sceneUi` (default off) until the M9 gate; e2e runs both UIs while the flag exists. The ring board is removed in the milestone after M9; the location list stays.

## 17.10 Amendments (already applied in this file; listed for traceability)

1. CLAUDE 1.2 adds `pnpm art:check`; 1.3's visuals invariant allows first-party SVG art sets and sanitized user art as `<img>`.
2. PRD 2.3 moves the art scaffold into scope; 2.4 #7 and #17 describe the scene and art sets.
3. ARCHITECTURE 5.1 adds `packages/art/` and `shared ← art`; 5.6 points to `ArtRegistry`.
4. MILESTONES adds M9; EXTENSIBILITY 12.5 and ROADMAP 16.1 point to this section; BUILD_READINESS 15.2 adds `art:check` and `art:placeholders`.
5. File map in section 0 includes section 17.
