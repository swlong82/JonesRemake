# Art workspace

Everything for making and reviewing game art. Read `GRAPHICS_PLAN.md` for the direction and the phased plan, `art/STYLE.md` for the look, and `docs/ART_SPEC.md` (SPEC_PACK §17) for the technical contract.

## Pick up work

1. Find an open issue labelled `art` (form: **Art asset**). One issue is one slot group, for example "P1 buildings" or "avatar player-3".
2. Claim it: assign yourself and comment "claiming". Move the label `art:brief` → `art:claimed`.
3. Branch `art/<group>-<slot>` from `main`; open a **draft** PR early titled `art(<group>): <slot>`.
4. Make the file (lane below), preview it, fill the checklist, mark the PR ready and set `art:review`.

## Lanes (so people do not collide)

| Lane            | What                                            | Where you edit                                   | Rule                                                                                                         |
| --------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| A. Generated    | buildings, roads, icons, overlays drawn by code | `tools/art-default/**`, then run `pnpm art:draw` | Never hand-edit a file that carries the `art:default generated` marker; change the generator and commit both |
| B. Hand-drawn   | characters, hosts, story illustrations          | `packages/art/sets/<set>/files/<slot-file>.svg`  | One file per PR where possible; files never conflict                                                         |
| C. Presentation | time of day, weather, overlays, animation       | `apps/web/src/ui/scene/**`                       | Normal code review; no art files                                                                             |

New drawn art goes in the `modern` set (`extends: default`) so unfinished slots keep working from `default`.

## Commands

```bash
pnpm art:check --report     # schema, sizes, sanitizer, tint keys, budgets; drawn vs wireframe per group
pnpm art:preview            # contact sheet: reports/art-preview/<set>/index.html (open in a browser)
pnpm art:anim-check        # does CSS animation in an art SVG play as <img>? (--browser firefox|webkit)
pnpm art:draw               # regenerate the default set from tools/art-default
pnpm art:placeholders       # write a wireframe for any slot still missing a file
pnpm check:banned           # banned-terms scan
```

## Definition of done for an asset

- [ ] `pnpm art:check` passes; file ≤ 60 kB; `viewBox` equals the catalog size
- [ ] Tintable slots (avatars) paint recolourable regions with `#FF00FF` (primary) and `#00FFFF` (secondary) and nothing else uses those values
- [ ] No text, no embedded raster, no external references (the sanitizer rejects them)
- [ ] Follows `art/STYLE.md` (palette, light, outline, camera); screenshot from `pnpm art:preview` attached to the PR
- [ ] Legible next to its label plate and on the board at phone size
- [ ] A row added to `art/ASSET_LOG.md` (source route, tool, prompt or reference, author, licence)
- [ ] `pnpm check:banned` clean: no original names, art or lookalikes

## Review

Two gates. The art director reviews the contact sheet against `STYLE.md` (look). Local validation reviews the mechanics (`art:check`, banned terms, budgets); CI does not currently run the full `art:check` command. Approve in batches ("street pass") so style questions are settled once.

## Working with AI tools

Anyone may use AI to draft, but the person who opens the PR is accountable for the file. Record the tool and prompt in `ASSET_LOG.md`, review the output against the checklist yourself, and never commit unreviewed generator output. See `GRAPHICS_PLAN.md` section 7 for tools and MCP servers, and section 3 for animation and 3D rules.

## Import the Modern pack

The `modern` v0.2.0 set overrides seven buildings and the Co-Living room; 189 slots
inherit from `default`. It is delivered through the existing user-pack importer, because
the web registry currently bundles only the default set. Merely adding a set folder does
not make it selectable in the game.

```bash
pnpm art:modern                 # deterministic generation; leaves default untouched
pnpm art:modern --check         # fail on committed-output drift
pnpm art:check
pnpm art:preview --set modern
mkdir -p art/review/p1
(cd packages/art/sets/modern && zip -X -q ../../../../art/review/p1/modern-retail-v0.2.0.zip manifest.json files/*.svg)
```

Open the game → Settings → Art packs → import `art/review/p1/modern-retail-v0.2.0.zip`.
Select **Modern Western** in New Game to see the Co-Living Pod, Burger Stack,
NeoBank, MegaMart Marketplace, Threadline, GadgetHub and FreshCart Grocery labels; the art also works with Classic's same location IDs. Imported art stays
on that browser/device. Select **Default** in Settings to compare or remove the pack.
No deployment or loader edit is required; this pack also imports into the current live game.

Review evidence: [P0 benchmark](review/p0/README.md) and [P1 retail batch](review/p1/README.md).
