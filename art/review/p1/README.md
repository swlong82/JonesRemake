# P1 retail exteriors — Modern v0.2.0

Four new 240 × 240 soft-lit vector storefronts extend the approved October 1 daytime direction. The cumulative pack has seven buildings and the P0 Co-Living interior; 189 of 197 slots inherit Default. Labels remain in HTML. No default-art selection or runtime code changed.

| Slot                         | Modern Western label | Visual identity                                            |
| ---------------------------- | -------------------- | ---------------------------------------------------------- |
| `building:discount-store`    | MegaMart Marketplace | Wide low coral storefront, striped awning, basket roof cue |
| `building:clothing-boutique` | Threadline           | Narrow mauve facade, garment display and roof pictogram    |
| `building:electronics-store` | GadgetHub            | Compact blue-gray shop, screen roof cue and broad glass    |
| `building:grocery`           | FreshCart Grocery    | Low green facade, striped awning and produce cluster       |

Download [modern-retail-v0.2.0.zip](modern-retail-v0.2.0.zip), then use Settings → Art packs → import. Select Modern Western in New Game for the labels. Reimporting the same pack updates its stored copy; the choice remains local to each browser/device.

![Native and 44 px comparison](contact-sheet.png)

| Game view     | Default                            | Modern v0.2.0                    |
| ------------- | ---------------------------------- | -------------------------------- |
| Desktop board | [before](desktop-before-board.png) | [after](desktop-after-board.png) |
| Phone board   | [before](phone-before-board.png)   | [after](phone-after-board.png)   |

The P0 benchmark files, zip and screenshots are historical evidence and remain unchanged. This batch adds no board, interior, host, avatar, theme, animation, UI or gameplay changes. The previously reported outside-home action-list keyboard-focus issue remains a separate UI follow-up. CI currently omits the full `art:check` command, so it is run explicitly for this batch.

## Validation record

Local checks on the production branch:

| Check                                               | Result                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generator drift and full `art:check --report`       | Pass: all eight Modern overrides and 197 Default slots valid                                                                                                                                                                                     |
| Banned terms                                        | Pass: 31 terms checked, zero hits                                                                                                                                                                                                                |
| Lint and typecheck                                  | Pass                                                                                                                                                                                                                                             |
| Generator and importer unit tests                   | 16 passed                                                                                                                                                                                                                                        |
| P0 and P1 targeted browser tests, desktop and phone | 13 passed, three expected skips; final P1 contact sheet rerun passed                                                                                                                                                                             |
| Web build and budget                                | Web build compiled. The `pnpm build` wrapper stopped when `tsx` could not create a sandbox IPC socket for its budget step; the same budget script passed directly through Node: 229.4/350 kB initial gzip and 576.9/1536 kB bundled Default art. |
| P0 preservation                                     | No diff in the four P0 SVGs, historical zip or screenshots. The P0 zip retains SHA-256 `44c84c5dc0e93e232edd69552c3bca17c7f84db2cdba00057a1cf41323f60376`.                                                                                       |
| P1 archive                                          | Nine file entries (manifest plus eight SVGs) match source byte for byte. SHA-256 `dbee2c76d0f9ac20e81e47ad60fb39df58433fb9951ff4745265b4a4b08eb694`.                                                                                             |

The browser checks exercise import and reimport, reload persistence, all four retail keys, inherited fallback and avatar tint at desktop and phone sizes. The P0 exact-zip browser checks also pass. CI runs on pull requests, so current-head CI remains pending until the draft PR exists; the full `art:check` step remains absent from CI.
