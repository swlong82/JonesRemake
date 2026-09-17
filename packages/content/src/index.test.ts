import { describe, expect, it } from 'vitest';
import { FEATURE_FLAG_IDS, SERVICE_IDS, UNLOCK_KEYS, validatePackManifest } from './index.js';

const good = {
  id: 'classic',
  version: '0.1.0',
  currency: { symbol: '$', code: 'USD' },
  featureFlags: { transport: false },
  wealthPointValue: 1000,
};

describe('validatePackManifest', () => {
  it('accepts a valid manifest and applies defaults', () => {
    const r = validatePackManifest(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.priceScale).toBe(1000);
      expect(r.manifest.schemaVersion).toBe(1);
    }
  });
  it('lists all 12 feature flags from EXTENSIBILITY 12.4', () => {
    expect(FEATURE_FLAG_IDS).toHaveLength(12);
    expect(SERVICE_IDS.length).toBeGreaterThan(15);
    expect(UNLOCK_KEYS).toContain('rideHail');
  });
  it('rejects unknown feature flags', () => {
    const r = validatePackManifest({ ...good, featureFlags: { jetpacks: true } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.path).toBe('featureFlags.jetpacks');
  });
  it('rejects unknown top-level keys and bad semver', () => {
    const r = validatePackManifest({ ...good, version: '1.0', extra: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['version', '']));
  });
});
