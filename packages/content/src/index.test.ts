import { describe, expect, it } from 'vitest';
import { FEATURE_FLAG_IDS, validatePackManifest } from './index.js';

const good = {
  id: 'classic',
  version: '0.1.0',
  currency: { symbol: '$', code: 'USD' },
  featureFlags: { transport: false },
  wealthPointValue: 1000,
};

describe('validatePackManifest', () => {
  it('accepts a valid manifest', () => {
    const r = validatePackManifest(good);
    expect(r.ok).toBe(true);
  });
  it('lists all 12 feature flags from EXTENSIBILITY 12.4', () => {
    expect(FEATURE_FLAG_IDS).toHaveLength(12);
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
