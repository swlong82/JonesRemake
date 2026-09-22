# REPLACE ME — `saves`

- **Contract:** `index.ts` exports `SaveStore` (`list/get/put/delete/sync?`), used by the web app through `PlatformServices`.
- **v1 default:** `IndexedDbSaveStore` in the browser, injected with an `IDBFactory` for contract tests. It opens DB `game` with `autosave`, `slots`, `settings`, and `stats` stores. Operations reject when storage is unavailable; there is no silent volatile fallback.
- **Save envelope:** `migrations.ts` upgrades v1→v2 on read/write while preserving the snapshot. Engine snapshot validation, deterministic replay and user warnings live in `apps/web/src/save` because `packages/platform` depends only on `shared`.
- **Replace by:** a remote store and explicit conflict policy while keeping this contract and transaction semantics. `sync()` currently returns `not-supported`.
- **Contract guard:** `contract.test.ts` runs against both memory and IndexedDB implementations. `indexedDb.test.ts` covers migration, reload, transaction abort, quota and unavailable storage.
