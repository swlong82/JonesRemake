/**
 * M2.3 AC: preview deltas equal actual apply deltas for deterministic commands (property test).
 * Deterministic = no RNG draw in apply: everything except ApplyJob (luck roll), RequestExtension,
 * Exit/Move at theft locations (exit theft roll) and turn-ending commands.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  legalCommands,
  previewCommand,
  theftChanceBp,
  Ctx,
  type Command,
} from '../index.js';
import { aiSeat, classic, humanSeat, makeConfig } from '../testing.js';
import { createGame } from '../index.js';
import { Rng } from './rng.js';

const pack = classic();
const RANDOM_TYPES = new Set(['ApplyJob', 'RequestExtension', 'EndTurn', 'Enter', 'BuyLottery']);

function isDeterministic(
  state: ReturnType<typeof createGame>,
  seat: number,
  cmd: Command,
): boolean {
  if (RANDOM_TYPES.has(cmd.type)) return false;
  const p = state.players[seat]!;
  if (
    (cmd.type === 'Exit' || cmd.type === 'Move') &&
    p.inside &&
    theftChanceBp(new Ctx(state, pack, seat), seat) > 0
  )
    return false;
  // A Move that runs the clock out ends the turn (weekend event = random).
  if (cmd.type === 'Move') {
    const pv = previewCommand(state, seat, cmd, pack);
    if (-pv.hours >= p.hoursLeft) return false;
  }
  if (cmd.type === 'Exit' && p.hoursLeft === 0) return false;
  return true;
}

describe('previewCommand ≡ applyCommand for deterministic commands (M2.3)', () => {
  it('hours and money deltas match over random legal play', () => {
    let checked = 0;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (seedN) => {
        const seed = `pv-${seedN}`;
        let state = createGame(makeConfig(seed, [humanSeat(), aiSeat()], { chaos: 'off' }), pack);
        const pick = new Rng({}, `pvdrv:${seed}`);
        for (let i = 0; i < 60 && state.winner === null; i++) {
          const seat = state.activeSeat;
          const legal = legalCommands(state, seat, pack);
          const cmd = legal[pick.int('c', legal.length)]!;
          const before = state.players[seat]!;
          const pv = previewCommand(state, seat, cmd, pack);
          const r = applyCommand(state, seat, cmd, pack);
          expect(r.events.some((e) => e.type === 'CommandRejected')).toBe(false);
          if (isDeterministic(state, seat, cmd) && r.state.activeSeat === seat) {
            const after = r.state.players[seat]!;
            expect(after.hoursLeft - before.hoursLeft, `${cmd.type} hours`).toBe(pv.hours);
            expect(after.cash - before.cash, `${cmd.type} cash`).toBe(pv.money);
            for (const [stat, delta] of Object.entries(pv.deltas)) {
              if (stat === 'happiness' && cmd.type !== 'Work') {
                const clamped =
                  Math.min(100, Math.max(0, before.happiness + delta)) - before.happiness;
                expect(after.happiness - before.happiness, `${cmd.type} happiness`).toBe(clamped);
              }
            }
            checked++;
          }
          state = r.state;
        }
      }),
      { numRuns: 30 },
    );
    expect(checked).toBeGreaterThan(200);
  });
  it('Work preview money equals pay when the session fits and pro-rates otherwise', () => {
    const s0 = createGame(makeConfig('pv-work', [humanSeat()]), pack);
    const p = s0.players[0]!;
    p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
    p.location = 'burger-joint';
    p.inside = true;
    for (const hours of [12, 6, 1]) {
      const pv = previewCommand(s0, 0, { type: 'Work', hours }, pack);
      const r = applyCommand(s0, 0, { type: 'Work', hours }, pack);
      expect(r.state.players[0]!.cash - 200).toBe(pv.money);
      expect(r.state.players[0]!.hoursLeft - 120).toBe(pv.hours);
    }
  });
});
