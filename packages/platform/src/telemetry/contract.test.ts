import { describe, expect, it } from 'vitest';
import { NullTelemetry, type Telemetry } from './index.js';

const implementations: [string, () => Telemetry][] = [['NullTelemetry', () => new NullTelemetry()]];

describe.each(implementations)('Telemetry contract: %s', (_name, make) => {
  it('track never throws and flush resolves', async () => {
    const t = make();
    expect(() => {
      t.track('game_started', { seats: 2 });
      t.track('no_props');
    }).not.toThrow();
    await expect(t.flush()).resolves.toBeUndefined();
  });
});
