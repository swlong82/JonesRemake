# @hustle-ring/art — art sets

Spec: [`docs/ART_SPEC.md`](../../docs/ART_SPEC.md) (section 17). Decisions: ADR-0051…0053.

## Drawing a slot

1. Run `pnpm art:check --report` to see which slots are still wireframes.
2. Open the wireframe in `sets/default/files/` (for example `building.bank.svg`). Keep its
   `viewBox`: the size is fixed per slot (17.3). The red cross marks the anchor (bottom centre
   for buildings, hosts and avatars).
3. Replace the file with your drawing and **remove the `<!-- art:placeholder -->` comment**.
   The generator never overwrites a file without that marker.
4. Avatars: paint recolourable areas in the key colours `#FF00FF` (primary) and `#00FFFF`
   (secondary). They are swapped for the player's colour at runtime (17.4).
5. Run `pnpm art:check`. It rejects scripts, event handlers, external references, `<image>`,
   namespaced editor elements (export as plain SVG), files over 60 kB and wrong viewBox sizes.

Rules: modern cartoon style, no text baked into art (names and speech are drawn by the UI), and
nothing from the 1991 original (PRD 2.6).

## Commands

- `pnpm art:placeholders` — create or refresh wireframes for every slot without drawn art.
- `pnpm art:check [--report]` — validate every set in `sets/` (part of `pnpm verify`).
