/** M8.1: leaderboard score (ROADMAP_SCAFFOLDS 16.7), every constant from `rules.scoring`. */
import { describe, expect, it } from 'vitest';
import { netWorth, score } from '../index.js';
import { aiSeat, classic, humanSeat, newGame, patch } from '../testing.js';

const pack = classic();

/** Seat 0 has won at week 40 with known stats; goals 50 each so Σtargets / 200 = 1. */
function won(rival = aiSeat('R', 'normal')) {
  let s = newGame('score', [humanSeat('W', 50), rival], { chaos: 'off' });
  s = patch(s, 0, (p, st) => {
    p.cash = 3_000;
    p.bank = 2_000;
    p.degrees = ['trade-school', 'junior-college'];
    p.happiness = 60;
    p.dependability = 40; // career 50 with the job below
    p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
    st.week = 40;
    st.winner = 0;
    st.phase = 'over';
  });
  return s;
}

describe('score (16.7)', () => {
  it('follows the content formula for a winner', () => {
    const s = won();
    const g = pack.rules.scoring;
    const career = 50; // dependability 40 × 1.25, tenure long past at week 40
    const expected =
      g.base -
      g.perWeek * 40 +
      Math.floor(5_000 / g.netWorthDivisor) +
      g.perDegree * 2 +
      g.perHappinessCareer * (60 + career);
    expect(netWorth(s, 0, pack)).toBe(5_000);
    expect(score(s, 0, pack)).toBe(expected);
  });

  it('scores 0 for the loser and for an unfinished game', () => {
    const s = won();
    expect(score(s, 1, pack)).toBe(0);
    expect(score({ ...s, winner: null }, 0, pack)).toBe(0);
  });

  it('scales with the goal total: goals 100 score twice goals 50', () => {
    const s50 = won();
    const s100 = patch(s50, 0, (p) => {
      p.goals = { wealth: 100, happiness: 100, education: 100, career: 100 };
    });
    expect(score(s100, 0, pack)).toBe(2 * score(s50, 0, pack));
  });

  it('adds 3% per Hard rival and takes 3% per Easy rival', () => {
    const base = score(won(), 0, pack);
    const hard = score(won(aiSeat('R', 'hard')), 0, pack);
    const easy = score(won(aiSeat('R', 'easy')), 0, pack);
    expect(hard).toBe(Math.floor((base * 10_300 + 5_000) / 10_000));
    expect(easy).toBe(Math.floor((base * 9_700 + 5_000) / 10_000));
  });

  it('does not depend on classic opacity', () => {
    const s = won();
    const opaque = { ...s, config: { ...s.config, classicOpacity: true } };
    expect(score(opaque, 0, pack)).toBe(score(s, 0, pack));
  });
});
