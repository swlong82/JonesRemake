/**
 * Seeded RNG (ARCHITECTURE 5.4): xoshiro128** seeded via cyrb128, named streams derived as
 * `seed + ':' + streamName`. Stream state lives in `GameState.rng` so the state is the RNG.
 * Integer-only outputs; normal noise via Irwin–Hall (STATE_MODEL 13.1).
 */

export type RngStreamState = [number, number, number, number];
export type RngState = Record<string, RngStreamState>;

/** cyrb128: 128-bit hash of a string → four uint32 words. */
export function cyrb128(str: string): RngStreamState {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  // Ensure the state is never all zero (xoshiro requirement).
  const s: RngStreamState = [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
  if (s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0) s[0] = 1;
  return s;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** One xoshiro128** step on the given state (mutates), returns uint32. */
export function xoshiroNext(s: RngStreamState): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

export function streamSeed(seed: string, stream: string): RngStreamState {
  return cyrb128(`${seed}:${stream}`);
}

/**
 * Stream accessor over a mutable RngState. Streams are created lazily from the game seed so the
 * order in which subsystems first draw never matters.
 */
export class Rng {
  constructor(
    private readonly state: RngState,
    private readonly seed: string,
  ) {}

  private stream(name: string): RngStreamState {
    let s = this.state[name];
    if (!s) {
      s = streamSeed(this.seed, name);
      this.state[name] = s;
    }
    return s;
  }

  /** uint32 */
  next(stream: string): number {
    return xoshiroNext(this.stream(stream));
  }

  /** Integer in [0, maxExclusive). Uses rejection sampling to stay unbiased. */
  int(stream: string, maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`rng.int: maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    if (maxExclusive === 1) return 0;
    const range = 0x1_0000_0000;
    const limit = range - (range % maxExclusive);
    for (;;) {
      const v = this.next(stream);
      if (v < limit) return v % maxExclusive;
    }
  }

  /** Integer in [min, max] inclusive. */
  range(stream: string, min: number, max: number): number {
    if (max < min) throw new Error(`rng.range: max < min (${min}, ${max})`);
    return min + this.int(stream, max - min + 1);
  }

  /** Basis-point roll in [0, 10000). */
  bp(stream: string): number {
    return this.int(stream, 10_000);
  }

  /** True with probability `chanceBp / 10000`. */
  chance(stream: string, chanceBp: number): boolean {
    if (chanceBp <= 0) return false;
    if (chanceBp >= 10_000) return true;
    return this.bp(stream) < chanceBp;
  }

  /**
   * Integer normal noise N(0, sigma) via Irwin–Hall: (Σ₁² uniform(0..10000) − 60000) × σ / 10000
   * (STATE_MODEL 13.1). Result has the same unit as `sigma`.
   */
  normal(stream: string, sigma: number): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.int(stream, 10_001);
    // Irwin-Hall of 12 uniforms(0..1) has variance 1; sum scaled by 10000.
    const z = sum - 60_000;
    return Math.round((z * sigma) / 10_000);
  }

  /** Weighted pick: returns index into `weights` (all ≥ 0, sum > 0). */
  weighted(stream: string, weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) {
      if (w < 0) throw new Error('rng.weighted: negative weight');
      total += w;
    }
    if (total <= 0) throw new Error('rng.weighted: total weight must be > 0');
    let roll = this.int(stream, total);
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] ?? 0;
      if (roll < w) return i;
      roll -= w;
    }
    return weights.length - 1;
  }

  /** Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(stream: string, items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(stream, i + 1);
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  }
}

/** Well-known stream names (ARCHITECTURE 5.4). Per-seat streams append `:<seat>`. */
export const STREAMS = {
  economy: 'economy',
  market: 'market',
  events: (seat: number): string => `events:${seat}`,
  jobs: (seat: number): string => `jobs:${seat}`,
  shop: (seat: number): string => `shop:${seat}`,
  ai: (seat: number): string => `ai:${seat}`,
  setup: 'setup',
} as const;
