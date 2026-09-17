# 6. docs/CONTENT_SCHEMAS.md — CityPack

A CityPack is a folder of JSON files validated by Zod at build time (`pnpm content:validate`, part of `pnpm test`) and at load time. Engine code MUST only reference IDs, never display names.

## 6.1 Pack files

| File | Contents | Validation beyond schema |
| --- | --- | --- |
| `world.json` | WorldPack: id, version, cities[{packId, displayNameKey, unlock}], travel[], sharedEconomy (16.2) | every packId loads; travel refs valid |
| `pack.json` | id, version (semver), currency {symbol, code}, featureFlags, wealthPointValue, extends? | `extends` resolves to existing pack; deep-merge by id |
| `rules.json` | all GDD numeric constants (hours, decay, formulas' coefficients, probabilities) | every key used by engine exists (typed via `z.infer`) |
| `board.json` | `topology: 'ring' \| 'graph'`; ring: squares[16] {index, locationId or null, label key}; graph: nodes[] + edges[{from, to, steps, modes?}] + `layout.json` positions | ring: exactly 16, each location once, 2 home squares; graph: connected, integer steps |
| `locations.json` | id, kind (home, store, workplace, service, filler), services[], open rule, audio mood | services reference valid commands |
| `jobs.json` | id, workplaceId, titleKey, baseWage, reqExperience, reqDependability, reqDegrees[], uniformTier, automationRisk, isGig, gigRequires[], openings (default unlimited) | wages monotonic with reqs within a workplace; ids unique |
| `degrees.json` | id, nameKey, prereqs[], lessons, feeBase | DAG acyclic; exactly 11; 2 roots |
| `items.json` | GDD 4.11 item fields | storeIds valid; unlock keys from enum |
| `meals.json` | id, locationId, price, happiness, deliveryEligible | — |
| `clothing.json` | tier, store, price, weeks | tiers cover none→business |
| `transport.json` | mode id, hoursPerStep, fixedHours, cost model, unlock, wellbeing, event ids | classic pack: walk only |
| `subscriptions.json` | id, locationId, weeklyPrice, effects, priceDrift | modern only |
| `assets.json` | id, drift, vol, econCorr, fee, specialEvents[] | correlations ∈ [−1,1] |
| `loans.json` | min, max, terms[], aprModel, missedFee, defaultAfter | modern only |
| `events.json` | GDD 4.13 event schema | conditions parse as JSON-logic; effects typed |
| `personalities.json` | id, weights, riskTolerance, preferences | — |
| `i18n/en.json` | all text keys incl. flavor quips (≥ 3 greetings per location) | every key referenced exists; no unused keys |
| `assets.registry.json` | visual keys → placeholder spec {shape, color token, icon} | every location/item/avatar key mapped |

## 6.2 Effect DSL (events, items, subscriptions)

```ts
type Effect =
  | { op: 'stat'; stat: 'happiness'|'wellbeing'|'dependability'|'experience'|'relaxation'; delta: number | Range }
  | { op: 'money'; account: 'cash'|'bank'; delta: number | Range | { pctOf: 'cash'|'bank'; pct: Range } }
  | { op: 'hours'; delta: number }                     // this turn
  | { op: 'loseJob'; severanceWeeks?: number }
  | { op: 'loseItems'; filter: ItemFilter; count: number | 'all' | Range }
  | { op: 'disableItem'; itemId: ItemId; untilRepaired: true }
  | { op: 'econ'; multiply: Range } | { op: 'asset'; assetId: AssetId; multiply: Range }
  | { op: 'grant'; what: 'freeEnrollment' | 'meal'; qty: number }
  | { op: 'schedule'; eventId: EventId; inWeeks: number; chance: number };
type Range = { min: number; max: number; int?: boolean };
```

All ranges resolved by the seat's `events` RNG stream. Conditions use JSON-logic over a whitelisted read-only view: `player.*`, `econ.phase`, `week`, `location`.

## 6.3 Pack content requirements

- `classic`: values from section 3 ([SRC] exact, [ASSUMED] as specified); original-role placeholder names that are IP-safe (e.g. "Discount Store", "Burger Joint"), never original names.
- `modern-western`: `extends: classic`; overrides names/flavor; enables flags `transport, gig, delivery, subscriptions, rentHikes, loans, modernAssets, modernEvents, wellbeing, onlineStudy`; adds modern items/events.
- Minimum flavor text: 3 greetings + 3 farewells per location, 1 news headline per econ phase × 5 variants, 1 text per event × 2 variants, tutorial script keys, satirical item descriptions. Tone rules: punch at systems and trends (hustle culture, subscriptions, landlords, crypto hype), never at protected groups or real people; no profanity.
- Feature flags are booleans in `pack.json`; engine subsystems check flags; UI hides disabled features entirely.

## 6.4 Placeholder visual spec

- Locations: rounded rectangles, fill from category token (home, retail, work, finance, education, service), Lucide icon + short label, current-player-here ring highlight.
- Tokens: player color + shape + initial; 4 palettes checked for deuteranopia/protanopia/tritanopia distinction (ΔE ≥ 20 via test on hex values).
- Items/avatars: circle badge with icon + text; avatars = colored circle with initials and one of 8 simple geometric "hair" shapes.
- Theme tokens in CSS variables; light and dark themes; `prefers-color-scheme` default.
