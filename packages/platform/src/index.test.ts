import { describe, expect, it } from 'vitest';
import { createLocalServices } from './index.js';

describe('createLocalServices', () => {
  it('wires every PlatformServices slot with a Local*/Null* default', async () => {
    const s = createLocalServices({ newId: () => 'fixed-id', platform: { open: () => undefined } });
    expect(Object.keys(s).sort()).toEqual(
      [
        'entitlements',
        'identity',
        'leaderboard',
        'matchmaker',
        'platform',
        'saves',
        'telemetry',
        'transport',
      ].sort(),
    );
    expect((await s.identity.signIn()).playerId).toBe('fixed-id');
    expect(s.entitlements.has('x')).toBe(true);
  });
});
