import type { Identity } from '../types.js';

export interface IdentityProvider {
  getCurrent(): Promise<Identity | null>;
  signIn(opts?: { displayName?: string }): Promise<Identity>;
  signOut(): Promise<void>;
  token(): Promise<string | null>;
}

/**
 * v1 default: device-local identity. M7 persists it in IndexedDB; at M0 it is in-memory so the
 * contract test has a real implementation to run against.
 */
export class LocalIdentity implements IdentityProvider {
  private current: Identity | null = null;
  constructor(private readonly newId: () => string) {}

  getCurrent(): Promise<Identity | null> {
    return Promise.resolve(this.current);
  }
  signIn(opts?: { displayName?: string }): Promise<Identity> {
    this.current ??= { playerId: this.newId(), displayName: opts?.displayName ?? 'Player' };
    if (opts?.displayName) this.current = { ...this.current, displayName: opts.displayName };
    return Promise.resolve(this.current);
  }
  signOut(): Promise<void> {
    this.current = null;
    return Promise.resolve();
  }
  token(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
