/** M2.5: the AI uses only public + own state. */
import { describe, expect, it } from 'vitest';
import { classic, humanSeat, aiSeat, newGame, patch } from '@hustle-ring/engine/testing';
import { stateHash } from '@hustle-ring/engine';
import { aiSeed, planTurn, publicRival, sanitizeForAi } from './index.js';

const pack = classic();

describe('sanitizeForAi', () => {
  const s = patch(newGame('view', [aiSeat('Me'), humanSeat('Rival')]), 1, (p) => {
    p.cash = 9999;
    p.bank = 5000;
    p.dependability = 77;
    p.experience = 66;
    p.relaxation = 44;
    p.items.push({ uid: 'x', itemId: 'computer', condition: 'ok', boughtWeek: 1, boughtAt: 'x' });
    p.enrolled = { 'trade-school': { lessonsLeft: 3 } };
    p.lotteryTickets = 9;
  });
  it('keeps the own player intact and neutralises rivals hidden fields', () => {
    const v = sanitizeForAi(s, 0);
    expect(v.players[0]).toEqual(s.players[0]);
    const rival = v.players[1]!;
    expect(rival.name).toBe('Rival');
    expect(rival.location).toBe(s.players[1]!.location);
    expect(rival.cash).toBe(0);
    expect(rival.bank).toBe(0);
    expect(rival.dependability).toBe(0);
    expect(rival.experience).toBe(0);
    expect(rival.relaxation).toBe(0);
    expect(rival.items).toEqual([]);
    expect(rival.enrolled).toEqual({});
    expect(rival.lotteryTickets).toBe(0);
    expect(rival.investments).toEqual({});
  });
  it('re-seeds every RNG stream from an AI-owned seed and drops the log', () => {
    const v = sanitizeForAi(s, 0);
    expect(v.config.seed).toBe(aiSeed(s, 0));
    expect(v.config.seed).not.toBe(s.config.seed);
    expect(v.rng).toEqual({});
    expect(v.log).toEqual([]);
    expect(aiSeed(s, 0)).not.toBe(aiSeed(s, 1));
  });
  it('never mutates the real state', () => {
    const before = stateHash(s);
    sanitizeForAi(s, 0);
    planTurn(s, 0, pack, { difficulty: 'normal', personality: 'balanced' });
    expect(stateHash(s)).toBe(before);
  });
  it('publicRival copies only public fields', () => {
    const r = publicRival(s.players[1]!, s.players[0]!);
    expect(r.goals).toEqual(s.players[1]!.goals);
    expect(r.happiness).toBe(s.players[1]!.happiness);
    expect(r.job).toEqual(s.players[1]!.job);
    expect(r.stats.earned).toBe(0);
  });
});

describe('M2.5 AC: mutating other players hidden stats does not change the AI plan', () => {
  it.each(['easy', 'normal', 'hard'] as const)('%s', (difficulty) => {
    const base = newGame(`hidden-${difficulty}`, [aiSeat('Me', difficulty), humanSeat('Rival')]);
    const plan = planTurn(base, 0, pack, { difficulty, personality: 'balanced' });
    for (let i = 0; i < 5; i++) {
      const mutated = patch(base, 1, (p) => {
        p.cash = 100 + 1000 * i;
        p.bank = 77 * i;
        p.dependability = (13 * i) % 100;
        p.experience = (29 * i) % 100;
        p.relaxation = 10 + i;
        p.lotteryTickets = i;
        p.items.push({
          uid: `i${i}`,
          itemId: 'atlas',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'x',
        });
        p.enrolled = { academic: { lessonsLeft: i + 1 } };
      });
      const again = planTurn(mutated, 0, pack, { difficulty, personality: 'balanced' });
      expect(again.commands).toEqual(plan.commands);
    }
  });
  it('the plan does not depend on the real games future RNG streams', () => {
    const base = newGame('rng-indep', [aiSeat('Me'), humanSeat('Rival')]);
    const plan = planTurn(base, 0, pack, { difficulty: 'normal', personality: 'balanced' });
    const shifted = patch(base, 0, (_p, st) => {
      st.rng['events:0'] = [1, 2, 3, 4];
      st.rng['jobs:0'] = [9, 9, 9, 9];
    });
    expect(
      planTurn(shifted, 0, pack, { difficulty: 'normal', personality: 'balanced' }).commands,
    ).toEqual(plan.commands);
  });
});
