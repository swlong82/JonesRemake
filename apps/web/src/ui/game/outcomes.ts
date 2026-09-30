/**
 * Outcome pop-ups (M13.2): which domain events deserve a modal of their own, and the wording for
 * each. Start-of-turn cards (`CARD_EVENTS`) already cover refusals, firing and graduation, so this
 * table only adds the results a player otherwise sees as a passing toast. Pure functions.
 */
import type { DomainEvent } from '@hustle-ring/shared';
import type { Popups } from '../../store/settings';
import {
  assetName,
  degreeName,
  itemName,
  jobTitle,
  subscriptionName,
  type Translate,
} from './labels';

export type OutcomeTone = 'good' | 'bad';

/** Shown at the default `important` density. */
const IMPORTANT = new Set<DomainEvent['type']>([
  'Hired',
  'Raised',
  'Enrolled',
  'LoanTaken',
  'LoanMissed',
  'LoanDefaulted',
  'CarBought',
  'HomeMoved',
  'GoalMet',
  'GoalLost',
]);

/** Added at `all` density. */
const ROUTINE = new Set<DomainEvent['type']>([
  'ItemBought',
  'Subscribed',
  'RentPaid',
  'AssetBought',
  'AssetSold',
]);

const BAD = new Set<DomainEvent['type']>(['LoanMissed', 'LoanDefaulted', 'GoalLost']);

export function isOutcome(event: DomainEvent, popups: Popups): boolean {
  if (popups === 'off') return false;
  return IMPORTANT.has(event.type) || (popups === 'all' && ROUTINE.has(event.type));
}

export function outcomeTone(event: DomainEvent): OutcomeTone {
  return BAD.has(event.type) ? 'bad' : 'good';
}

/** Title and body for an outcome event, from `outcome.<Type>.*` keys. */
export function outcomeText(event: DomainEvent, t: Translate): { title: string; text: string } {
  const key = `outcome.${event.type}`;
  const params = ((): Record<string, string | number> => {
    switch (event.type) {
      case 'Hired':
        return { job: jobTitle(event.jobId) };
      case 'Raised':
        return { wage: event.wage };
      case 'Enrolled':
        return { degree: degreeName(event.degreeId) };
      case 'ItemBought':
        return { item: itemName(event.itemId) };
      case 'Subscribed':
        return { sub: subscriptionName(event.subId) };
      case 'AssetBought':
      case 'AssetSold':
        return { asset: assetName(event.assetId), units: event.units };
      case 'RentPaid':
        return { months: event.months };
      case 'HomeMoved':
        return { tier: t(`home.${event.tier}`) };
      case 'GoalMet':
      case 'GoalLost':
        return { goal: t(`hud.goal.${event.goal}`) };
      default:
        return {};
    }
  })();
  return { title: t(`${key}.title`, params), text: t(`${key}.text`, params) };
}
