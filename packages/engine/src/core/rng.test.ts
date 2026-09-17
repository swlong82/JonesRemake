import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cyrb128, Rng, STREAMS, streamSeed, xoshiroNext, type RngState } from './rng.js';

describe('cyrb128', () => {
  it('produces known vectors (golden, guards cross-engine determinism)', () => {
    expect(cyrb128('')).toEqual([41608494, 480788319, 2264674419, 2553211394]);
    expect(cyrb128('hustle')).toEqual([972222931, 1656419306, 3066405926, 3985483295]);
    expect(cyrb128('seed:economy')).toEqual([1310885958, 3693280865, 219194490, 2668679773]);
  });
  it('is never all-zero and differs per input', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const ha = cyrb128(a);
        expect(ha.some((w) => w !== 0)).toBe(true);
        if (a !== b) expect(ha).not.toEqual(cyrb128(b));
      }),
    );
  });
});

describe('xoshiro128**', () => {
  it('matches the reference sequence for state [1,2,3,4]', () => {
    const s: [number, number, number, number] = [1, 2, 3, 4];
    const out = [0, 0, 0, 0, 0].map(() => xoshiroNext(s));
    expect(out).toEqual([11520, 0, 5927040, 70819200, 2031721883]);
  });
});

describe('Rng streams', () => {
  it('known-seed vectors', () => {
    const state: RngState = {};
    const rng = new Rng(state, 'golden');
    expect([rng.int('a', 100), rng.int('a', 100), rng.int('a', 100)]).toEqual([93, 44, 44]);
    expect(rng.range('b', 5, 10)).toBe(10);
    expect(rng.bp('c')).toBe(5047);
    expect(state.a).toBeDefined();
    expect(streamSeed('golden', 'a')).toEqual(cyrb128('golden:a'));
  });

  it('same seed + stream reproduces; different stream differs', () => {
    const a = new Rng({}, 's');
    const b = new Rng({}, 's');
    const seqA = Array.from({ length: 20 }, () => a.next('x'));
    const seqB = Array.from({ length: 20 }, () => b.next('x'));
    expect(seqA).toEqual(seqB);
    const c = new Rng({}, 's');
    expect(Array.from({ length: 20 }, () => c.next('y'))).not.toEqual(seqA);
  });

  it('stream independence: draws on one stream never shift another (property)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 20 }),
        (seed, interleave) => {
          const pure = new Rng({}, seed);
          const expected = Array.from({ length: 10 }, () => pure.next('target'));
          const mixed = new Rng({}, seed);
          const got: number[] = [];
          for (let i = 0; i < 10; i++) {
            for (let k = 0; k < (interleave[i % interleave.length] ?? 0); k++) mixed.next('other');
            got.push(mixed.next('target'));
          }
          expect(got).toEqual(expected);
        },
      ),
    );
  });

  it('int is in range and unbiased-ish; rejects bad bounds', () => {
    const rng = new Rng({}, 'r');
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[rng.int('i', 3)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(850);
    expect(rng.int('i', 1)).toBe(0);
    expect(() => rng.int('i', 0)).toThrow(/positive/);
    expect(() => rng.range('i', 5, 4)).toThrow(/max < min/);
  });

  it('chance handles extremes without drawing', () => {
    const state: RngState = {};
    const rng = new Rng(state, 'c');
    expect(rng.chance('z', 0)).toBe(false);
    expect(rng.chance('z', 10_000)).toBe(true);
    expect(state.z).toBeUndefined();
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rng.chance('z', 2500)) hits++;
    expect(hits).toBeGreaterThan(400);
    expect(hits).toBeLessThan(600);
  });

  it('normal noise has ~zero mean and ~sigma spread', () => {
    const rng = new Rng({}, 'n');
    const n = 4000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.normal('g', 1000);
      sum += v;
      sq += v * v;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(60);
    expect(sd).toBeGreaterThan(900);
    expect(sd).toBeLessThan(1100);
  });

  it('weighted respects weights and validates', () => {
    const rng = new Rng({}, 'w');
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[rng.weighted('w', [0, 1, 3])]!++;
    expect(counts[0]).toBe(0);
    expect(counts[2]).toBeGreaterThan(counts[1]! * 2);
    expect(() => rng.weighted('w', [0, 0])).toThrow(/> 0/);
    expect(() => rng.weighted('w', [-1, 2])).toThrow(/negative/);
  });

  it('shuffle is a permutation', () => {
    const rng = new Rng({}, 'sh');
    const items = [1, 2, 3, 4, 5, 6];
    const out = rng.shuffle('s', items);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('stream name helpers', () => {
    expect(STREAMS.events(2)).toBe('events:2');
    expect(STREAMS.jobs(0)).toBe('jobs:0');
    expect(STREAMS.ai(1)).toBe('ai:1');
  });
});
