# Examples

One tested example for each recipe in [`docs/EXTENDING.md`](../docs/EXTENDING.md) (EXTENSIBILITY
12.9). Each folder holds the content or code a recipe produces and a `*.test.ts` that resolves it
through the real pipeline — Zod schemas, cross-file and i18n validators, the engine and the AI — so
a recipe that stops working fails `pnpm test` in CI.

| Folder          | Recipe                                           |
| --------------- | ------------------------------------------------ |
| `command/`      | A `Volunteer` command in its own rule module     |
| `location/`     | A Coworking Loft taking the park's square        |
| `item/`         | A standing desk (comfort durable)                |
| `event/`        | A weekend street musician                        |
| `subscription/` | A meal-kit subscription                          |
| `asset/`        | Green bonds replacing a modern instrument        |
| `city-pack/`    | Harbor Town, an overlay on the modern ruleset    |
| `language/`     | A Spanish sample bundle checked against English  |
| `personality/`  | The Minimalist AI personality                    |
| `rule-module/`  | A weekly city stipend hooked into the turn start |

`lib/overlay.ts` resolves an example overlay exactly as a bundled pack is resolved. Run just these
with `pnpm exec vitest run --project examples`.
