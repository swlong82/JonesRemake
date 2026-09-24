# Extending Hustle Ring

Ten recipes, one per extension point in EXTENSIBILITY 12.9. Each has a working example under
[`examples/`](../examples) whose test runs in CI with `pnpm test`, so a recipe cannot quietly rot.

Two rules apply to all of them:

- **Numbers live in content, not code** (CLAUDE.md 1.3). A rule reads its values from the CityPack
  (`ctx.rules`, `ctx.pack`), validated by the Zod schemas in `packages/content/src/schemas/`.
- **Content is overlaid, not copied.** A pack's `pack.json` names the pack it `extends`; objects
  deep-merge, arrays of `{ id }` merge by id, `{ "id": …, "_remove": true }` deletes an array
  entry, and in `i18n/en.json` and `assets.registry.json` a key set to `null` deletes it
  (ADR-0046).

Validate content with `pnpm content:validate`; run everything with `pnpm verify`.

## 1. Add a command

Example: [`examples/command/`](../examples/command) — `Volunteer` spends four hours at the clinic
for happiness.

1. Declare the command type: `interface VolunteerCommand extends BaseCommand { type: 'Volunteer' }`.
2. Write a `CommandHandler` with `schema` (Zod), `cost`, `validate` (first failing check, in order),
   `apply` (mutate through `ctx` only), `preview` and `candidates`.
3. Reuse the checks in `packages/engine/src/commands/common.ts` (`requireInside`, `requireHours`,
   `requireCash`, `requireService`). Hours are half-hours.
4. Put the handler in a `RuleModule`'s `commands`, with `order` 200 or above.
5. Register it: a pack module goes in `packages/engine/src/modules/index.ts`; an extension calls
   `registerModules(module)` before the first engine for the pack is built.
6. Run `pnpm gen:types` so the command joins the generated `Command` union.
7. Give the AI a ranking case in `packages/ai/src/planner.ts` (`quickScore`) if it should use it.
8. Add i18n keys for any UI label under `apps/web/src/i18n/en.json`.
9. Test legality, cost and effect (see `examples/command/command.test.ts`).

## 2. Add a location

Example: [`examples/location/`](../examples/location) — a Coworking Loft takes the park's square.

1. Add the entry to `locations.json`: `id`, `kind`, `services`, `open`, `category`.
2. The ring board has exactly 16 squares: in `board.json`, give the location an existing square,
   usually a filler's.
3. Remove the location it displaces: `{ "id": "park", "_remove": true }` in `locations.json`.
4. Add a visual to `assets.registry.json`: `"location:<id>": { shape, color, icon }`, and set the
   displaced location's visual to `null`.
5. Add `location.<id>.name` and three `greeting` and three `farewell` lines to `i18n/en.json`;
   set the displaced location's keys to `null`.
6. Services decide what can be done there (`SERVICE_IDS` in
   `packages/content/src/schemas/entities.ts`).
7. Run `pnpm content:validate`, then test that the location can be walked to and entered.

## 3. Add an item

Example: [`examples/item/`](../examples/item) — a standing desk, a comfort durable.

1. Add the entry to `items.json`: `id`, `nameKey`, `descKey`, `category`, `price`, `storeIds`,
   `happinessOnBuy`, `comfort`, `extraCredit`, `breakdownPerWeek`, `repairCost`, `unlocks`.
2. `storeIds` must name locations that sell items.
3. Add `item.<id>.name` and `item.<id>.desc` to `i18n/en.json`.
4. Add `"item:<id>": { shape, color, icon }` to `assets.registry.json`.
5. `comfort: true` makes relaxing at home pay more; `unlocks` opens systems (for example
   `onlineStudy`) that rules check with `ctx.hasUnlock`.
6. Test that it resolves and that `BuyItem` puts it in the inventory.

## 4. Add an event

Example: [`examples/event/`](../examples/event) — a street musician on a weekend.

1. Add the entry to `events.json`: `id`, `family`, `trigger` (`turnStart`, `weekend`,
   `onEnter:<loc>`, `onExit:<loc>`, `onAction:<cmd>`), `weight`, `effects`, `textKey`, `tone`.
2. `weight` is a per-turn chance in basis points, or a JSON-logic expression
   (CONTENT_SCHEMAS 6.2); `conditions` gate it.
3. Effects use the effect DSL: `money`, `stat`, `schedule`, `disableItem` and the rest in
   `packages/engine/src/core/effects.ts`.
4. Gate a modern event with `flag` so packs without the system never see it.
5. Add `event.<id>.title` and at least `event.<id>.text.1` to `i18n/en.json`.
6. Test that it fires, reading `EventFired` from the `applyCommand` result.

## 5. Add a subscription

Example: [`examples/subscription/`](../examples/subscription) — a meal kit.

1. Add the entry to `subscriptions.json`: `id`, `nameKey`, `locationId`, `weeklyPrice`,
   `happinessPerWeek`, `wellbeingPerWeek`, `grants`.
2. `locationId` must offer the `subscriptions` service.
3. `grants` is one of the capabilities rules check (`homeInternet`, `focusApp`, …), or empty.
4. Add `sub.<id>.name` to `i18n/en.json`.
5. The pack needs the `subscriptions` feature flag (the modern pack has it).
6. Test that `Subscribe` at the desk makes it active.

## 6. Add an investment asset

Example: [`examples/asset/`](../examples/asset) — green bonds replace the modern gold fund.

1. Add the entry to `assets.json`: `id`, `nameKey`, `model` (`drift` or `bounded`), `startCents`,
   `driftBp`, `volBp`, `econCorrBp`, `feeBp`, `crashImmune`, `set`.
2. With `modernAssets` on there are exactly six modern instruments: remove one to add one
   (`{ "id": "gold-modern", "_remove": true }`).
3. Add `asset.<id>.name` to `i18n/en.json`; set the removed asset's name to `null`.
4. `econCorrBp` is the correlation with the economy; the price model is in
   `packages/engine/src/modules/modern-assets.ts`.
5. Test that `BuyAsset` at the bank buys units and that the market prices it.

## 7. Add a city pack overlay

Example: [`examples/city-pack/`](../examples/city-pack) — Harbor Town.

1. Copy `packages/content/packs/_template/` to `packages/content/packs/<id>/`.
2. In `pack.json`, set `id`, `version`, `titleKey`, `wealthPointValue` and `extends`.
3. Add only the files you change; `rules.json` may be partial.
4. Add the title and any new strings to `i18n/en.json`.
5. Import each file in `packages/content/src/packs.ts` and add the pack to `RAW_PACKS` (a file not
   listed there is silently ignored).
6. Add the city to `packages/content/world/world.json` so it appears in the city picker.
7. Run `pnpm content:validate`, then `pnpm sim -- --pack <id> --games 200` to see how it plays.

## 8. Add a language

Example: [`examples/language/`](../examples/language) — a Spanish sample checked against English.

1. Copy `apps/web/src/i18n/en.json` to `apps/web/src/i18n/<lang>.json` and translate the values.
2. Keep every key, and every `{{placeholder}}` of the string it translates.
3. Register it in `resources` in `apps/web/src/i18n/index.ts`.
4. Add the option to the language select in `apps/web/src/ui/screens/SettingsScreen.tsx`, with its
   label in each bundle.
5. Pack strings (location names, events) are English-only in v1: a pack carries `i18n/en.json`
   and the loader rejects other pack files, so translating them is a loader change, not a recipe.
6. Run the pseudo-locale e2e (`presentation.spec.ts`) to catch strings that no longer fit.
7. Test the bundle with the check in `examples/language/language.test.ts`.

## 9. Add an AI personality

Example: [`examples/personality/`](../examples/personality) — the Minimalist.

1. Add the entry to `personalities.json`: `id`, `nameKey`, `taglineKey`, `weights` (wealth,
   happiness, education, career), `riskTolerance`, `preferences`.
2. Weights scale the goal scorers in `packages/ai/src/scorers.ts`; `riskTolerance` gates loans,
   investments and the lottery.
3. Add `personality.<id>.name` and `.tagline` to `i18n/en.json`.
4. List a rival name for it in `NAMING.md`.
5. Test that an AI seat with it plays legal turns (`runAiTurn`), then run
   `pnpm sim -- --ai normal:<id>,normal:balanced` to see how it fares.

## 10. Add a rule module

Example: [`examples/rule-module/`](../examples/rule-module) — a weekly city stipend.

1. Write a `RuleModule` with `id`, `order` (200 or above for packs and extensions) and `hooks`
   (`onGameCreate`, `onWeekStart`, `onTurnStart`, `onTurnEnd`, `onDomainEvent`,
   `contributeWealth`, `contributeIncome`, …).
2. Gate it with `flag` (a CityPack feature flag) so packs without it are untouched.
3. Read every number from content: add the fields to `packages/content/src/schemas/rules.ts` with
   defaults that leave other packs unchanged.
4. Keep per-player state in a `stateSlice` with a Zod schema and a version (migrations key off it).
5. Never draw randomness outside the seeded streams in `packages/engine/src/core/rng.ts`, and never
   in `cost()` or `validate()`, which run during previews.
6. Register it in `packages/engine/src/modules/index.ts` (or with `registerModules`).
7. If the AI should weigh it, add a scorer (`registerScorer` in `packages/ai/src/scorers.ts`).
8. Regenerate golden replays deliberately: `UPDATE_GOLDEN=1 pnpm test`.
9. Test that the hook runs in order and changes state (see
   `examples/rule-module/rule-module.test.ts`).
