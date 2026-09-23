/** M5.9: the planner on a pack with every modern system on, and the modern strategy bots. */
import { describe, expect, it } from 'vitest';
import { loadPack } from '@hustle-ring/content';
import { createGame, legalCommands, type GameState } from '@hustle-ring/engine';
import { aiSeat, goInside, makeConfig, patch } from '@hustle-ring/engine/testing';
import { runAiTurn } from './index.js';
import { gadgetAccess, loanBurden, subscriptionDrain, wellbeing } from './scorers.js';

const modern = loadPack('modern-western');
const classicPack = loadPack('classic');

function modernGame(seed: string, goals = 50): GameState {
  const s = createGame(
    makeConfig(
      seed,
      [aiSeat('A', 'normal', 'balanced'), { ...aiSeat('B', 'normal', 'hustler'), color: 'p2' }],
      {
        packId: 'modern-western',
      },
    ),
    modern,
  );
  return patch(
    s,
    0,
    (_p, st) => {
      for (const p of st.players)
        p.goals = { wealth: goals, happiness: goals, education: goals, career: goals };
    },
    modern,
  );
}

describe('M5.9: the AI plays the modern ruleset', () => {
  it('never issues an illegal command over a full modern game', () => {
    let s = modernGame('modern-legal');
    let commands = 0;
    for (let turn = 0; turn < 200 && s.winner === null; turn++) {
      const seat = s.activeSeat;
      const legal = new Set(legalCommands(s, seat, modern).map((c) => JSON.stringify(c)));
      const r = runAiTurn(s, seat, modern, { difficulty: 'normal', personality: 'balanced' });
      expect(r.commands.length).toBeGreaterThan(0);
      // The first command of the turn is checked against the legal set as it stood.
      expect(legal.has(JSON.stringify(r.commands[0]))).toBe(true);
      commands += r.commands.length;
      s = r.state;
    }
    expect(commands).toBeGreaterThan(100);
  }, 60_000);

  it('reaches for the modern systems when they pay', () => {
    const used = new Set<string>();
    for (const seed of ['m1', 'm2', 'm3']) {
      let s = modernGame(`modern-use-${seed}`, 30);
      for (let turn = 0; turn < 120 && s.winner === null; turn++) {
        const r = runAiTurn(s, s.activeSeat, modern, {
          difficulty: 'normal',
          personality: s.activeSeat === 0 ? 'balanced' : 'hustler',
        });
        for (const c of r.commands) used.add(c.type);
        s = r.state;
      }
    }
    // Not every system every game, but the modern surface must not be dead to the planner.
    const modernTypes = [
      'GigSignup',
      'GigShift',
      'Subscribe',
      'BuyTransitPass',
      'BuyCar',
      'TakeLoan',
      'StudyOnline',
      'OrderDelivery',
    ];
    expect(modernTypes.filter((t) => used.has(t)).length).toBeGreaterThan(0);
  }, 60_000);

  it('the modern scorers are inert for a pack without the systems', () => {
    const classicState = createGame(makeConfig('classic-inert'), classicPack);
    const p = classicState.players[0]!;
    const ctx = {
      pack: classicPack,
      seat: 0,
      personality: classicPack.personalityById.balanced!,
      difficulty: 'normal' as const,
    };
    expect(wellbeing.value(ctx, classicState, p)).toBe(0);
    expect(loanBurden.value(ctx, classicState, p)).toBe(0);
    expect(subscriptionDrain.value(ctx, classicState, p)).toBe(0);
  });

  it('wellbeing scores the bands, and debt scores against the wealth goal', () => {
    const s = modernGame('scorers');
    const ctx = {
      pack: modern,
      seat: 0,
      personality: modern.personalityById.balanced!,
      difficulty: 'normal' as const,
    };
    const withValue = (v: number): GameState =>
      patch(s, 0, (p) => ((p.modules.wellbeing as { value: number }).value = v), modern);
    const at = (v: number): number => wellbeing.value(ctx, s, withValue(v).players[0]!);
    expect(at(5)).toBeLessThan(at(20));
    expect(at(20)).toBeLessThan(at(80));
    // ADR-0034: never decreasing, and strictly increasing below the personality's floor, so a rest
    // inside a band is always worth something and a band edge is a slope, not a step the beam
    // cannot see over. Above the floor the score is capped on purpose: wellbeing is not a goal.
    const floor = modern.personalityById.balanced!.preferences.wellbeingFloor;
    for (let v = 0; v < 100; v++) expect(at(v)).toBeLessThanOrEqual(at(v + 1));
    for (let v = 0; v < floor; v++) expect(at(v)).toBeLessThan(at(v + 1));
    const indebted = patch(
      s,
      0,
      (p) => {
        (p.modules.loans as { loans: unknown[] }).loans = [
          {
            principal: 5000,
            balance: 5000,
            weeklyPayment: 120,
            aprBp: 600,
            termWeeks: 52,
            missed: 0,
            collateral: null,
            takenWeek: 1,
            defaulted: false,
          },
        ];
      },
      modern,
    );
    expect(loanBurden.value(ctx, indebted, indebted.players[0]!)).toBeLessThan(0);
    const defaulted = patch(
      s,
      0,
      (p) => {
        const loans = p.modules.loans as { loans: unknown[]; garnished: number };
        loans.loans = [];
        loans.garnished = 5000;
      },
      modern,
    );
    expect(loanBurden.value(ctx, defaulted, defaulted.players[0]!)).toBeLessThan(0);
  });

  describe('gadget access (ADR-0039)', () => {
    const ctx = (pack = modern) => ({
      pack,
      seat: 0,
      personality: pack.personalityById.balanced!,
      difficulty: 'normal' as const,
    });
    const withItem = (itemId: string, condition: 'ok' | 'broken', pack = modern): GameState =>
      patch(
        pack === modern ? modernGame('gadget') : createGame(makeConfig('gadget'), pack),
        0,
        (p) => {
          p.items.push({ uid: itemId, itemId, condition, boughtWeek: 1, boughtAt: 'x' });
        },
        pack,
      );

    it('values a working phone, and a broken one not at all', () => {
      const ok = withItem('smartphone', 'ok');
      const broken = withItem('smartphone', 'broken');
      expect(gadgetAccess.value(ctx(), ok, ok.players[0]!)).toBeGreaterThan(0);
      expect(gadgetAccess.value(ctx(), broken, broken.players[0]!)).toBe(0);
      expect(gadgetAccess.value(ctx(), ok, ok.players[0]!)).toBeLessThanOrEqual(0.3);
    });

    it('is inert on classic, whose durables open no modern system', () => {
      for (const itemId of ['refrigerator', 'computer', 'hot-tub']) {
        const s = withItem(itemId, 'ok', classicPack);
        expect(gadgetAccess.value(ctx(classicPack), s, s.players[0]!)).toBe(0);
      }
    });

    it('repairs a broken phone when standing in a store that fixes it', () => {
      let s = patch(
        modernGame('gadget-repair'),
        0,
        (p) => {
          p.cash = 1_500;
          // Fed, so the week's meal does not come first (KI-008).
          p.food.mealPending = 'burger';
          p.items.push({
            uid: 'ph',
            itemId: 'smartphone',
            condition: 'broken',
            boughtWeek: 1,
            boughtAt: 'electronics-store',
          });
        },
        modern,
      );
      s = goInside(s, 0, 'electronics-store', modern);
      const r = runAiTurn(s, 0, modern, { difficulty: 'normal', personality: 'balanced' });
      expect(r.commands).toContainEqual({ type: 'Repair', itemId: 'smartphone' });
    }, 30_000);
  });
});

describe('strategy bias (ADR-0044)', () => {
  it('a preferred command is played even where the ordinary seat declines it', () => {
    const s = goInside(
      patch(
        modernGame('bias-loan'),
        0,
        (p) => {
          p.cash = 5_000;
          p.food.mealPending = 'burger';
        },
        modern,
      ),
      0,
      'bank',
      modern,
    );
    const max = modern.loans!.studentMax;
    const plain = runAiTurn(s, 0, modern, { difficulty: 'normal', personality: 'hustler' });
    expect(plain.commands.some((c) => c.type === 'TakeLoan')).toBe(false);
    const biased = runAiTurn(s, 0, modern, {
      difficulty: 'normal',
      personality: 'hustler',
      bias: (c) => (c.type === 'TakeLoan' && c.principal === max ? 1 : 0),
    });
    expect(biased.commands).toContainEqual(
      expect.objectContaining({ type: 'TakeLoan', principal: max }),
    );
  }, 30_000);
});
