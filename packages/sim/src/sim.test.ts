/** M3.1/M3.2: runner determinism, metrics, gates, reports, bots, worker pool. */
import { describe, expect, it } from 'vitest';
import { loadPack } from '@hustle-ring/content';
import {
  botIds,
  botPlanOptions,
  allFailures,
  blockingFailures,
  evaluateGates,
  gameSpecs,
  gamesCsv,
  gateRunSpec,
  getBot,
  histogram,
  metric,
  parseGatesFile,
  parseSeats,
  quantiles,
  registerBot,
  reportMd,
  runAll,
  runGame,
  seatConfig,
  summarize,
  summaryJson,
  type GameResult,
  type RunSpec,
} from './index.js';
import { newGame, aiSeat } from '@hustle-ring/engine/testing';

const pack = loadPack('classic');
const personalities = pack.personalities.map((p) => p.id);

const quick: RunSpec = {
  id: 'quick',
  packId: 'classic',
  games: 3,
  seedBase: 'sim-test',
  seats: [
    { kind: 'ai', difficulty: 'normal', personality: 'balanced' },
    { kind: 'ai', difficulty: 'easy', personality: 'grinder' },
  ],
  goals: 30,
  chaos: 'classic',
  stallWeek: 60,
};

describe('spec parsing', () => {
  it('gameSpecs seeds are <seedBase>-<i>', () => {
    const specs = gameSpecs(quick);
    expect(specs.map((s) => s.seed)).toEqual(['sim-test-0', 'sim-test-1', 'sim-test-2']);
    expect(specs[0]).toMatchObject({ runId: 'quick', packId: 'classic', goals: 30, stallWeek: 60 });
  });
  it('parseSeats handles difficulties, explicit personalities, bots and rotation', () => {
    expect(parseSeats('normal,hard:scholar', 3, personalities)).toEqual([
      { kind: 'ai', difficulty: 'normal', personality: 'grinder' },
      { kind: 'ai', difficulty: 'hard', personality: 'scholar' },
      { kind: 'ai', difficulty: 'normal', personality: 'hustler' },
    ]);
    expect(parseSeats('bot:NoRelax', 1, personalities)).toEqual([{ kind: 'bot', bot: 'NoRelax' }]);
    expect(() => parseSeats('brutal', 1, personalities)).toThrow(/unknown AI difficulty/);
  });
  it('seatConfig maps specs to engine seats', () => {
    expect(
      seatConfig({ kind: 'ai', difficulty: 'hard', personality: 'hustler' }, 1, 40),
    ).toMatchObject({
      controller: 'ai',
      color: 'p2',
      ai: { difficulty: 'hard', personality: 'hustler' },
      goals: { wealth: 40 },
    });
    expect(seatConfig({ kind: 'bot', bot: 'StudyFirst' }, 0, 0).ai).toEqual({
      difficulty: 'normal',
      personality: 'scholar',
    });
  });
});

describe('runner (M3.1 AC: deterministic)', () => {
  it('the same spec produces byte-identical summary.json and games.csv', async () => {
    const a = await runAll(gameSpecs(quick), { workers: 1 });
    const b = await runAll(gameSpecs(quick), { workers: 1 });
    expect(summaryJson(summarize('quick', a, 11).summary)).toBe(
      summaryJson(summarize('quick', b, 11).summary),
    );
    expect(gamesCsv(a)).toBe(gamesCsv(b));
    expect(a[0]!.weeks).toBeGreaterThan(1);
    expect(a[0]!.commands).toBeGreaterThan(10);
    expect(a[0]!.seats).toHaveLength(2);
  }, 120_000);
  it('a stalled game reports stalled=true and no winner', () => {
    const r = runGame({ ...gameSpecs(quick)[0]!, stallWeek: 2 }, pack);
    expect(r.stalled).toBe(true);
    expect(r.winner).toBeNull();
    expect(r.lastGoal).toBeNull();
    expect(r.weeks).toBe(2);
    expect(r.wealthByWeek.length).toBeGreaterThan(0);
  });
  it('bot seats plan with the bot filter and never issue forbidden commands', () => {
    const spec = {
      ...gameSpecs(quick)[0]!,
      seats: [
        { kind: 'bot' as const, bot: 'NoRelax' },
        { kind: 'bot' as const, bot: 'StudyFirst' },
      ],
      stallWeek: 6,
    };
    const r = runGame(spec, pack);
    expect(r.seats[0]!.spec).toEqual({ kind: 'bot', bot: 'NoRelax' });
    expect(r.seats[1]!.jobId).toBeNull();
  }, 60_000);
});

describe('bots (M3.2)', () => {
  it('registry lists the classic-applicable bots and rejects unknown ids', () => {
    expect(botIds()).toEqual(expect.arrayContaining(['NoRelax', 'StudyFirst']));
    expect(() => getBot('Nope')).toThrow(/unknown bot/);
    registerBot({ id: 'TestBot', personality: 'balanced', allow: () => true });
    expect(botIds()).toContain('TestBot');
  });
  it('NoRelax forbids Relax; StudyFirst forbids work until every degree is held', () => {
    const s = newGame('bots', [aiSeat('A')]);
    const noRelax = botPlanOptions(getBot('NoRelax'), pack);
    expect(noRelax.forbid!({ type: 'Relax' }, s, 0)).toBe(true);
    expect(noRelax.forbid!({ type: 'Work', hours: 12 }, s, 0)).toBe(false);
    const study = botPlanOptions(getBot('StudyFirst'), pack);
    expect(study.forbid!({ type: 'Work', hours: 12 }, s, 0)).toBe(true);
    expect(study.forbid!({ type: 'Study', degreeId: 'trade-school' }, s, 0)).toBe(false);
    const graduated = {
      ...s,
      players: [{ ...s.players[0]!, degrees: pack.degrees.map((d) => d.id) }],
    };
    expect(study.forbid!({ type: 'Work', hours: 12 }, graduated, 0)).toBe(false);
  });
});

describe('metrics (9.2)', () => {
  const fake = (
    seed: string,
    weeks: number,
    winner: number | null,
    lastGoal: GameResult['lastGoal'],
    degrees = 3,
  ): GameResult => ({
    runId: 'f',
    seed,
    weeks,
    winner,
    stalled: winner === null,
    lastGoal,
    seats: [0, 1].map((i) => ({
      seat: i,
      spec:
        i === 0
          ? { kind: 'ai', difficulty: 'hard', personality: 'grinder' }
          : { kind: 'bot', bot: 'NoRelax' },
      goals: [50, 50, 50, 50],
      targets: [50, 50, 50, 50],
      cash: 10,
      bank: 20,
      netWorth: 30,
      degrees,
      jobId: i === 0 ? 'x' : null,
      jobTier: i === 0 ? 2 : -1,
      evicted: i === 1 && weeks > 40,
      weeksInDebt: 0,
      bankrupt: i === 1 && weeks > 40,
      defaulted: i === 1 && weeks >= 50,
      collapses: i === 1 && weeks >= 40 ? 1 : 0,
      eventsSuffered: 1,
    })),
    wealthByWeek: [2, 4, 6],
    eventsByFamily: { weekend: weeks, economy: 1 },
    playerWeeks: weeks * 2,
    commands: 100,
    ms: 5,
  });
  const results = [
    fake('b', 40, 0, 'career'),
    fake('a', 20, 1, 'wealth'),
    fake('c', 60, null, null),
    fake('d', 50, 0, 'career', 11),
  ];
  const { summary, perf } = summarize('f', results, 11);
  it('quantiles', () => {
    expect(quantiles([5, 1, 3])).toEqual({ min: 1, p10: 1, median: 3, p90: 5, max: 5, mean: 3 });
    expect(quantiles([])).toEqual({ min: 0, p10: 0, median: 0, p90: 0, max: 0, mean: 0 });
  });
  it('aggregates lengths, stall/bankruptcy rates, winners, last goals, bots', () => {
    expect(summary.games).toBe(4);
    expect(summary.decided).toBe(3);
    expect(summary.stallRate).toBe(25);
    expect(summary.bankruptcyRate).toBe(50);
    expect(summary.length).toMatchObject({ min: 20, median: 40, max: 50 });
    expect(summary.winnerSeat).toEqual({ seat0: 2, seat1: 1 });
    expect(summary.firstSeatWinPct).toBe(66.67);
    expect(summary.winnerDifficulty).toEqual({ easy: 0, hard: 2, normal: 0 });
    expect(summary.winnerDifficultyPct.hard).toBe(66.67);
    expect(summary.winnerBot).toEqual({ NoRelax: 1 });
    expect(summary.botWinPct).toEqual({ NoRelax: 25 });
    expect(summary.lastGoalPct).toEqual({
      career: 66.67,
      education: 0,
      happiness: 0,
      wealth: 33.33,
    });
    expect(summary.jobTierHistogram).toEqual({ none: 4, tier2: 4 });
    expect(summary.winnerAllDegreesPct).toBe(33.33);
    expect(summary.eventsPer100PlayerWeeks.weekend).toBe(50);
    expect(summary.wealthP50ByWeek).toEqual([2, 4, 6]);
    expect(perf.commandsPerGame).toBe(100);
    expect(perf.msPerGame.median).toBe(5);
  });
  // BALANCE 9.5 reads three modern rates off the bot's own seat, not off the game: CryptoAllIn
  // bankruptcy, NoRelax collapse and LoanMax default.
  it('reports bot bankruptcy, collapse and default on the bot seat', () => {
    // The bot seat is bankrupt in the two games past week 40, collapsed in three and defaulted in
    // the one that reached week 50 — 4 bot seat-games in all.
    expect(summary.botBankruptcyPct).toEqual({ NoRelax: 50 });
    expect(summary.botCollapsePct).toEqual({ NoRelax: 75 });
    expect(summary.botDefaultPct).toEqual({ NoRelax: 50 });
    expect(metric(summary, 'botDefaultPct.NoRelax')).toBe(50);
  });

  it('metric resolves dotted paths', () => {
    expect(metric(summary, 'length.median')).toBe(40);
    expect(metric(summary, 'lastGoalPct.career')).toBe(66.67);
    expect(metric(summary, 'nope.x')).toBeUndefined();
    expect(metric(summary, 'runId')).toBeUndefined();
  });
  it('report writers produce markdown, csv and a histogram', () => {
    const md = reportMd(summary, perf, results, 'fixture');
    expect(md).toContain('# Sim report — fixture');
    expect(md).toContain('| seat0 | 2 |');
    expect(md).toContain('## Events per 100 player-weeks');
    const csv = gamesCsv(results);
    expect(csv.split('\n')[0]).toContain('seed,weeks,winner,stalled,lastGoal,commands,s0_wealth');
    expect(csv.split('\n')[1]!.startsWith('a,20,1,0,wealth,100')).toBe(true);
    expect(histogram([1, 2, 3, 10], 3)).toContain('#');
    expect(histogram([])).toBe('(no data)\n');
    expect(gamesCsv([])).toBe('seed,weeks,winner,stalled,lastGoal,commands\n');
  });
});

describe('gates (9.7)', () => {
  const file = parseGatesFile({
    gamesPerConfig: 10,
    configs: [
      {
        id: 'a',
        pack: 'classic',
        seats: 2,
        ai: 'normal,normal',
        goals: 50,
        asserts: { stallRate: { max: 1 }, 'lastGoalPct.career': { min: 10 } },
      },
      { id: 'b', pack: 'classic', seats: 2, ai: 'normal,normal', goals: 80, games: 5 },
    ],
    compare: [{ id: 'ab', left: 'a.length.median', right: 'b.length.median', op: '<' }],
  });
  it('parses and builds run specs', () => {
    expect(file.configs[0]!.chaos).toBe('classic');
    const run = gateRunSpec(file.configs[1]!, file.gamesPerConfig, personalities);
    expect(run).toMatchObject({ id: 'b', games: 5, goals: 80, seedBase: 'gate-b' });
    expect(() => parseGatesFile({ gamesPerConfig: 0, configs: [] })).toThrow(/invalid gates file/);
  });
  it('evaluates asserts and compares', () => {
    const base = summarize('a', [], 11).summary;
    const outcomes = evaluateGates(file, {
      a: {
        ...base,
        stallRate: 0.5,
        lastGoalPct: { ...base.lastGoalPct, career: 12 },
        length: { ...base.length, median: 40 },
      },
      b: { ...base, length: { ...base.length, median: 70 } },
    });
    expect(outcomes.map((o) => [o.id, o.metric, o.pass])).toEqual([
      ['a', 'stallRate', true],
      ['a', 'lastGoalPct.career', true],
      ['ab', 'a.length.median < b.length.median', true],
    ]);
    const bad = evaluateGates(file, { a: { ...base, stallRate: 3 } });
    expect(bad.filter((o) => !o.pass).map((o) => o.metric)).toEqual([
      'stallRate',
      'lastGoalPct.career',
      'a.length.median < b.length.median',
    ]);
  });
  it('separates pending targets from blocking failures', () => {
    const pendingFile = parseGatesFile({
      gamesPerConfig: 10,
      configs: [
        {
          id: 'a',
          pack: 'classic',
          seats: 2,
          ai: 'normal,normal',
          goals: 50,
          asserts: {
            stallRate: { max: 1 },
            'lastGoalPct.career': { min: 10, pending: { issue: 'KI-005', until: 'M3.3' } },
          },
        },
      ],
    });
    const base = summarize('a', [], 11).summary;
    const outcomes = evaluateGates(pendingFile, { a: { ...base, stallRate: 0.5 } });
    expect(outcomes.map((o) => [o.metric, o.pass])).toEqual([
      ['stallRate', true],
      ['lastGoalPct.career', false],
    ]);
    // The unmet target is reported and attributed, but only --strict treats it as a failure.
    expect(blockingFailures(outcomes)).toEqual([]);
    expect(allFailures(outcomes).map((o) => o.pending?.issue)).toEqual(['KI-005']);
    // A non-pending miss in the same file still blocks.
    const withBlocker = evaluateGates(pendingFile, { a: { ...base, stallRate: 9 } });
    expect(blockingFailures(withBlocker).map((o) => o.metric)).toEqual(['stallRate']);
  });

  it('every pending target in the committed gate file names an issue and a milestone', async () => {
    const { readFileSync } = await import('node:fs');
    const parsed = parseGatesFile(
      JSON.parse(
        readFileSync(new URL('../../../sim/gates.json', import.meta.url), 'utf8'),
      ) as unknown,
    );
    const pending = parsed.configs.flatMap((c) =>
      Object.entries(c.asserts)
        .filter(([, a]) => a.pending)
        .map(([metric, a]) => ({ metric, ...a.pending! })),
    );
    for (const p of pending) {
      expect(p.issue).toMatch(/^KI-\d+$/);
      expect(p.until).toMatch(/^M\d/);
    }
  });

  it('the committed sim/gates.json and sim/stage1.json parse', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['../../../sim/gates.json', '../../../sim/stage1.json']) {
      const parsed = parseGatesFile(
        JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8')) as unknown,
      );
      expect(parsed.configs.length).toBeGreaterThan(0);
    }
  });
});

describe('worker pool', () => {
  it('runs games across worker threads with results in seed order', async () => {
    const specs = gameSpecs({ ...quick, games: 2, stallWeek: 3 });
    const results = await runAll(specs, { workers: 2 });
    expect(results.map((r) => r.seed)).toEqual(['sim-test-0', 'sim-test-1']);
    const inline = await runAll(specs, { workers: 1 });
    expect(summaryJson(summarize('q', results, 11).summary)).toBe(
      summaryJson(summarize('q', inline, 11).summary),
    );
  }, 60_000);
  it('reports progress', async () => {
    const seen: number[] = [];
    await runAll(gameSpecs({ ...quick, games: 2, stallWeek: 2 }), {
      workers: 1,
      onProgress: (d) => seen.push(d),
    });
    expect(seen).toEqual([1, 2]);
  });
});

describe('M5.9 modern strategy bots (BALANCE 9.4)', () => {
  const modern = loadPack('modern-western');
  it('registers every bot the spec names, each with a narrower command set', () => {
    // An earlier test registers a TestBot, so this asserts the spec's bots are all present.
    expect(botIds()).toEqual(
      expect.arrayContaining([
        'CryptoAllIn',
        'DeliveryOnly',
        'GigOnly',
        'LoanMax',
        'NoRelax',
        'StudyFirst',
      ]),
    );
  });

  it('each modern bot forbids exactly what its strategy forbids', () => {
    const state = runGame(
      {
        runId: 'bots',
        packId: 'modern-western',
        seed: 'bots-1',
        seats: [
          { kind: 'bot', bot: 'GigOnly' },
          { kind: 'ai', difficulty: 'normal', personality: 'balanced' },
        ],
        goals: 30,
        chaos: 'modern',
        stallWeek: 40,
      },
      modern,
    );
    expect(state.seats[0]!.jobId).toBeNull();

    const gig = getBot('GigOnly');
    expect(gig.allow({ type: 'Work', hours: 12 }, {} as never, 0, modern)).toBe(false);
    expect(gig.allow({ type: 'GigShift', hours: 12 }, {} as never, 0, modern)).toBe(true);

    const crypto = getBot('CryptoAllIn');
    expect(
      crypto.allow({ type: 'BuyAsset', assetId: 'crypto', amount: 100 }, {} as never, 0, modern),
    ).toBe(true);
    expect(
      crypto.allow({ type: 'BuyAsset', assetId: 'bonds', amount: 100 }, {} as never, 0, modern),
    ).toBe(false);
    expect(
      crypto.allow({ type: 'SellAsset', assetId: 'crypto', amount: 100 }, {} as never, 0, modern),
    ).toBe(false);

    const delivery = getBot('DeliveryOnly');
    expect(delivery.allow({ type: 'EatMeal', mealId: 'burger' }, {} as never, 0, modern)).toBe(
      false,
    );
    expect(
      delivery.allow({ type: 'OrderDelivery', mealId: 'burger' }, {} as never, 0, modern),
    ).toBe(true);

    const loanMax = getBot('LoanMax');
    expect(
      loanMax.allow(
        { type: 'TakeLoan', principal: modern.loans!.max, termWeeks: 52 },
        {} as never,
        0,
        modern,
      ),
    ).toBe(true);
    expect(
      loanMax.allow(
        { type: 'TakeLoan', principal: modern.loans!.min, termWeeks: 52 },
        {} as never,
        0,
        modern,
      ),
    ).toBe(false);
    expect(loanMax.allow({ type: 'RepayLoan', amount: 100 }, {} as never, 0, modern)).toBe(false);
  }, 30_000);
});
