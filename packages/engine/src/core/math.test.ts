import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertInt, bp, ceilDiv, clamp, floorDiv, mulDiv, pm } from './math.js';

describe('integer math (STATE_MODEL 13.1)', () => {
  it('mulDiv rounds half up and rejects non-positive divisors', () => {
    expect(mulDiv(325, 1000, 1000)).toBe(325);
    expect(mulDiv(7, 1, 2)).toBe(4);
    expect(mulDiv(5, 1, 2)).toBe(3);
    expect(mulDiv(100, 7000, 10000)).toBe(70);
    expect(() => mulDiv(1, 1, 0)).toThrow(/positive/);
  });
  it('mulDiv result is always an integer within one of the real quotient', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (a, b, c) => {
          const r = mulDiv(a, b, c);
          expect(Number.isInteger(r)).toBe(true);
          expect(Math.abs(r - (a * b) / c)).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
  it('floorDiv / ceilDiv', () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(floorDiv(-7, 2)).toBe(-4);
    expect(ceilDiv(7, 2)).toBe(4);
    expect(ceilDiv(8, 2)).toBe(4);
    expect(ceilDiv(5, 4)).toBe(2);
    expect(() => floorDiv(1, 0)).toThrow();
    expect(() => ceilDiv(1, 0)).toThrow();
  });
  it('clamp, bp, pm', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(bp(1234, 5000)).toBe(617);
    expect(pm(325, 1300)).toBe(423);
  });
  it('assertInt', () => {
    expect(() => assertInt(1.5, 'x')).toThrow(/x must be a safe integer/);
    expect(() => assertInt(3, 'x')).not.toThrow();
  });
});
