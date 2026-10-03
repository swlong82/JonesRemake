# Bundled Modern art release

The game includes Modern v0.2.0 as its starting art. No zip import is needed. It supplies seven
building drawings and one room; every other slot inherits the original art. The historical P0/P1
art files and review packs remain unchanged. Players can select Original art in Settings.

Existing saved settings migrate once: the old built-in `default` choice becomes bundled Modern;
explicit custom pack IDs remain selected. An older imported pack with ID `modern` is exposed as a
separate imported choice and stays selected. Import/reimport/delete continue to use the pack's
stored ID; deleting that imported pack returns to bundled Modern. Saved games are independent of
the art choice.

## Evidence

- `desktop-modern-no-import.png` — desktop game board from a fresh profile, no import.
- `phone-modern-no-import.png` — phone game board from a fresh profile, no import.
- The browser test checks each P1 retail image against the source SVG, original-art fallback for
  the park, reload persistence, and switching back to Original.

## Local validation

- Typecheck, full unit suite (946 passed, 10 existing todos), full lint and formatting, art check
  (197 original files, 8 Modern files), generator drift check, and banned-term scan (31 terms,
  zero hits): passed.
- Production web build: passed. Initial gzip 230.6 / 350 kB; bundled art 606.8 / 1536 kB.
- Desktop and phone browser tests covering fresh bundled art, P0/P1 imports, and offline reload:
  15 passed, 3 expected skips (contact-sheet viewport and phone offline).

Current-head CI and live deployment results belong in the release PR after publication.
