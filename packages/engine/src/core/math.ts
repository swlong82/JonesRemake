/**
 * Integer arithmetic primitives (STATE_MODEL 13.1). The engine never uses floating division or
 * Math.exp/log/pow/sin/cos/sqrt for game values; `mulDiv` is the only scaling primitive.
 */

/** floor((a * b + c/2) / c) — rounded integer scaling. c must be > 0. */
export function mulDiv(a: number, b: number, c: number): number {
  if (c <= 0) throw new Error(`mulDiv: divisor must be positive, got ${c}`);
  return Math.floor((a * b + (c >> 1)) / c);
}

/** floor(a / b) for integers, b > 0. */
export function floorDiv(a: number, b: number): number {
  if (b <= 0) throw new Error(`floorDiv: divisor must be positive, got ${b}`);
  return Math.floor(a / b);
}

/** ceil(a / b) for integers, b > 0. */
export function ceilDiv(a: number, b: number): number {
  if (b <= 0) throw new Error(`ceilDiv: divisor must be positive, got ${b}`);
  return -Math.floor(-a / b);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Apply basis points: bp(1234, 5000) = 617. */
export function bp(value: number, basisPoints: number): number {
  return mulDiv(value, basisPoints, 10_000);
}

/** Apply a per-mille multiplier (economy index): pm(325, 1000) = 325. */
export function pm(value: number, perMille: number): number {
  return mulDiv(value, perMille, 1000);
}

export function assertInt(v: number, what: string): void {
  if (!Number.isSafeInteger(v)) throw new Error(`${what} must be a safe integer, got ${v}`);
}

/** Integer square root (Newton): exact floor(sqrt(n)) for n ≥ 0, no floating point. */
export function isqrt(n: number): number {
  if (n < 0) throw new Error(`isqrt: negative input ${n}`);
  if (n < 2) return n;
  let x = n;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
