/** Public API surface + extension seams (hook setters, registries) — keeps every exported function exercised. */
import { describe, expect, it } from 'vitest';
import {
  activeModuleIds,
  allModules,
  commandSchema,
  commandTypes,
  COMMAND_TYPES,
  Ctx,
  endTurnImpl,
  engineFor,
  lessonWasteBp,
  modeGate,
  modeMoney,
  onStarve,
  payModifierBp,
  previewCommand,
  registerModules,
  relaxExtra,
  setAssetStepper,
  setEndTurnImpl,
  setLessonWaste,
  setModeHooks,
  setOnStarve,
  setPayModifier,
  setRelaxExtra,
  stepAsset,
  validate,
  type RuleModule,
} from './index.js';
import { classic, goInside, newGame, patch } from './testing.js';

const pack = classic();

describe('engine public API', () => {
  it('validate returns ok + preview for legal commands and a code otherwise', () => {
    const s = newGame('api');
    const ok = validate(s, 0, { type: 'Move', to: 'bank', mode: 'walk' }, pack);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.preview.hours).toBe(-8);
    const bad = validate(s, 1, { type: 'EndTurn' }, pack);
    expect(bad).toEqual({ ok: false, code: 'ERR_NOT_YOUR_TURN' });
    expect(validate(s, 0, { type: 'Nope' } as never, pack)).toEqual({
      ok: false,
      code: 'ERR_UNKNOWN_ID',
    });
  });
  it('command registry exposes a discriminated union and sorted type list matching gen:types output', () => {
    const engine = engineFor(pack);
    expect(commandTypes(engine)).toEqual([...COMMAND_TYPES].sort());
    const schema = commandSchema(engine);
    expect(schema.safeParse({ type: 'Work', hours: 12 }).success).toBe(true);
    expect(schema.safeParse({ type: 'Work', hours: 'lots' }).success).toBe(false);
    expect(schema.safeParse({ type: 'Teleport' }).success).toBe(false);
    expect(activeModuleIds(engine, newGame('api'))).toEqual(engine.moduleIds);
  });
  it('registerModules adds modern modules once; allModules lists core first', () => {
    const before = allModules().length;
    const mod: RuleModule = { id: 'test-extra', order: 150, flag: 'online' };
    registerModules(mod, mod);
    expect(allModules().length).toBe(before + 1);
    expect(allModules()[0]!.id).toBe('core-setup');
    // Flag 'online' is off in classic, so the engine ignores it.
    expect(engineFor(pack).moduleIds).not.toContain('test-extra');
  });
  it('previews: Move/Exit/Work/SellAsset/BuyAsset/ReadNews/Relax carry hours, money, risk and notes', () => {
    const s = goInside(newGame('prev'), 0, 'bank');
    expect(previewCommand(s, 0, { type: 'Exit' }, pack).riskKey).toBe('risk.theft');
    expect(
      previewCommand(s, 0, { type: 'BuyAsset', assetId: 'gold', amount: 100 }, pack).notes,
    ).toEqual(['fee:1']);
    expect(previewCommand(s, 0, { type: 'Move', to: 'park', mode: 'walk' }, pack).notes).toEqual([
      'steps:5',
    ]);
    expect(previewCommand(s, 0, { type: 'Nope' } as never, pack)).toEqual({
      hours: 0,
      money: 0,
      deltas: {},
      notes: [],
    });
    expect(previewCommand(s, 0, { type: 'Work', hours: 'x' } as never, pack).hours).toBe(0);
    const employed = patch(
      goInside(newGame('prev2'), 0, 'burger-joint'),
      0,
      (p) => (p.job = { jobId: 'burger-joint-cook', wage: 5, raises: 0, hiredWeek: 1 }),
    );
    expect(previewCommand(employed, 0, { type: 'Work', hours: 12 }, pack)).toMatchObject({
      hours: -12,
      money: 40,
    });
    expect(previewCommand(employed, 0, { type: 'AskRaise' }, pack).deltas).toEqual({
      happiness: 3,
    });
    expect(previewCommand(employed, 0, { type: 'EatMeal', mealId: 'burger' }, pack).notes).toEqual([
      'meal.counts',
    ]);
    expect(previewCommand(employed, 0, { type: 'EatMeal', mealId: 'nope' }, pack).deltas).toEqual(
      {},
    );
    expect(previewCommand(employed, 0, { type: 'MoveHome', tier: 'high' }, pack).deltas).toEqual({
      happiness: 5,
    });
    expect(previewCommand(employed, 0, { type: 'MoveHome', tier: 'low' }, pack).deltas).toEqual({});
    expect(
      previewCommand(employed, 0, { type: 'BuyItem', itemId: 'soft-drink', qty: 1 }, pack).deltas,
    ).toEqual({ happiness: 1 });
    expect(
      previewCommand(employed, 0, { type: 'BuyItem', itemId: 'newspaper', qty: 1 }, pack).deltas,
    ).toEqual({});
    expect(
      previewCommand(employed, 0, { type: 'SellItem', itemId: 'television' }, pack).money,
    ).toBe(0);
    expect(
      previewCommand(employed, 0, { type: 'RedeemPawn', itemId: 'television' }, pack).money,
    ).toBe(0);
    expect(
      previewCommand(employed, 0, { type: 'Study', degreeId: 'trade-school' }, pack).notes,
    ).toEqual(['lessonsLeft:0']);
    expect(previewCommand(employed, 0, { type: 'Enroll', degreeId: 'nope' }, pack).notes).toEqual([
      'lessons:0',
    ]);
    expect(previewCommand(employed, 0, { type: 'ReadNews' }, pack).money).toBe(-1);
    expect(
      previewCommand(employed, 0, { type: 'SellAsset', assetId: 'gold', amount: 5 }, pack).money,
    ).toBe(0);
  });
  it('Ctx helpers: hasItem, econ scaling, uid, listeners', () => {
    const s = patch(newGame('ctx'), 0, (p) =>
      p.items.push({
        uid: 'b',
        itemId: 'stereo',
        condition: 'broken',
        boughtWeek: 1,
        boughtAt: 'x',
      }),
    );
    const ctx = new Ctx(s, pack, 0);
    expect(ctx.hasItem(0, 'stereo')).toBe(false);
    expect(ctx.hasItem(0, 'stereo', false)).toBe(true);
    expect(ctx.econ(100)).toBe(100);
    expect(ctx.uid()).toBe('u0');
    expect(ctx.uid()).toBe('u1');
    expect(() => ctx.playerAt(7)).toThrow(/no player/);
    const seen: string[] = [];
    ctx.setListeners([(_c, e) => seen.push(e.type)]);
    ctx.addMoney(0, 'cash', 1, 'x');
    ctx.addMoney(0, 'cash', 0, 'x');
    expect(seen).toEqual(['MoneyChanged']);
    ctx.spendHours(0, 0, 'x');
    ctx.addStat(0, 'wellbeing', 5, 'x');
    ctx.addStat(0, 'happiness', 0, 'x');
    expect(seen).toEqual(['MoneyChanged']);
  });
});

describe('extension seams (modern modules install hooks here)', () => {
  it('setters replace and restore module hooks', () => {
    const s = goInside(newGame('seams'), 0, 'burger-joint');
    const ctx = new Ctx(s, pack, 0);
    const prevGate = modeGate;
    const prevMoney = modeMoney;
    setModeHooks(
      (_c, mode) => (mode === 'jet' ? null : 'ERR_UNKNOWN_ID'),
      () => 9,
    );
    expect(modeGate(ctx, 'jet')).toBeNull();
    expect(modeMoney(ctx, 'jet', 3)).toBe(9);
    setModeHooks(prevGate, prevMoney);
    expect(modeGate(ctx, 'walk')).toBeNull();
    expect(modeGate(ctx, 'jet')).toBe('ERR_UNKNOWN_ID');
    expect(modeMoney(ctx, 'walk', 3)).toBe(0);

    const prevPay = payModifierBp;
    setPayModifier(() => 5000);
    expect(payModifierBp(ctx, 0)).toBe(5000);
    setPayModifier(prevPay);
    expect(payModifierBp(ctx, 0)).toBe(10_000);

    const prevWaste = lessonWasteBp;
    setLessonWaste(() => 1500);
    expect(lessonWasteBp(ctx, 0, true)).toBe(1500);
    setLessonWaste(prevWaste);
    expect(lessonWasteBp(ctx, 0, false)).toBe(0);

    const prevRelax = relaxExtra;
    let called = false;
    setRelaxExtra(() => {
      called = true;
    });
    relaxExtra(ctx, 0, true);
    expect(called).toBe(true);
    setRelaxExtra(prevRelax);
    expect(relaxExtra(ctx, 0, true)).toBeUndefined();

    const prevStarve = onStarve;
    setOnStarve(() => {
      called = false;
    });
    onStarve(ctx, 0);
    expect(called).toBe(false);
    setOnStarve(prevStarve);
    expect(onStarve(ctx, 0)).toBeUndefined();

    const prevStep = stepAsset;
    setAssetStepper(() => 4242);
    expect(stepAsset(ctx, pack.assets[0]!, 1)).toBe(4242);
    setAssetStepper(prevStep);
    expect(stepAsset(ctx, { ...pack.assets[0]!, model: 'drift' }, 777)).toBe(777);

    const prevEnd = endTurnImpl;
    setEndTurnImpl(() => {
      throw new Error('custom');
    });
    expect(() => endTurnImpl(ctx)).toThrow(/custom/);
    setEndTurnImpl(prevEnd);
  });
});
