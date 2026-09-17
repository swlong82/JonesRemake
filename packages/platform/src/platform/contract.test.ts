import { describe, expect, it, vi } from 'vitest';
import { WebPlatform, type Platform } from './index.js';

const open = vi.fn();
const vibrate = vi.fn();
const implementations: [string, () => Platform][] = [
  ['WebPlatform (no share API)', () => new WebPlatform({ open, vibrate })],
  [
    'WebPlatform (share API)',
    () =>
      new WebPlatform({
        open,
        vibrate,
        share: () => Promise.resolve(),
        estimateQuota: () => Promise.resolve(42),
      }),
  ],
];

describe.each(implementations)('Platform contract: %s', (_name, make) => {
  it('every method has a web fallback and never throws', async () => {
    const p = make();
    expect(typeof (await p.share({ title: 't', text: 'x' }))).toBe('boolean');
    expect(() => {
      p.haptics('light');
      p.haptics('error');
    }).not.toThrow();
    expect(await p.storageQuota()).toBeGreaterThanOrEqual(0);
    p.openExternal('https://example.com');
    expect(open).toHaveBeenCalledWith('https://example.com');
  });
});

describe('WebPlatform specifics', () => {
  it('share returns false when the API rejects', async () => {
    const p = new WebPlatform({ open, share: () => Promise.reject(new Error('denied')) });
    expect(await p.share({ title: 't', text: 'x' })).toBe(false);
  });
});
