# REPLACE ME — city pack overlay template

Copy this folder to `packages/content/packs/<your-city-id>/`, change `id` in `pack.json`, and add only
the files you override. Everything not present here is inherited from the pack named in `extends`
(deep-merged by id — see `docs/CONTENT_SCHEMAS.md` §6.1 and `docs/ROADMAP_SCAFFOLDS.md` §16.3).

Files you may add (all optional; schema in §6.1): `rules.json`, `board.json`, `locations.json`,
`jobs.json`, `degrees.json`, `items.json`, `meals.json`, `clothing.json`, `transport.json`,
`subscriptions.json`, `assets.json`, `loans.json`, `events.json`, `personalities.json`,
`i18n/en.json`, `assets.registry.json`, `world.json`, `layout.json`.

Validate with `pnpm content:validate` (runs on every pack, including this template).
