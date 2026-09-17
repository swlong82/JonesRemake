import type { FeatureId } from '../types.js';

export interface Entitlements {
  has(feature: FeatureId): boolean;
  refresh(): Promise<void>;
}

/** v1: no monetization, deliberately. Everything unlocked. */
export class AllUnlockedEntitlements implements Entitlements {
  has(): boolean {
    return true;
  }
  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
