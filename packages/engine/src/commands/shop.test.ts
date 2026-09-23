/** M1.7: BuyFood, EatMeal, BuyItem, SellItem, RedeemPawn, Repair, Deposit, Withdraw, BuyAsset, SellAsset, BuyLottery, ReadNews. */
import { describe, expect, it } from 'vitest';
import { applyCommand, itemValue, legalCommands, previewCommand, Ctx } from '../index.js';
import { classic, goInside, humanSeat, newGame, patch, run } from '../testing.js';

const pack = classic();
const at = (seed: string, loc: string, cash = 200) =>
  patch(
    goInside(newGame(seed, [humanSeat(), humanSeat()], { chaos: 'off' }), 0, loc),
    0,
    (p) => (p.cash = cash),
  );

describe('BuyFood / EatMeal (GDD 4.11)', () => {
  it('without a fridge only 1 unit may be carried; with a fridge up to 6, freezer 12', () => {
    const g = at('food', 'grocery', 500);
    expect(applyCommand(g, 0, { type: 'BuyFood', units: 2 }, pack).events[0]).toMatchObject({
      code: 'ERR_NO_FRIDGE',
    });
    const one = applyCommand(g, 0, { type: 'BuyFood', units: 1 }, pack);
    expect(one.state.players[0]!.food.unrefrigeratedUnits).toBe(1);
    expect(one.state.players[0]!.cash).toBe(485);
    expect(applyCommand(one.state, 0, { type: 'BuyFood', units: 1 }, pack).events[0]).toMatchObject(
      { code: 'ERR_NO_FRIDGE' },
    );
    const fridge = patch(g, 0, (p) =>
      p.items.push({
        uid: 'f',
        itemId: 'refrigerator',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      }),
    );
    const four = run(fridge, 0, [{ type: 'BuyFood', units: 4 }]);
    expect(four.players[0]!.food.fridgeUnits).toBe(4);
    expect(applyCommand(four, 0, { type: 'BuyFood', units: 4 }, pack).events[0]).toMatchObject({
      code: 'ERR_FRIDGE_FULL',
    });
    expect(applyCommand(four, 0, { type: 'BuyFood', units: 3 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    const freezer = patch(four, 0, (p) =>
      p.items.push({
        uid: 'z',
        itemId: 'freezer',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'appliance-depot',
      }),
    );
    expect(
      run(freezer, 0, [
        { type: 'BuyFood', units: 4 },
        { type: 'BuyFood', units: 4 },
      ]).players[0]!.food.fridgeUnits,
    ).toBe(12);
    expect(
      applyCommand(
        patch(g, 0, (p) => (p.cash = 5)),
        0,
        { type: 'BuyFood', units: 1 },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(
      applyCommand(at('food', 'bank'), 0, { type: 'BuyFood', units: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
  });
  it('meals set the pending meal (fries do not) and cost price × econ', () => {
    const b = at('meal', 'burger-joint');
    const r = applyCommand(b, 0, { type: 'EatMeal', mealId: 'burger' }, pack);
    expect(r.state.players[0]!.food.mealPending).toBe('burger');
    expect(r.state.players[0]!.cash).toBe(192);
    const fries = applyCommand(b, 0, { type: 'EatMeal', mealId: 'fries' }, pack);
    expect(fries.state.players[0]!.food.mealPending).toBeNull();
    expect(fries.state.players[0]!.happiness).toBe(11);
    expect(previewCommand(b, 0, { type: 'EatMeal', mealId: 'fries' }, pack).notes).toEqual([
      'meal.snack',
    ]);
    expect(applyCommand(b, 0, { type: 'EatMeal', mealId: 'caviar' }, pack).events[0]).toMatchObject(
      { code: 'ERR_UNKNOWN_ID' },
    );
    expect(
      applyCommand(at('meal', 'bank'), 0, { type: 'EatMeal', mealId: 'burger' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    expect(
      applyCommand(
        patch(b, 0, (p) => (p.cash = 1)),
        0,
        { type: 'EatMeal', mealId: 'burger' },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
  });
  it('edge: fridge food is eaten first next turn, then the pending meal, else starvation −20h −5 happiness', () => {
    let s = at('starve', 'burger-joint');
    s = run(s, 0, [{ type: 'EatMeal', mealId: 'burger' }, { type: 'EndTurn' }]);
    s = run(s, 1, [{ type: 'EndTurn' }]);
    expect(s.players[0]!.food.mealPending).toBeNull();
    expect(s.players[0]!.hoursLeft).toBe(120);
    s = run(s, 0, [{ type: 'EndTurn' }]);
    s = run(s, 1, [{ type: 'EndTurn' }]);
    expect(s.players[0]!.hoursLeft).toBe(80);
    expect(s.week).toBe(3);
  });
});

describe('BuyItem (SEED_DATA 14.2)', () => {
  it('buys a durable once, applies happinessOnBuy, records store; discount store price ×0.7 within rotation', () => {
    const e = at('item', 'electronics-store', 2000);
    const r = applyCommand(e, 0, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack);
    expect(r.events.map((x) => x.type)).toEqual(['MoneyChanged', 'StatChanged', 'ItemBought']);
    expect(r.state.players[0]!.cash).toBe(1600);
    expect(r.state.players[0]!.happiness).toBe(14);
    expect(r.state.players[0]!.items[0]).toMatchObject({
      itemId: 'television',
      condition: 'ok',
      boughtAt: 'electronics-store',
    });
    expect(
      applyCommand(r.state, 0, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    expect(
      applyCommand(e, 0, { type: 'BuyItem', itemId: 'television', qty: 2 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    const d = patch(
      at('item', 'discount-store', 2000),
      0,
      (p) => (p.turn.shopRotation = ['television']),
    );
    expect(
      applyCommand(d, 0, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack).state.players[0]!
        .cash,
    ).toBe(2000 - 280);
    expect(
      applyCommand(d, 0, { type: 'BuyItem', itemId: 'stereo', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_FOR_SALE' });
  });
  it('rejects unknown items, items not sold here, no cash, outside', () => {
    const e = at('item2', 'electronics-store', 10);
    expect(
      applyCommand(e, 0, { type: 'BuyItem', itemId: 'unicorn', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    expect(
      applyCommand(e, 0, { type: 'BuyItem', itemId: 'refrigerator', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_FOR_SALE' });
    expect(
      applyCommand(e, 0, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(
      applyCommand(
        patch(e, 0, (p) => (p.inside = false)),
        0,
        { type: 'BuyItem', itemId: 'television', qty: 1 },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_INSIDE' });
  });
  it('consumables: tickets/junk apply happiness immediately, tickets and soft drink only first per turn, newspaper gives the news hint; clothing adds an outfit', () => {
    const d = patch(
      at('cons', 'discount-store', 500),
      0,
      (p) => (p.turn.shopRotation = ['concert-ticket', 'bad-novel']),
    );
    const r = run(d, 0, [
      { type: 'BuyItem', itemId: 'concert-ticket', qty: 1 },
      { type: 'BuyItem', itemId: 'bad-novel', qty: 2 },
    ]);
    expect(r.players[0]!.happiness).toBe(10 + 3 - 4);
    expect(r.players[0]!.items).toEqual([]);
    // A ticket pays its happiness once per turn (ADR-0025), so a second one is 45 dollars of nothing.
    const again = run(r, 0, [{ type: 'BuyItem', itemId: 'concert-ticket', qty: 2 }]);
    expect(again.players[0]!.happiness).toBe(10 + 3 - 4);
    expect(again.players[0]!.cash).toBe(500 - 45 - 24 - 90);
    const g = at('cons2', 'grocery', 500);
    const drinks = run(g, 0, [
      { type: 'BuyItem', itemId: 'soft-drink', qty: 3 },
      { type: 'BuyItem', itemId: 'newspaper', qty: 1 },
    ]);
    expect(drinks.players[0]!.happiness).toBe(11);
    expect(drinks.players[0]!.newsHintWeek).toBe(1);
    expect(
      applyCommand(g, 0, { type: 'BuyItem', itemId: 'soft-drink', qty: 11 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    const c = at('cloth', 'clothing-boutique', 500);
    const dressed = run(c, 0, [{ type: 'BuyItem', itemId: 'dress', qty: 1 }]);
    expect(dressed.players[0]!.clothing).toEqual([
      { tier: 'casual', weeksLeft: 4 },
      { tier: 'dress', weeksLeft: 10 },
    ]);
    expect(
      applyCommand(c, 0, { type: 'BuyItem', itemId: 'dress', qty: 2 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    expect(legalCommands(c, 0, pack).filter((x) => x.type === 'BuyItem')).toHaveLength(3);
  });
});

describe('SellItem / RedeemPawn / pawn purchases (SEED_DATA 14.5)', () => {
  const owning = (seed: string, week = 5) =>
    patch(
      goInside(
        patch(newGame(seed, [humanSeat(), humanSeat()]), 0, (_p, st) => (st.week = week)),
        0,
        'pawn-shop',
      ),
      0,
      (p) => {
        p.items.push({
          uid: 'tv',
          itemId: 'television',
          condition: 'ok',
          boughtWeek: 1,
          boughtAt: 'electronics-store',
        });
        p.items.push({
          uid: 'st',
          itemId: 'stereo',
          condition: 'broken',
          boughtWeek: 1,
          boughtAt: 'electronics-store',
        });
      },
    );
  it('sells at 50% of depreciated value and lists the item; redeem at 110% within 2 rounds', () => {
    const s = owning('pawn');
    const ctx = new Ctx(s, pack, 0);
    expect(itemValue(ctx, 'television', 1)).toBe(368); // 400 × (100% − 2% × 4)
    expect(previewCommand(s, 0, { type: 'SellItem', itemId: 'television' }, pack).money).toBe(184);
    const sold = applyCommand(s, 0, { type: 'SellItem', itemId: 'television' }, pack);
    expect(sold.events.map((e) => e.type)).toEqual(['MoneyChanged', 'ItemSold']);
    expect(sold.state.players[0]!.cash).toBe(384);
    expect(sold.state.pawnShop).toEqual([
      { uid: 'tv', itemId: 'television', sellerSeat: 0, listedWeek: 5, paid: 184, boughtWeek: 1 },
    ]);
    expect(
      applyCommand(sold.state, 0, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack)
        .events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_FOR_SALE' });
    const back = applyCommand(sold.state, 0, { type: 'RedeemPawn', itemId: 'television' }, pack);
    expect(back.state.players[0]!.cash).toBe(384 - 202);
    expect(back.state.players[0]!.items.map((i) => i.itemId)).toContain('television');
    expect(back.state.pawnShop).toEqual([]);
  });
  it('rejects selling broken/unowned/unknown items, redeeming unlisted or expired listings', () => {
    const s = owning('pawn2');
    expect(
      applyCommand(s, 0, { type: 'SellItem', itemId: 'stereo' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_BROKEN' });
    expect(
      applyCommand(s, 0, { type: 'SellItem', itemId: 'computer' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_OWNED' });
    expect(applyCommand(s, 0, { type: 'SellItem', itemId: 'ghost' }, pack).events[0]).toMatchObject(
      { code: 'ERR_UNKNOWN_ID' },
    );
    expect(
      applyCommand(s, 0, { type: 'RedeemPawn', itemId: 'television' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_OWNED' });
    expect(
      applyCommand(s, 0, { type: 'RedeemPawn', itemId: 'ghost' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    const sold = run(s, 0, [{ type: 'SellItem', itemId: 'television' }]);
    const later = patch(sold, 0, (_p, st) => (st.week = 7));
    expect(
      applyCommand(later, 0, { type: 'RedeemPawn', itemId: 'television' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_PAWN_LOCKED' });
    expect(
      applyCommand(
        patch(sold, 0, (p) => (p.cash = 0)),
        0,
        { type: 'RedeemPawn', itemId: 'television' },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(
      applyCommand(newGame('pawn2'), 0, { type: 'SellItem', itemId: 'television' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
  });
  it('another player buys the listing at 70% of value after the redeem window; seller too once expired', () => {
    let s = run(owning('pawn3'), 0, [
      { type: 'SellItem', itemId: 'television' },
      { type: 'EndTurn' },
    ]);
    s = patch(s, 1, (p, st) => {
      st.week = 7;
      p.cash = 1000;
    });
    s = goInside(s, 1, 'pawn-shop');
    expect(legalCommands(s, 1, pack).filter((c) => c.type === 'BuyItem')).toEqual([
      { type: 'BuyItem', itemId: 'television', qty: 1 },
    ]);
    const r = applyCommand(s, 1, { type: 'BuyItem', itemId: 'television', qty: 1 }, pack);
    // value at week 7 with boughtWeek 1: 400 × 88% = 352 → ×70% = 246 (at econ 1.0)
    const expected = Math.floor((itemValue(new Ctx(s, pack, 1), 'television', 1) * 7000) / 10_000);
    expect(r.state.players[1]!.cash).toBe(1000 - expected);
    expect(expected).toBeGreaterThan(200);
    expect(r.state.players[1]!.items[0]).toMatchObject({ itemId: 'television', uid: 'tv' });
    expect(r.state.pawnShop).toEqual([]);
    const early = patch(
      run(owning('pawn4'), 0, [{ type: 'SellItem', itemId: 'television' }, { type: 'EndTurn' }]),
      1,
      (p) => (p.cash = 1000),
    );
    expect(
      applyCommand(
        goInside(early, 1, 'pawn-shop'),
        1,
        { type: 'BuyItem', itemId: 'television', qty: 1 },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_FOR_SALE' });
  });
});

describe('Repair', () => {
  it('repairs a broken item at a store that sells it; rejects unknown / unowned / not broken / elsewhere / no cash', () => {
    const s = patch(at('repair', 'electronics-store', 500), 0, (p) => {
      p.items.push({
        uid: 'st',
        itemId: 'stereo',
        condition: 'broken',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
      p.items.push({
        uid: 'tv',
        itemId: 'television',
        condition: 'ok',
        boughtWeek: 1,
        boughtAt: 'electronics-store',
      });
    });
    expect(legalCommands(s, 0, pack).filter((c) => c.type === 'Repair')).toEqual([
      { type: 'Repair', itemId: 'stereo' },
    ]);
    const r = applyCommand(s, 0, { type: 'Repair', itemId: 'stereo' }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['MoneyChanged', 'ItemRepaired']);
    expect(r.state.players[0]!.cash).toBe(440);
    expect(r.state.players[0]!.items[0]!.condition).toBe('ok');
    expect(applyCommand(s, 0, { type: 'Repair', itemId: 'ghost' }, pack).events[0]).toMatchObject({
      code: 'ERR_UNKNOWN_ID',
    });
    expect(
      applyCommand(s, 0, { type: 'Repair', itemId: 'computer' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_ITEM_NOT_OWNED' });
    expect(
      applyCommand(s, 0, { type: 'Repair', itemId: 'television' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    expect(
      applyCommand(s, 0, { type: 'Repair', itemId: 'refrigerator' }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    expect(
      applyCommand(
        patch(s, 0, (p) => (p.cash = 1)),
        0,
        { type: 'Repair', itemId: 'stereo' },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
  });
});

describe('Deposit / Withdraw', () => {
  it('moves money between cash and bank, 0h; rejects amounts beyond balance, non-positive, off-site', () => {
    const b = at('bank', 'bank', 300);
    const d = applyCommand(b, 0, { type: 'Deposit', amount: 120 }, pack);
    expect(d.events.map((e) => e.type)).toEqual(['MoneyChanged', 'MoneyChanged', 'Deposited']);
    expect(d.state.players[0]!).toMatchObject({ cash: 180, bank: 120 });
    const w = applyCommand(d.state, 0, { type: 'Withdraw', amount: 20 }, pack);
    expect(w.state.players[0]!).toMatchObject({ cash: 200, bank: 100 });
    expect(applyCommand(b, 0, { type: 'Deposit', amount: 301 }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_CASH',
    });
    expect(applyCommand(b, 0, { type: 'Withdraw', amount: 1 }, pack).events[0]).toMatchObject({
      code: 'ERR_NOT_ENOUGH_BANK',
    });
    expect(applyCommand(b, 0, { type: 'Deposit', amount: 0 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    expect(
      applyCommand(at('bank', 'park'), 0, { type: 'Deposit', amount: 10 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    expect(legalCommands(d.state, 0, pack).filter((c) => c.type === 'Withdraw')).toEqual([
      { type: 'Withdraw', amount: 100 },
      { type: 'Withdraw', amount: 120 },
    ]);
  });
});

describe('BuyAsset / SellAsset (GDD 4.12)', () => {
  it('buys milli-units at the cent price with a 1% fee; sells back at market value minus fee', () => {
    const b = at('asset', 'bank', 1000);
    const r = applyCommand(b, 0, { type: 'BuyAsset', assetId: 'gold', amount: 500 }, pack);
    expect(r.events.map((e) => e.type)).toEqual(['MoneyChanged', 'AssetBought']);
    expect(r.state.players[0]!.cash).toBe(495);
    expect(r.state.players[0]!.investments.gold).toEqual({ units: 5000, costBasisCents: 50_000 });
    expect(
      previewCommand(r.state, 0, { type: 'SellAsset', assetId: 'gold', amount: 9999 }, pack).money,
    ).toBe(495);
    const sold = applyCommand(
      r.state,
      0,
      { type: 'SellAsset', assetId: 'gold', amount: 200 },
      pack,
    );
    expect(sold.state.players[0]!.cash).toBe(495 + 198);
    expect(sold.state.players[0]!.investments.gold!.units).toBe(3000);
    const all = applyCommand(
      sold.state,
      0,
      { type: 'SellAsset', assetId: 'gold', amount: 100_000 },
      pack,
    );
    expect(all.state.players[0]!.investments.gold).toBeUndefined();
    expect(all.state.players[0]!.cash).toBe(495 + 198 + 297);
  });
  it('rejects unknown asset, no holdings, too little cash, off-site', () => {
    const b = at('asset2', 'bank', 50);
    expect(
      applyCommand(b, 0, { type: 'BuyAsset', assetId: 'tulips', amount: 10 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
    expect(
      applyCommand(b, 0, { type: 'SellAsset', assetId: 'gold', amount: 10 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_INVALID_AMOUNT' });
    expect(
      applyCommand(b, 0, { type: 'BuyAsset', assetId: 'gold', amount: 50 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(
      applyCommand(at('asset2', 'park'), 0, { type: 'BuyAsset', assetId: 'gold', amount: 10 }, pack)
        .events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    expect(
      applyCommand(b, 0, { type: 'SellAsset', assetId: 'tulips', amount: 10 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_UNKNOWN_ID' });
  });
  it('legal candidates scale with cash; wealth goal counts market value', () => {
    const rich = at('asset3', 'bank', 2500);
    const buys = legalCommands(rich, 0, pack).filter((c) => c.type === 'BuyAsset');
    expect(buys.length).toBe(6 * 4);
    const invested = run(rich, 0, [
      { type: 'BuyAsset', assetId: 't-bills', amount: 1000 },
      { type: 'EndTurn' },
    ]);
    const next = run(invested, 1, [{ type: 'EndTurn' }]);
    const goals = next.players[0]!.history.at(-1)!.goals;
    // $2,500 less fees and a week of market drift is still worth at least $2,300.
    expect(goals[0]).toBeGreaterThanOrEqual(Math.floor(2_300 / pack.wealthPointValue));
  });
});

describe('BuyLottery / ReadNews', () => {
  it('lottery tickets cost $10 each, resolve next turn start (at most one prize)', () => {
    const g = at('lotto', 'grocery', 300);
    const r = applyCommand(g, 0, { type: 'BuyLottery', qty: 5 }, pack);
    expect(r.state.players[0]!.cash).toBe(250);
    expect(r.state.players[0]!.lotteryTickets).toBe(5);
    expect(previewCommand(g, 0, { type: 'BuyLottery', qty: 1 }, pack).riskBp).toBe(10_000 - 970);
    expect(
      applyCommand(
        patch(g, 0, (p) => (p.cash = 100)),
        0,
        { type: 'BuyLottery', qty: 15 },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
    expect(applyCommand(g, 0, { type: 'BuyLottery', qty: 21 }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    expect(
      applyCommand(at('lotto', 'bank'), 0, { type: 'BuyLottery', qty: 1 }, pack).events[0],
    ).toMatchObject({ code: 'ERR_NOT_AT_LOCATION' });
    let wins = 0;
    for (let i = 0; i < 40; i++) {
      let s = patch(at(`lotto-${i}`, 'grocery', 500), 0, (p) => (p.lotteryTickets = 20));
      s = run(s, 0, [{ type: 'EndTurn' }]);
      const r2 = applyCommand(s, 1, { type: 'EndTurn' }, pack);
      const ev = r2.events.find((e) => e.type === 'LotteryResolved');
      expect(ev).toBeDefined();
      expect(r2.state.players[0]!.lotteryTickets).toBe(0);
      if (ev?.type === 'LotteryResolved' && ev.prize > 0) {
        wins++;
        expect([200, 1000, 5000]).toContain(ev.prize);
      }
    }
    expect(wins).toBeGreaterThan(5);
  });
  it('ReadNews costs $1 at the grocery once per week; free anywhere with a newsHint unlock', () => {
    const g = at('news', 'grocery', 50);
    const r = applyCommand(g, 0, { type: 'ReadNews' }, pack);
    expect(r.state.players[0]!.cash).toBe(49);
    expect(r.state.players[0]!.newsHintWeek).toBe(1);
    expect(applyCommand(r.state, 0, { type: 'ReadNews' }, pack).events[0]).toMatchObject({
      code: 'ERR_INVALID_AMOUNT',
    });
    expect(applyCommand(at('news', 'bank'), 0, { type: 'ReadNews' }, pack).events[0]).toMatchObject(
      { code: 'ERR_NOT_AT_LOCATION' },
    );
    expect(
      applyCommand(
        patch(g, 0, (p) => (p.cash = 0)),
        0,
        { type: 'ReadNews' },
        pack,
      ).events[0],
    ).toMatchObject({ code: 'ERR_NOT_ENOUGH_CASH' });
  });
});
