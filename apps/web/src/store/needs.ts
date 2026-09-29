/**
 * Weekly needs (M11.1): what the active player will be charged for at the start of their next turn
 * if they end it now. Pure, so the end-turn confirm, the panel banner and tests share one reading.
 *
 * Mirrors the engine's start-of-turn pipeline (`resolveFood`, `resolveRent`) using only public state.
 */
import type { CityPack } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';

export type NeedId = 'food' | 'rent';

export interface Need {
  id: NeedId;
  /** Half-hours the penalty costs (food), else 0. */
  halfHours: number;
  /** Rent that becomes debt if unpaid (rent), else 0. */
  amount: number;
}

export function weekNeeds(state: GameState, pack: CityPack, seat = state.activeSeat): Need[] {
  const p = state.players[seat];
  if (!p) return [];
  const out: Need[] = [];
  const fed =
    p.food.fridgeUnits > 0 || p.food.unrefrigeratedUnits > 0 || p.food.mealPending !== null;
  // The engine skips starvation only in week 1, and the next turn is always week 2 or later.
  if (!fed) out.push({ id: 'food', halfHours: pack.rules.time.starvationHours, amount: 0 });

  const rentWeeks = pack.rules.housing.rentWeeks;
  const due = p.home.paidThroughWeek + rentWeeks;
  const dueWeek =
    p.home.extensionUntilWeek !== null ? Math.max(due, p.home.extensionUntilWeek) : due;
  if (p.home.debt > 0 || state.week >= dueWeek)
    out.push({ id: 'rent', halfHours: 0, amount: p.home.debt + p.home.rentLocked });
  return out;
}

/**
 * Whole weeks until rent is due (M12.9): 0 = due at the start of the next turn or already owing.
 * Same reading as `weekNeeds`, so the HUD chip and the end-turn warning never disagree.
 */
export function rentDueIn(state: GameState, pack: CityPack, seat = state.activeSeat): number {
  const p = state.players[seat];
  if (!p) return 0;
  const due = p.home.paidThroughWeek + pack.rules.housing.rentWeeks;
  const dueWeek =
    p.home.extensionUntilWeek !== null ? Math.max(due, p.home.extensionUntilWeek) : due;
  if (p.home.debt > 0) return 0;
  return Math.max(0, dueWeek - state.week);
}

export type HourCell = 'left' | 'planned' | 'spent';

/**
 * One cell per hour of the week for the HUD strip (M12.9): spent, planned (the trip being looked
 * at) and still free. Inputs are half-hours; a partly used hour counts as still there.
 */
export function hourCells(total: number, left: number, planned: number): HourCell[] {
  const hoursTotal = Math.max(0, Math.ceil(total / 2));
  const keep = Math.max(0, Math.min(total, left - Math.max(0, planned)));
  const held = Math.max(0, Math.min(total, left));
  const cells: HourCell[] = [];
  for (let i = 0; i < hoursTotal; i++) {
    const from = i * 2;
    cells.push(from < keep ? 'left' : from < held ? 'planned' : 'spent');
  }
  return cells;
}
