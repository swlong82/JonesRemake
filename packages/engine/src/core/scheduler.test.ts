/** M1.4 (scheduler, win, module order) + M1.5 (start-of-turn pipeline order). */
import { describe, expect, it, test } from 'vitest';
import {
  applyCommand,
  createEngine,
  createGameWithEngine,
  engineFor,
  legalCommands,
  SimultaneousScheduler,
  type RuleModule,
} from '../index.js';
import { CORE_MODULES } from '../modules/index.js';
import { aiSeat, classic, humanSeat, makeConfig, newGame, patch, run } from '../testing.js';

const pack = classic();

describe('SequentialScheduler (GDD 4.2)', () => {
  it('turn order cycles seats and increments the week on wrap (4 seats)', () => {
    let s = newGame('order', [humanSeat('A'), humanSeat('B'), humanSeat('C'), humanSeat('D')]);
    const seen: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      seen.push([s.week, s.activeSeat]);
      s = run(s, s.activeSeat, [{ type: 'EndTurn' }]);
    }
    expect(seen).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [3, 0],
    ]);
  });
  it('rejects commands from the wrong seat and after game over', () => {
    const s = newGame('wrong', [humanSeat(), aiSeat()]);
    const r = applyCommand(s, 1, { type: 'EndTurn' }, pack);
    expect(r.state).toBe(s);
    expect(r.events).toEqual([
      expect.objectContaining({ type: 'CommandRejected', code: 'ERR_NOT_YOUR_TURN' }),
    ]);
    const over = patch(s, 0, (_p, st) => {
      st.winner = 1;
      st.phase = 'over';
    });
    expect(applyCommand(over, 0, { type: 'EndTurn' }, pack).events[0]).toMatchObject({
      code: 'ERR_GAME_OVER',
    });
    expect(legalCommands(over, 0, pack)).toEqual([]);
  });
  it('win check happens at the start of the turn, after decay, never mid-turn', () => {
    // Goals of 10 each: wealth 2 < 10 at start. Give cash so wealth ≥ 10 mid-turn; the win must wait for next turn start.
    let s = newGame('win', [humanSeat('W', 10), humanSeat('L', 100)], { chaos: 'off' });
    s = patch(s, 0, (p) => {
      p.cash = 5000;
      p.degrees = ['trade-school'];
      p.job = { jobId: 'burger-joint-cook', wage: 4, raises: 0, hiredWeek: 1 };
      p.dependability = 20;
      p.happiness = 30;
      // Hired this week, so career tenure (ADR-0040) is still 0; the test is about win timing.
      p.goals.career = 0;
    });
    expect(s.winner).toBeNull();
    s = run(s, 0, [{ type: 'EndTurn' }]);
    expect(s.winner).toBeNull();
    const r = applyCommand(s, 1, { type: 'EndTurn' }, pack);
    expect(r.state.winner).toBe(0);
    expect(r.state.phase).toBe('over');
    expect(r.state.week).toBe(2);
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('Won')).toBeGreaterThan(types.indexOf('TurnStarted'));
    expect(types.indexOf('Won')).toBeGreaterThan(types.indexOf('EconomyTicked'));
    expect(applyCommand(r.state, 0, { type: 'Exit' }, pack).events[0]).toMatchObject({
      code: 'ERR_GAME_OVER',
    });
  });
  it('a player who already meets all goals wins at game creation only if the check says so (career 0 blocks)', () => {
    const s = newGame('nowin', [humanSeat('W', 10)]);
    expect(s.winner).toBeNull();
    expect(s.players[0]!.history[0]!.goals[3]).toBe(0);
  });
  it('EndTurn discards unspent hours and runs the weekend event', () => {
    const s = newGame('weekend', [humanSeat(), humanSeat()]);
    const r = applyCommand(s, 0, { type: 'EndTurn' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['HoursSpent', 'EventFired', 'TurnEnded', 'TurnStarted']),
    );
    expect(r.state.players[0]!.turn.eventsFired).toHaveLength(1);
    expect(pack.eventById[r.state.players[0]!.turn.eventsFired[0]!]!.trigger).toBe('weekend');
  });
});

describe('module pipeline (EXTENSIBILITY 12.1)', () => {
  it('classic resolves to the golden module order', () => {
    expect(engineFor(pack).moduleIds).toEqual([
      'core-setup',
      'core-econ',
      'core-pending',
      'core-events',
      'core-decay',
      'core-turn',
      'core-jobs',
      'core-education',
      'core-home',
      'core-food',
      'core-items',
      'core-bank',
      'core-misc',
    ]);
  });
  it('flagged modules are excluded when the pack flag is off; duplicates are rejected', () => {
    const flagged: RuleModule = { id: 'x-transport', order: 100, flag: 'transport' };
    expect(createEngine(pack, [...CORE_MODULES, flagged]).moduleIds).not.toContain('x-transport');
    expect(() => createEngine(pack, [...CORE_MODULES, { id: 'core-setup', order: 99 }])).toThrow(
      /duplicate module/,
    );
    expect(() =>
      createEngine(pack, [
        ...CORE_MODULES,
        { id: 'dup', order: 99, commands: [CORE_MODULES[5]!.commands![0]!] },
      ]),
    ).toThrow(/registered twice/);
  });
  it('M1.5: start-of-turn steps run in exact GDD 4.2 order (spy modules)', () => {
    const calls: string[] = [];
    const spy = (id: string, order: number): RuleModule => ({
      id,
      order,
      hooks: {
        onWeekStart: () => calls.push(`${id}:week`),
        onTurnStart: () => calls.push(`${id}:turn`),
        onTurnEnd: () => calls.push(`${id}:end`),
      },
    });
    const engine = createEngine(pack, [
      ...CORE_MODULES,
      spy('spy-b', 5),
      spy('spy-c', 15),
      spy('spy-d', 25),
      spy('spy-e', 35),
      spy('spy-f', 45),
    ]);
    let s = createGameWithEngine(makeConfig('spy', [humanSeat(), humanSeat()]), pack, engine);
    // Week 1: no econ tick (ADR-0009). Seat 0 opened the week.
    expect(calls).toEqual(['spy-b:turn', 'spy-c:turn', 'spy-d:turn', 'spy-e:turn', 'spy-f:turn']);
    calls.length = 0;
    s = createEngineRun(engine, s, 0);
    expect(calls).toEqual([
      'spy-b:end',
      'spy-c:end',
      'spy-d:end',
      'spy-e:end',
      'spy-f:end',
      'spy-b:turn',
      'spy-c:turn',
      'spy-d:turn',
      'spy-e:turn',
      'spy-f:turn',
    ]);
    calls.length = 0;
    createEngineRun(engine, s, 1);
    // Wrap to week 2: onWeekStart (B) runs before every onTurnStart (C–E).
    expect(calls).toEqual([
      'spy-b:end',
      'spy-c:end',
      'spy-d:end',
      'spy-e:end',
      'spy-f:end',
      'spy-b:week',
      'spy-c:week',
      'spy-d:week',
      'spy-e:week',
      'spy-f:week',
      'spy-b:turn',
      'spy-c:turn',
      'spy-d:turn',
      'spy-e:turn',
      'spy-f:turn',
    ]);
  });
  it('M1.5: event order within a real turn start is econ → pending → events → decay → win', () => {
    let s = newGame('seq', [humanSeat(), humanSeat()]);
    s = patch(s, 0, (p) => {
      p.lotteryTickets = 1;
    });
    s = run(s, 0, [{ type: 'EndTurn' }]);
    const r = applyCommand(s, 1, { type: 'EndTurn' }, pack);
    const types = r.events
      .filter((e) => e.seq >= r.events.find((x) => x.type === 'WeekAdvanced')!.seq)
      .map((e) => e.type);
    const idx = (t: string): number => (types as string[]).indexOf(t);
    expect(idx('TurnStarted')).toBeLessThan(idx('EconomyTicked'));
    expect(idx('EconomyTicked')).toBeLessThan(idx('MarketMoved'));
    expect(idx('MarketMoved')).toBeLessThan(idx('LotteryResolved'));
    const decay = (types as string[]).indexOf('StatChanged', idx('LotteryResolved'));
    expect(decay).toBeGreaterThan(idx('LotteryResolved'));
  });
});

function createEngineRun(
  engine: ReturnType<typeof createEngine>,
  s: ReturnType<typeof newGame>,
  seat: number,
): ReturnType<typeof newGame> {
  const r = applyEngine(engine, s, seat);
  return r;
}

import { applyCommand as applyRaw } from './apply.js';
function applyEngine(
  engine: ReturnType<typeof createEngine>,
  s: ReturnType<typeof newGame>,
  seat: number,
): ReturnType<typeof newGame> {
  return applyRaw(engine, s, seat, { type: 'EndTurn' }).state;
}

describe('SimultaneousScheduler stub (ROADMAP_SCAFFOLDS 16.6)', () => {
  const stub = new SimultaneousScheduler();
  it('refuses every action with ERR_SCHEDULER_STUB and lists all seats as current', () => {
    const s = newGame('stub', [humanSeat(), humanSeat()]);
    expect(stub.canAct()).toBe('ERR_SCHEDULER_STUB');
    expect(stub.current(s)).toEqual([0, 1]);
    expect(() => stub.onEndTurn()).toThrow(/ERR_SCHEDULER_STUB/);
  });
  test.todo('week opens: all seats receive 60h and may submit commands independently');
  test.todo("commands apply immediately to the submitting seat's private view");
  test.todo(
    'contested ApplyJob with finite openings is queued and resolved at week close in fair order',
  );
  test.todo('contested RedeemPawn / pawn purchase resolved at week close; losers refunded hours');
  test.todo('contested MoveHome with finite housing stock resolved at week close');
  test.todo('week closes when all seats end turn');
  test.todo('week closes at the deadline with AI takeover for absent human seats');
  test.todo('after close: economy tick, events, decay, win check for all seats in seat order');
  test.todo('simultaneous winners: highest Σ(stat − target) wins, then lowest seat index');
  test.todo('fair ordering rotates weekly by hash of playerId (no seat bias)');
});
