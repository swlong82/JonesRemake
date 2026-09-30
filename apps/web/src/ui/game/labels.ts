/**
 * Command / preview / event → i18n label helpers (UX 7.4, 7.5). Pure functions so the board,
 * panel, log and ticker all read the same wording, and so the wording is unit-testable without
 * rendering React.
 *
 * Every string returned here comes from a key: `translation` keys for UI chrome, the `pack`
 * namespace (via `tp`) for content names (CLAUDE.md 1.3).
 */
import type { CityPack } from '@hustle-ring/content';
import type { ActionPreview, Command, GameState } from '@hustle-ring/engine';
import type { DomainEvent } from '@hustle-ring/shared';
import type { TFunction } from 'i18next';
import i18n, { tp } from '../../i18n';

/** `useTranslation().t` — kept as i18next's own type so components can pass it straight through. */
export type Translate = TFunction;

/** Section a command belongs to in the location panel; `null` = rendered outside the sections. */
export type SectionId =
  | 'work'
  | 'apply'
  | 'raise'
  | 'gig'
  | 'meals'
  | 'grocery'
  | 'bank'
  | 'invest'
  | 'loans'
  | 'subscriptions'
  | 'transit-pass'
  | 'cars'
  | 'delivery'
  | 'rent'
  | 'move-home'
  | 'study'
  | 'relax'
  | 'shop'
  | 'pawn'
  | 'lottery'
  | 'news';

const SECTION_OF: Record<string, SectionId> = {
  Work: 'work',
  ApplyJob: 'apply',
  AskRaise: 'raise',
  GigSignup: 'gig',
  GigShift: 'gig',
  EatMeal: 'meals',
  BuyFood: 'grocery',
  Deposit: 'bank',
  Withdraw: 'bank',
  BuyAsset: 'invest',
  SellAsset: 'invest',
  TakeLoan: 'loans',
  RepayLoan: 'loans',
  Subscribe: 'subscriptions',
  Unsubscribe: 'subscriptions',
  BuyTransitPass: 'transit-pass',
  BuyCar: 'cars',
  SellCar: 'cars',
  RepairCar: 'cars',
  OrderDelivery: 'delivery',
  PayRent: 'rent',
  RequestExtension: 'rent',
  MoveHome: 'move-home',
  Enroll: 'study',
  Study: 'study',
  StudyOnline: 'study',
  Relax: 'relax',
  BuyItem: 'shop',
  Repair: 'shop',
  SellItem: 'pawn',
  RedeemPawn: 'pawn',
  BuyLottery: 'lottery',
  ReadNews: 'news',
};

/** Panel section order (UX 7.4: work first, then money, then shopping). */
export const SECTION_ORDER: SectionId[] = [
  'work',
  'apply',
  'raise',
  'gig',
  'study',
  'relax',
  'meals',
  'grocery',
  'rent',
  'move-home',
  'bank',
  'invest',
  'loans',
  'subscriptions',
  'transit-pass',
  'cars',
  'delivery',
  'shop',
  'pawn',
  'lottery',
  'news',
];

export function sectionOf(cmd: Command): SectionId | null {
  return SECTION_OF[cmd.type] ?? null;
}

/** Half-hours → display hours ("6", "1.5"). */
export function hours(halfHours: number): string {
  const h = Math.abs(halfHours) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function sign(n: number): string {
  return n < 0 ? '−' : '+';
}

export function itemName(id: string): string {
  return tp(`item.${id}.name`);
}
export function degreeName(id: string): string {
  return tp(`degree.${id}.name`);
}
export function jobTitle(id: string): string {
  return tp(`job.${id}.title`);
}
export function assetName(id: string): string {
  return tp(`asset.${id}.name`);
}
export function subscriptionName(id: string): string {
  return tp(`sub.${id}.name`);
}
export function mealName(id: string): string {
  return tp(`meal.${id}.name`);
}
/** A service id as a short player-facing word: the panel's section title, else the id itself. */
export function serviceLabel(service: string, t: Translate): string {
  const key = `panel.section.${service}`;
  return i18n.exists(key) ? t(key) : service;
}

export function locationName(id: string): string {
  return tp(`location.${id}.name`);
}

/** A location's rotating quip; deterministic in the week so it does not flicker on re-render. */
export function locationQuip(id: string, week: number): string {
  const i = (week % 3) + 1;
  return tp(`location.${id}.greeting.${i}`);
}

/** Action label for a command, e.g. "Work a shift (8h)" or "Buy Refrigerator". */
export function commandLabel(cmd: Command, t: Translate): string {
  switch (cmd.type) {
    case 'ApplyJob':
      return t('cmd.ApplyJob', { job: jobTitle(cmd.jobId) });
    case 'Work':
      return t('cmd.Work', { hours: hours(cmd.hours) });
    case 'Enroll':
      return t('cmd.Enroll', { degree: degreeName(cmd.degreeId) });
    case 'Study':
      return t('cmd.Study', { degree: degreeName(cmd.degreeId) });
    case 'StudyOnline':
      return t('cmd.StudyOnline', { degree: degreeName(cmd.degreeId) });
    case 'GigSignup':
      return t('cmd.GigSignup', { job: jobTitle(cmd.gigId) });
    case 'GigShift':
      return t('cmd.GigShift', { hours: hours(cmd.hours) });
    case 'BuyItem':
      return t('cmd.BuyItem', { item: itemName(cmd.itemId) });
    case 'SellItem':
      return t('cmd.SellItem', { item: itemName(cmd.itemId) });
    case 'RedeemPawn':
      return t('cmd.RedeemPawn', { item: itemName(cmd.itemId) });
    case 'Repair':
      return t('cmd.Repair', { item: itemName(cmd.itemId) });
    case 'BuyFood':
      return t('cmd.BuyFood', { units: cmd.units });
    case 'EatMeal':
      return t('cmd.EatMeal', { meal: mealName(cmd.mealId) });
    case 'PayRent':
      return cmd.months === 0
        ? t('cmd.PayRent_debt')
        : t(cmd.months === 1 ? 'cmd.PayRent' : 'cmd.PayRent_plural', { months: cmd.months });
    case 'MoveHome':
      return t('cmd.MoveHome', { tier: t(`home.${cmd.tier}`) });
    case 'Deposit':
      return t('cmd.Deposit', { amount: cmd.amount });
    case 'Withdraw':
      return t('cmd.Withdraw', { amount: cmd.amount });
    case 'BuyAsset':
      return t('cmd.BuyAsset', { amount: cmd.amount, asset: assetName(cmd.assetId) });
    case 'SellAsset':
      return t('cmd.SellAsset', { amount: cmd.amount, asset: assetName(cmd.assetId) });
    case 'TakeLoan':
      return t('cmd.TakeLoan', { amount: cmd.principal, weeks: cmd.termWeeks });
    case 'RepayLoan':
      return t('cmd.RepayLoan', { amount: cmd.amount });
    case 'Subscribe':
      return t('cmd.Subscribe', { sub: subscriptionName(cmd.subId) });
    case 'Unsubscribe':
      return t('cmd.Unsubscribe', { sub: subscriptionName(cmd.subId) });
    case 'BuyCar':
      return t(`cmd.BuyCar.${cmd.source}`);
    case 'OrderDelivery':
      return t('cmd.OrderDelivery', { meal: mealName(cmd.mealId) });
    case 'BuyLottery':
      return t(cmd.qty === 1 ? 'cmd.BuyLottery' : 'cmd.BuyLottery_plural', { qty: cmd.qty });
    case 'Move':
      return t('cmd.Move', { name: locationName(cmd.to) });
    default:
      return t(`cmd.${cmd.type}`);
  }
}

/** "Your" for the default human seat, else "Name's" (used in "Your turn, week 3"). */
export function turnOwner(name: string, t: Translate): string {
  return name === 'You' ? t('turn.owner.you') : t('turn.owner.name', { name });
}

/** Why a command is disabled; a command-specific line wins over the generic code text. */
export function disabledReason(cmd: Command, code: string, t: Translate): string {
  return t(`error.${code}.${cmd.type}`, { defaultValue: t(`error.${code}`) });
}

/** A stable identity for a command, used as a React key and for repeat-action comparisons. */
export function commandKey(cmd: Command): string {
  const parts: string[] = [cmd.type];
  for (const [k, v] of Object.entries(cmd)) {
    if (k === 'type') continue;
    parts.push(`${k}=${String(v)}`);
  }
  return parts.join(':');
}

/** `note` strings from the engine are `key` or `key:number` (ActionPreview.notes). */
export function noteLabel(note: string, t: Translate): string {
  const i = note.indexOf(':');
  if (i < 0) return t(`note.${note}`);
  const key = note.slice(0, i);
  const n = Number(note.slice(i + 1));
  // Gig demand travels as per-mille (1000 = normal); show whole percent.
  return t(`note.${key}`, {
    n: key === 'gig-demand' ? Math.round(n / 10) : n,
    count: n,
  });
}

/**
 * Preview parts for one action: `−6h`, `+$96`, stat deltas, risk (UX 7.4). Classic opacity keeps
 * hours and money only.
 */
export function previewParts(
  preview: ActionPreview,
  t: Translate,
  opts: { opaque?: boolean } = {},
): string[] {
  const parts: string[] = [];
  if (preview.hours !== 0)
    parts.push(`${sign(preview.hours)}${t('panel.preview.hours', { n: hours(preview.hours) })}`);
  if (preview.money !== 0)
    parts.push(`${sign(preview.money)}${t('panel.preview.money', { n: Math.abs(preview.money) })}`);
  if (opts.opaque === true) return parts;
  for (const [stat, delta] of Object.entries(preview.deltas)) {
    if (delta === 0) continue;
    parts.push(`${t(`hud.${stat}`)} ${sign(delta)}${Math.abs(delta)}`);
  }
  if (preview.riskBp !== undefined && preview.riskBp > 0) {
    const pct = preview.riskBp / 100;
    const named = preview.riskKey?.replace(/^risk\./, '');
    if (named !== undefined && i18n.exists(`panel.preview.riskFor.${named}`))
      parts.push(
        t(`panel.preview.riskFor.${named}`, { pct: Number.isInteger(pct) ? pct : pct.toFixed(1) }),
      );
    else parts.push(t('panel.preview.risk', { pct: pct.toFixed(1) }));
  }
  for (const note of preview.notes) parts.push(noteLabel(note, t));
  return parts;
}

/** The pack numbers an event card needs; the classic values are the fallback for bare callers. */
export interface EventRules {
  time: { starvationHours: number; applyHours: number };
  happiness: { starvation: number; refused: number };
}

function starvationOf(rules?: EventRules): { hours: string; happiness: number } {
  return {
    hours: hours(rules?.time.starvationHours ?? 40),
    happiness: rules?.happiness.starvation ?? -5,
  };
}

/** Effect chips on an event card (UX 7.5): compact, from the event body. */
export function eventChips(event: DomainEvent, t: Translate, rules?: EventRules): string[] {
  switch (event.type) {
    case 'EventFired':
      return event.effects.map((e) => effectChip(e, t));
    case 'Starved': {
      const r = starvationOf(rules);
      return [
        t('event.chip.hours', { n: r.hours }),
        t('event.chip.stat', {
          stat: t('hud.goal.happiness'),
          sign: sign(r.happiness),
          n: Math.abs(r.happiness),
        }),
      ];
    }
    case 'Refused':
      return rules
        ? [
            t('event.chip.hours', { n: hours(rules.time.applyHours) }),
            t('event.chip.stat', {
              stat: t('hud.goal.happiness'),
              sign: sign(rules.happiness.refused),
              n: Math.abs(rules.happiness.refused),
            }),
          ]
        : [];
    case 'ItemsStolen':
      return [t('event.chip.items', { n: -event.uids.length })];
    case 'ItemBroke':
      return [t('event.chip.broken', { item: t('hud.clothing') })];
    case 'RentDebt':
      return [t('event.chip.debt', { n: 0 })];
    case 'Fired':
      return [t('event.chip.fired')];
    case 'LotteryResolved':
      return event.prize > 0 ? [t('event.chip.money', { sign: '+', n: event.prize })] : [];
    default:
      return [];
  }
}

/** Effect DSL strings (`money:cash:-40`, `stat:happiness:-3`, `hours:-4`) → chips. */
export function effectChip(effect: string, t: Translate): string {
  const [op, a, b] = effect.split(':');
  const n = Number(b ?? a ?? 0);
  switch (op) {
    case 'money':
      return t('event.chip.money', { sign: sign(n), n: Math.abs(n) });
    case 'stat':
      return t('event.chip.stat', { stat: t(`hud.${a ?? ''}`), sign: sign(n), n: Math.abs(n) });
    case 'hours':
      return t('event.chip.hours', { n: hours(n) });
    case 'econ':
      return t('event.chip.econ');
    case 'market':
      return t('event.chip.asset');
    case 'job':
      return t('event.chip.fired');
    case 'items':
      return t('event.chip.items', { n });
    default:
      return t('event.chip.other', { text: effect });
  }
}

/** Card title / body for a modal event card. */
export function eventCardText(
  event: DomainEvent,
  t: Translate,
  rules?: EventRules,
): { title: string; text: string } {
  if (event.type === 'Starved') {
    const r = starvationOf(rules);
    return {
      title: t('event.Starved.title'),
      text: t('event.Starved.text', { hours: r.hours, happiness: Math.abs(r.happiness) }),
    };
  }
  if (event.type === 'EventFired') {
    const id = event.eventId;
    const packTitle = tp(`event.${id}.title`, '');
    if (packTitle !== '' && packTitle !== `event.${id}.title`)
      return { title: packTitle, text: tp(`event.${id}.text.1`, '') };
    return { title: t(`event.${id}.title`), text: t(`event.${id}.text`) };
  }
  if (event.type === 'Refused')
    return {
      title: t('event.Refused.title'),
      text: t('event.Refused.text', { job: jobTitle(event.jobId) }),
    };
  if (event.type === 'LotteryResolved')
    return {
      title: t('event.LotteryResolved.title'),
      text:
        event.prize > 0
          ? t('event.LotteryResolved.win', { prize: event.prize })
          : t('event.LotteryResolved.lose'),
    };
  if (event.type === 'ItemsStolen')
    return {
      title: t('event.ItemsStolen.title'),
      text: t('event.ItemsStolen.text', { n: event.uids.length }),
    };
  return { title: t(`event.${event.type}.title`), text: t(`event.${event.type}.text`) };
}

function seatName(state: GameState, seat: number | null): string {
  return seat === null ? '' : (state.players[seat]?.name ?? '');
}

/**
 * One event-log line (UX 7.5). `hideAmounts` blanks other players' money in hotseat privacy.
 */
export function logLine(
  event: DomainEvent,
  state: GameState,
  t: Translate,
  hideAmounts = false,
): string {
  const name = 'seat' in event ? seatName(state, event.seat) : '';
  const amount = (n: number): string => (hideAmounts ? t('log.hiddenAmount') : String(n));
  switch (event.type) {
    case 'MoneyChanged':
      return t('log.MoneyChanged', {
        name,
        account: t(event.account === 'bank' ? 'hud.bank' : 'hud.cash'),
        sign: sign(event.delta),
        n: amount(Math.abs(event.delta)),
        reason: event.reason,
      });
    case 'StatChanged':
      return t('log.StatChanged', {
        name,
        stat: t(`hud.${event.stat}`),
        sign: sign(event.delta),
        n: Math.abs(event.delta),
      });
    case 'HoursSpent':
      return t('log.HoursSpent', { name, n: hours(event.hours), reason: event.reason });
    case 'Moved':
      return t('log.Moved', { name, to: locationName(event.to) });
    case 'Entered':
      return t('log.Entered', { name, loc: locationName(event.loc) });
    case 'Hired':
      return t('log.Hired', { name, job: jobTitle(event.jobId) });
    case 'Worked':
      return t('log.Worked', { name, hours: hours(event.hours), pay: amount(event.pay) });
    case 'Enrolled':
      return t('log.Enrolled', { name, degree: degreeName(event.degreeId) });
    case 'Studied':
      return t('log.Studied', { name, degree: degreeName(event.degreeId) });
    case 'Graduated':
      return t('log.Graduated', { name, degree: degreeName(event.degreeId) });
    case 'ItemBought':
      return t('log.ItemBought', { name, item: itemName(event.itemId) });
    case 'ItemSold':
      return t('log.ItemSold', { name, item: itemName(event.itemId) });
    case 'FoodBought':
      return t('log.FoodBought', { name, units: event.units });
    case 'Deposited':
      return t('log.Deposited', { name, amount: amount(event.amount) });
    case 'Withdrawn':
      return t('log.Withdrawn', { name, amount: amount(event.amount) });
    case 'AssetBought':
      return t('log.AssetBought', { name, asset: assetName(event.assetId) });
    case 'AssetSold':
      return t('log.AssetSold', { name, asset: assetName(event.assetId) });
    case 'EventFired':
      return t('log.EventFired', { name, event: eventCardText(event, t).title });
    case 'TurnStarted':
      return t('log.TurnStarted', { name, week: event.week });
    case 'WeekAdvanced':
      return t('log.WeekAdvanced', { week: event.week });
    case 'EconomyTicked':
      return t('log.EconomyTicked', { phase: t(`phase.${event.phase}`) });
    case 'Won':
      return t('log.Won', { name });
    case 'TurnEnded':
    case 'Fired':
    case 'Refused':
    case 'Raised':
    case 'Relaxed':
    case 'MealEaten':
    case 'RentPaid':
    case 'MarketMoved':
      return t(`log.${event.type}`, { name });
    case 'HomeMoved':
      return t('log.HomeMoved', { name });
    default:
      return t('log.generic', { type: event.type });
  }
}

/** Ring badge key for a location index (UX 7.7 keyboard map). */
export const RING_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'Q',
  'W',
  'E',
  'R',
  'T',
  'Y',
] as const;

export function ringKeyFor(index: number): string {
  return RING_KEYS[index] ?? '';
}

/** Travel time in half-hours from a player's node to a location, walking. */
export function stepsBetween(pack: CityPack, from: string, to: string): number {
  const a = pack.board.nodeOf[from];
  const b = pack.board.nodeOf[to];
  if (a === undefined || b === undefined) return 0;
  return pack.board.dist[a]?.[b] ?? 0;
}

/** Cost of walking to a location and entering it, in half-hours (M11.2). */
export interface TripCost {
  walk: number;
  enter: number;
  total: number;
  /** Half-hours left after the whole trip (never below 0). */
  left: number;
  /** Walking alone uses every hour left: you would stop early and the turn ends. */
  partial: boolean;
  /** Walking fits but entering does not. */
  cannotEnter: boolean;
}

export function tripCost(
  walkHalfHours: number,
  enterHalfHours: number,
  hoursLeft: number,
): TripCost {
  const walk = Math.abs(walkHalfHours);
  const total = walk + enterHalfHours;
  return {
    walk,
    enter: enterHalfHours,
    total,
    left: Math.max(0, hoursLeft - total),
    partial: walk > hoursLeft,
    cannotEnter: walk <= hoursLeft && total > hoursLeft,
  };
}

/** What a batch of modal cards costs or pays in total: cash and half-hours (M11.10). */
export function summarizeCards(
  cards: readonly DomainEvent[],
  rules?: EventRules,
): { money: number; halfHours: number } {
  let money = 0;
  let halfHours = 0;
  for (const card of cards) {
    if (card.type === 'Starved') halfHours -= rules?.time.starvationHours ?? 40;
    if (card.type === 'LotteryResolved') money += card.prize;
    if (card.type !== 'EventFired') continue;
    for (const effect of card.effects) {
      const [op, a, b] = effect.split(':');
      if (op === 'money' && a === 'cash') money += Number(b ?? 0);
      if (op === 'hours') halfHours += Number(a ?? 0);
    }
  }
  return { money, halfHours };
}

/** "−6h · +$96 · Experience +1": what one action did to the acting seat (M11.10). */
export function deltaParts(
  events: readonly DomainEvent[],
  seat: number,
  t: Translate,
  opts: { opaque?: boolean } = {},
): string[] {
  let spent = 0;
  let cash = 0;
  let bank = 0;
  const stats = new Map<string, number>();
  for (const e of events) {
    if (!('seat' in e) || e.seat !== seat) continue;
    if (e.type === 'HoursSpent') spent += e.hours;
    else if (e.type === 'MoneyChanged') {
      if (e.account === 'bank') bank += e.delta;
      else cash += e.delta;
    } else if (e.type === 'StatChanged') stats.set(e.stat, (stats.get(e.stat) ?? 0) + e.delta);
  }
  const parts: string[] = [];
  if (spent !== 0) parts.push(`−${t('panel.preview.hours', { n: hours(spent) })}`);
  if (cash !== 0) parts.push(`${sign(cash)}${t('panel.preview.money', { n: Math.abs(cash) })}`);
  if (bank !== 0)
    parts.push(`${t('hud.bank')} ${sign(bank)}${t('panel.preview.money', { n: Math.abs(bank) })}`);
  if (opts.opaque !== true)
    for (const [stat, delta] of stats) {
      if (delta !== 0) parts.push(`${t(`hud.${stat}`)} ${sign(delta)}${Math.abs(delta)}`);
    }
  return parts;
}
