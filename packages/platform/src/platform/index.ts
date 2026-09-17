import type { HapticKind, ShareData } from '../types.js';

export interface Platform {
  share(data: ShareData): Promise<boolean>;
  haptics(kind: HapticKind): void;
  storageQuota(): Promise<number>;
  openExternal(url: string): void;
}

/**
 * v1 default: every method has a web fallback. Browser APIs are injected so this stays testable
 * in node and the package never touches `window` directly.
 */
export interface WebPlatformDeps {
  share?: (data: ShareData) => Promise<void>;
  vibrate?: (ms: number) => void;
  estimateQuota?: () => Promise<number>;
  open: (url: string) => void;
}

export class WebPlatform implements Platform {
  constructor(private readonly deps: WebPlatformDeps) {}

  async share(data: ShareData): Promise<boolean> {
    if (!this.deps.share) return false;
    try {
      await this.deps.share(data);
      return true;
    } catch {
      return false;
    }
  }
  haptics(kind: HapticKind): void {
    this.deps.vibrate?.(kind === 'heavy' || kind === 'error' ? 40 : 15);
  }
  storageQuota(): Promise<number> {
    return this.deps.estimateQuota ? this.deps.estimateQuota() : Promise.resolve(0);
  }
  openExternal(url: string): void {
    this.deps.open(url);
  }
}
