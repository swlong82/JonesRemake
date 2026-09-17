/**
 * @hustle-ring/platform — provider-agnostic backend contracts + v1 `Local` / `Null` defaults
 * (ROADMAP_SCAFFOLDS 16.1, 16.4). Depends only on `shared`.
 *
 * `apps/web` receives `PlatformServices` through a single React context; nothing imports a
 * concrete provider. Each area folder has a README headed REPLACE ME and a contract test that any
 * future adapter must pass (`pnpm scaffold:check` enforces both exist).
 */
export * from './types.js';
export * from './identity/index.js';
export * from './transport/index.js';
export * from './matchmaker/index.js';
export * from './saves/index.js';
export * from './leaderboard/index.js';
export * from './telemetry/index.js';
export * from './platform/index.js';
export * from './entitlements/index.js';

import { AllUnlockedEntitlements, type Entitlements } from './entitlements/index.js';
import { LocalIdentity, type IdentityProvider } from './identity/index.js';
import { LocalLeaderboard, type LeaderboardService } from './leaderboard/index.js';
import { LocalMatchmaker, type Matchmaker } from './matchmaker/index.js';
import { WebPlatform, type Platform, type WebPlatformDeps } from './platform/index.js';
import { MemorySaveStore, type SaveStore } from './saves/index.js';
import { NullTelemetry, type Telemetry } from './telemetry/index.js';
import { LocalTransport, type Transport } from './transport/index.js';

export interface PlatformServices {
  identity: IdentityProvider;
  transport: Transport;
  matchmaker: Matchmaker;
  saves: SaveStore;
  leaderboard: LeaderboardService;
  telemetry: Telemetry;
  platform: Platform;
  entitlements: Entitlements;
}

export interface LocalServicesDeps {
  /** UUID source, injected so the package itself never calls crypto (testable, engine-style purity). */
  newId: () => string;
  platform: WebPlatformDeps;
}

export function createLocalServices(deps: LocalServicesDeps): PlatformServices {
  return {
    identity: new LocalIdentity(deps.newId),
    transport: new LocalTransport(),
    matchmaker: new LocalMatchmaker(deps.newId),
    saves: new MemorySaveStore(),
    leaderboard: new LocalLeaderboard(),
    telemetry: new NullTelemetry(),
    platform: new WebPlatform(deps.platform),
    entitlements: new AllUnlockedEntitlements(),
  };
}
