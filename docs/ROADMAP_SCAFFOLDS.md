# 16. docs/ROADMAP_SCAFFOLDS.md — v1 non-goals as replaceable stubs

Every v1 non-goal (PRD 2.3) ships as a working stub behind a typed contract, so a later developer changes one implementation, not the call sites. Rule: each stub lives in `packages/platform/<area>/` (new package, depends only on `shared`), exports an interface, a `Local*` or `Null*` default, a `README.md` headed **REPLACE ME** with the steps, and a contract test in `packages/platform/<area>/contract.test.ts` that any future implementation MUST pass. `pnpm scaffold:check` lists every stub, its README status, and whether its contract test exists (fails CI if not).

## 16.1 Stub matrix

| Non-goal | v1 default | Contract (interface) | Replace by | Guard |
| --- | --- | --- | --- | --- |
| Online multiplayer | `LocalTransport` (in-process command bus) | `Transport` 16.4 | `WsTransport` / provider SDK adapter | contract test: ordering, idempotent `seq`, reconnect replay |
| Simultaneous turns | `SimultaneousScheduler` returns `ERR_SCHEDULER_STUB`; `rules.json.scheduler` key exists | `TurnScheduler` 5.5 | real implementation per 16.6 | skipped contract tests with `todo` reason; flag `simultaneousTurns` |
| Final art | `PlaceholderAssetRegistry`; from M9 the drawn default art set (`tools/art-default`, 17.3) | `AssetRegistry` 12.5, `ArtRegistry` 17.5 | hand-drawn SVG files in `packages/art/sets/default/`, or a user art pack (no code change) | test: every content visual key resolves; missing key renders labelled fallback, never throws; `pnpm art:check` |
| Synced art packs | `IndexedDbArtPackStore` (device only) | `ArtPackStore` (`packages/platform/src/artpacks`) | a per-account cloud store once accounts exist | contract test: list order, replace by id, delete, copy semantics |
| Accounts / identity | `LocalIdentity` (device-generated `playerId` UUID + editable display name in IndexedDB) | `IdentityProvider` 16.4 | OAuth/OIDC provider adapter | contract: `getCurrent()`, `signIn()`, `signOut()`, token refresh no-op |
| Leaderboards | `LocalLeaderboard` (IndexedDB, same schema as 16.7) | `LeaderboardService` 16.4 | remote service with server-side replay verification | contract: submit, query by scope, pagination, tie rules |
| Cloud save | `IndexedDbSaveStore` | `SaveStore` 16.4 (`list/get/put/delete/sync?`) | remote store + conflict policy | contract: schema migration, `sync()` returns `not-supported` |
| Other languages | i18n infra + `en.json`; `pseudo.json` auto-generated (accented, +35% length) | i18next resources | real locale files + RTL check | test: every key present in `pseudo`; UI e2e runs once in pseudo-locale to catch overflow |
| Native apps | PWA manifest + service worker (offline shell, no push); `Platform` shim | `Platform` (`share`, `haptics`, `storageQuota`, `openExternal`) | Capacitor/Tauri wrappers | contract: every method has a web fallback |
| Monetization | none, deliberately; `Entitlements` interface returns all-unlocked | `Entitlements` | store adapter | contract: `has(feature)` true for all in v1 |
| Analytics | `NullTelemetry` | `Telemetry` (`track(event, props)`, `flush`) | privacy-reviewed sink | test: engine never imports telemetry; UI calls go through interface only |
| More city packs | `classic`, `modern-western`; `WorldPack` with one city; `packs/_template/` overlay skeleton | 16.2–16.3 | add overlay folders | `sim:smoke` per pack; template validates |

## 16.2 Multi-city world model

- A **WorldPack** groups CityPacks and defines how they relate: `world.json = { id, version, cities: [{ packId, displayNameKey, unlock: 'always' | { minNetWorth } | { degrees } }], travel: InterCityTravel[], sharedEconomy: boolean }`. v1 ships `world-default` with one city per ruleset; setup screen shows a City picker fed by the world listing (one entry today).
- **Board topology generalised**: `board.json` gains `topology: 'ring' | 'graph'`. Ring = today's 16 squares. Graph = `nodes[]` + `edges[{ from, to, steps, modes? }]`; distance via precomputed all-pairs shortest path (Floyd–Warshall at load, integer steps). Ring is validated as the special case of a graph, and the engine's `distance(a, b)` is the only movement primitive, so a hex map or a real street network is a content change plus an SVG layout file (`layout.json`: node positions), not an engine change.
- **Inter-city travel (v3 hook)**: `InterCityTravel { fromCity, toCity, hours, cost, requires? }`; command `TravelCity{to}` registered but disabled unless `world.cities.length > 1`. Player state carries `cityId`; per-city slices keyed by city so a player keeps a job/home per city.
- **Shared economy toggle**: `sharedEconomy: true` runs one `EconState` for the world (needed for persistent city); false = per-city econ (v1).
- Content addressing becomes `pack:<packId>/<file>#<id>` internally so ids never collide across cities.

## 16.3 City pack template

`packages/content/packs/_template/` contains every pack file with `extends: modern-western`, one example override per file (rename a location, add an item, add an event, change `priceScale`), i18n stub, and `README.md` listing the 8 steps to publish a city (copy, rename id, set currency and `priceScale`, rename locations, add flavour, run `content:validate`, run `sim:smoke`, add to `world.json`). CI validates the template so it never rots.

## 16.4 Provider-agnostic backend contracts (`packages/platform`)

```ts
export interface IdentityProvider { getCurrent(): Promise<Identity | null>; signIn(opts?): Promise<Identity>; signOut(): Promise<void>; token(): Promise<string | null>; }
export interface Transport { submit(env: CommandEnvelope): Promise<Ack>; subscribe(roomId: RoomId, cb: (batch: CommandEnvelope[]) => void): Unsubscribe; resync(roomId: RoomId, fromSeq: number): Promise<CommandEnvelope[]>; }
export interface Matchmaker { createRoom(cfg: RoomConfig): Promise<Room>; join(code: string): Promise<Room>; leave(roomId): Promise<void>; list(filter?): Promise<Room[]>; }
export interface SaveStore { list(): Promise<SaveMeta[]>; get(id): Promise<SaveRecord | null>; put(rec: SaveRecord): Promise<void>; delete(id): Promise<void>; sync?(): Promise<SyncResult>; }
export interface LeaderboardService { submit(entry: ScoreEntry): Promise<SubmitResult>; query(scope: Scope, page: Page): Promise<ScorePage>; myRank(scope: Scope): Promise<Rank | null>; leagues?: LeagueApi; }
export interface Telemetry { track(event: string, props?: Record<string, JsonValue>): void; flush(): Promise<void>; }
export interface Platform { share(data): Promise<boolean>; haptics(kind): void; storageQuota(): Promise<number>; openExternal(url): void; }
export interface Entitlements { has(feature: FeatureId): boolean; refresh(): Promise<void>; }
export interface PlatformServices { identity: IdentityProvider; transport: Transport; matchmaker: Matchmaker; saves: SaveStore; leaderboard: LeaderboardService; telemetry: Telemetry; platform: Platform; entitlements: Entitlements; }
export function createLocalServices(): PlatformServices; // v1 default, all Local*/Null*
```

- `apps/web` receives `PlatformServices` through a single React context; nothing imports a concrete provider.
- Wire format for `CommandEnvelope` is versioned JSON (`v: 1`) with `seat`, `seq`, `cmd`, `clientHash` (state hash before apply) so a server can detect divergence without trusting the client.
- Every contract test runs against the `Local*` implementation in CI; a provider adapter is accepted when the same suite passes against it.

## 16.5 Massive multiplayer roadmap (plan only; no v1 implementation)

| Phase | Model | Concurrency target | Key mechanics |
| --- | --- | --- | --- |
| v2 Rooms | Matchmade rooms 2–8, private codes, async turns with per-turn deadline (default 24 h), AI takeover on timeout | 10k concurrent rooms, 50k players | Server authoritative: runs identical engine, accepts `CommandEnvelope`s, rejects on `clientHash` mismatch, broadcasts accepted batch; clients predict locally and roll back on reject |
| v3 Persistent city | Shared world per shard; each player lives their own 60-hour week concurrently; `SimultaneousScheduler` resolves the week when the clock closes (e.g. every 24 real hours) | 1k–5k players per shard, unbounded shards | Shared economy tick per shard; contested resources (job openings, pawn listings, rent stock) resolved by a fair ordering (weekly-rotated hash of playerId) so no seat bias; per-player command logs event-sourced; shard snapshot every resolution |

Design consequences already built into v1 so these phases are additive:

- Engine is pure and deterministic (13.1), so a server replays a client's log to verify it; anti-cheat is replay, not trust.
- Cross-player effects are confined to `RuleModule` hooks with `contributeShared*` variants added in v3; v1 modules never read another player's private state outside those hooks (lint rule).
- `PlayerState.cityId` + `WorldPack` (16.2) allow a persistent world to host several cities per shard.
- Job openings per workplace are a content number (`openings`, default unlimited in v1) so scarcity in v3 is a content switch.
- Command `seq` per seat and `clientHash` make the log mergeable; `stateHash` per week is the reconciliation point.
- Persistence is a `SaveStore`; v3 uses an event store behind the same interface plus a shard-level `WorldStore` (new interface, documented but not implemented).

## 16.6 Simultaneous scheduler contract (written now, implemented v2/v3)

- Week opens: all seats get 60 h; each seat submits commands independently; the engine applies them to that seat's private view immediately.
- Contested actions (`ApplyJob` where `openings` finite, `RedeemPawn`/buying pawned items, `MoveHome` where housing stock finite) are queued as intents and resolved at week close in fair order (16.5), losers receive the matching `ERR_*` and their hours refunded.
- Week closes when all seats end turn or the deadline hits (AI takeover for absent human seats); then economy tick, events, decay, win check for all seats in seat order; ties broken per 5.5.
- Contract tests exist now as `test.todo` with the exact scenario names so the implementer has the checklist.

## 16.7 Leaderboard design

- **Score** (deterministic from final state, computed by engine `score(state, seat)`): `10000 − 10 × weeksToWin + netWorthAtWin / 100 + 5 × degrees + 2 × (happiness + careerStat)`, multiplied by `goalTotal = Σtargets / 200` (goals 50 = ×1.0, goals 100 = ×2.0); losers and unfinished games score 0. Formula lives in content `rules.json.scoring` so it can be retuned without engine change; entries store `scoringVersion`.
- **Scopes**: `global` (all-time), `season:<YYYY-Qn>` (resets quarterly, season id from server time; local stub uses device time), `pack:<packId>` and `pack:<packId>:season:<id>`, `league:<leagueId>` (private/friends leagues with invite code; created by any player, up to 50 members, own seasons). All scopes are one `Scope` string, so adding a scope is a parser change only.
- **Entry**: `{ playerId, displayName, packId, packVersion, engineVersion, scoringVersion, seed, weeks, score, finishedAt, commandLogRef?, verified: boolean }`. v1 local leaderboard stores entries with `verified: false`; v2 server marks `verified: true` only after replaying the command log to the same `stateHash`.
- **Fairness rules**: AI-only games excluded; games with debug switches excluded (`GameState.debugTouched: true`, immutable once set); Classic-opacity does not change score; AI rival difficulty adds `+3%` per Hard seat, `−3%` per Easy seat (content constant).
- **UI in v1**: Stats screen shows the local board per scope with the same component v2 will point at the remote service; a "Not verified — local only" badge is rendered from `verified`.

## 16.8 Amendments (already applied in this file; listed for traceability)

1. PRD 2.3 references the stub matrix.
2. ARCHITECTURE 5.1 adds `packages/platform/`; dependency rule `shared ← platform`.
3. CONTENT 6.1 adds `world.json`, `board.json.topology` + `layout.json`, `jobs.json.openings`.
4. STATE_MODEL 13.2 adds `PlayerState.cityId`, `GameState.worldId`, `GameState.debugTouched`.
5. GDD 4.15 adds `TravelCity{to}`; 4.16 computes `score()` and submits to `LeaderboardService`.
6. MILESTONES M0.1, M0.8, M1.4, M2.1, M4.2, M7.2, M7.5, M8.1, M8.2 reference this section.
7. File map and precedence in section 0 include section 16.
