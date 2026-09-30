/** Event-log filters and icons (M13.9). Pure: the drawer only maps events to a category. */
import type { DomainEvent } from '@hustle-ring/shared';

export type LogCategory = 'money' | 'work' | 'study' | 'home' | 'events' | 'travel' | 'other';
export type LogFilter = 'all' | 'money' | 'work' | 'life';

const CATEGORY: Partial<Record<DomainEvent['type'], LogCategory>> = {
  MoneyChanged: 'money',
  Deposited: 'money',
  Withdrawn: 'money',
  AssetBought: 'money',
  AssetSold: 'money',
  LoanTaken: 'money',
  LoanPaid: 'money',
  LoanMissed: 'money',
  LoanDefaulted: 'money',
  SubBilled: 'money',
  Subscribed: 'money',
  Unsubscribed: 'money',
  LotteryResolved: 'money',
  Hired: 'work',
  Refused: 'work',
  Raised: 'work',
  Worked: 'work',
  Fired: 'work',
  GigStarted: 'work',
  GigWorked: 'work',
  Enrolled: 'study',
  Studied: 'study',
  Graduated: 'study',
  RentPaid: 'home',
  RentDue: 'home',
  RentDebt: 'home',
  Evicted: 'home',
  HomeMoved: 'home',
  ExtensionDenied: 'home',
  EventFired: 'events',
  ItemsStolen: 'events',
  ItemBroke: 'events',
  Starved: 'events',
  Spoiled: 'events',
  GoalMet: 'events',
  GoalLost: 'events',
  Moved: 'travel',
  Entered: 'travel',
  Exited: 'travel',
};

export function logCategory(event: DomainEvent): LogCategory {
  return CATEGORY[event.type] ?? 'other';
}

export const CATEGORY_ICON: Record<LogCategory, string> = {
  money: '$',
  work: '⚒',
  study: '✎',
  home: '⌂',
  events: '!',
  travel: '→',
  other: '·',
};

/** Whether an entry stays visible under a filter. `life` = study, home and events. */
export function matchesFilter(event: DomainEvent, filter: LogFilter): boolean {
  if (filter === 'all') return true;
  const c = logCategory(event);
  if (filter === 'life') return c === 'study' || c === 'home' || c === 'events';
  return c === filter;
}
