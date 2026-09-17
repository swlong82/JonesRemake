import { describe, expect, it } from 'vitest';
import { AllUnlockedEntitlements, type Entitlements } from './index.js';

const implementations: [string, () => Entitlements][] = [
  ['AllUnlockedEntitlements', () => new AllUnlockedEntitlements()],
];

describe.each(implementations)('Entitlements contract: %s', (_name, make) => {
  it('has(feature) is true for every feature in v1 and refresh resolves', async () => {
    const e = make();
    for (const f of ['pack:modern-western', 'cosmetics', 'anything']) expect(e.has(f)).toBe(true);
    await expect(e.refresh()).resolves.toBeUndefined();
  });
});
