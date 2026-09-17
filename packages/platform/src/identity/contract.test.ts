import { describe, expect, it } from 'vitest';
import { LocalIdentity, type IdentityProvider } from './index.js';

let n = 0;
const implementations: [string, () => IdentityProvider][] = [
  ['LocalIdentity', () => new LocalIdentity(() => `id-${++n}`)],
];

describe.each(implementations)('IdentityProvider contract: %s', (_name, make) => {
  it('starts signed out', async () => {
    expect(await make().getCurrent()).toBeNull();
  });
  it('signIn creates a stable identity and getCurrent returns it', async () => {
    const p = make();
    const a = await p.signIn({ displayName: 'Ada' });
    expect(a.displayName).toBe('Ada');
    expect(await p.getCurrent()).toEqual(a);
    const b = await p.signIn();
    expect(b.playerId).toBe(a.playerId);
  });
  it('signIn again with a new display name renames, keeps playerId', async () => {
    const p = make();
    const a = await p.signIn();
    const b = await p.signIn({ displayName: 'Bee' });
    expect(b.playerId).toBe(a.playerId);
    expect(b.displayName).toBe('Bee');
  });
  it('signOut clears; token refresh is a no-op (null) in v1', async () => {
    const p = make();
    await p.signIn();
    await p.signOut();
    expect(await p.getCurrent()).toBeNull();
    expect(await p.token()).toBeNull();
  });
});
