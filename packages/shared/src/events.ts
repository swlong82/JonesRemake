/**
 * DomainEvent union (STATE_MODEL 13.4). Emitted by the engine, consumed by UI (animation, audio,
 * log, tutorial), AI and sim. Every event carries `seq` and `week`.
 */
import type { ErrorCode } from './errors.js';
import type {
  AssetId,
  DegreeId,
  EconPhase,
  EventId,
  GigId,
  GoalId,
  HomeTier,
  ItemId,
  JobId,
  LocationId,
  MoneyAccount,
  StatId,
  SubscriptionId,
  TransportModeId,
} from './ids.js';

interface Base {
  seq: number;
  week: number;
}

export type DomainEventBody =
  | { type: 'TurnStarted'; seat: number; week: number }
  | { type: 'TurnEnded'; seat: number }
  | { type: 'WeekAdvanced'; week: number }
  | { type: 'EconomyTicked'; econ: number; phase: EconPhase }
  | {
      type: 'Moved';
      seat: number;
      from: LocationId;
      to: LocationId;
      mode: TransportModeId;
      hours: number;
    }
  | { type: 'Entered'; seat: number; loc: LocationId }
  | { type: 'Exited'; seat: number; loc: LocationId }
  | { type: 'HoursSpent'; seat: number; hours: number; reason: string }
  | { type: 'MoneyChanged'; seat: number; account: MoneyAccount; delta: number; reason: string }
  | { type: 'StatChanged'; seat: number; stat: StatId; delta: number; reason: string }
  | { type: 'Hired'; seat: number; jobId: JobId }
  | { type: 'Refused'; seat: number; jobId: JobId; code: ErrorCode }
  | { type: 'Raised'; seat: number; wage: number }
  | { type: 'Worked'; seat: number; hours: number; pay: number }
  | { type: 'Fired'; seat: number; reason: string }
  | { type: 'GigStarted'; seat: number; gigId: GigId }
  | { type: 'GigWorked'; seat: number; hours: number; pay: number }
  | { type: 'Enrolled'; seat: number; degreeId: DegreeId }
  | { type: 'Studied'; seat: number; degreeId: DegreeId; counted: boolean; online: boolean }
  | { type: 'Graduated'; seat: number; degreeId: DegreeId }
  | { type: 'Relaxed'; seat: number }
  | { type: 'ItemBought'; seat: number; itemId: ItemId }
  | { type: 'ItemSold'; seat: number; itemId: ItemId }
  | { type: 'ItemBroke'; seat: number; uid: string }
  | { type: 'ItemRepaired'; seat: number; uid: string }
  | { type: 'ItemsStolen'; seat: number; uids: string[] }
  | { type: 'FoodBought'; seat: number; units: number }
  | { type: 'MealEaten'; seat: number }
  | { type: 'Starved'; seat: number }
  | { type: 'Spoiled'; seat: number }
  | { type: 'RentPaid'; seat: number; months: number }
  | { type: 'RentDue'; seat: number }
  | { type: 'RentDebt'; seat: number }
  | { type: 'Evicted'; seat: number }
  | { type: 'HomeMoved'; seat: number; tier: HomeTier }
  | { type: 'Deposited'; seat: number; amount: number }
  | { type: 'Withdrawn'; seat: number; amount: number }
  | { type: 'AssetBought'; seat: number; assetId: AssetId; units: number }
  | { type: 'AssetSold'; seat: number; assetId: AssetId; units: number }
  | { type: 'MarketMoved'; prices: Record<AssetId, number> }
  | { type: 'LoanTaken'; seat: number }
  | { type: 'LoanPaid'; seat: number }
  | { type: 'LoanMissed'; seat: number }
  | { type: 'LoanDefaulted'; seat: number }
  | { type: 'Subscribed'; seat: number; subId: SubscriptionId }
  | { type: 'Unsubscribed'; seat: number; subId: SubscriptionId }
  | { type: 'SubBilled'; seat: number; total: number }
  | { type: 'CarBought'; seat: number }
  | { type: 'CarSold'; seat: number }
  | { type: 'EventFired'; seat: number; eventId: EventId; effects: string[] }
  | { type: 'LotteryResolved'; seat: number; prize: number }
  | { type: 'WellbeingBand'; seat: number; band: string }
  | { type: 'GoalMet'; seat: number; goal: GoalId }
  | { type: 'GoalLost'; seat: number; goal: GoalId }
  | { type: 'Won'; seat: number; week: number }
  | { type: 'CommandRejected'; seat: number; cmdType: string; code: ErrorCode };

export type DomainEvent = DomainEventBody & Base;
export type DomainEventType = DomainEventBody['type'];

/** Every event type name, for exhaustiveness tests and audio/animation mapping tables. */
export const DOMAIN_EVENT_TYPES = [
  'TurnStarted',
  'TurnEnded',
  'WeekAdvanced',
  'EconomyTicked',
  'Moved',
  'Entered',
  'Exited',
  'HoursSpent',
  'MoneyChanged',
  'StatChanged',
  'Hired',
  'Refused',
  'Raised',
  'Worked',
  'Fired',
  'GigStarted',
  'GigWorked',
  'Enrolled',
  'Studied',
  'Graduated',
  'Relaxed',
  'ItemBought',
  'ItemSold',
  'ItemBroke',
  'ItemRepaired',
  'ItemsStolen',
  'FoodBought',
  'MealEaten',
  'Starved',
  'Spoiled',
  'RentPaid',
  'RentDue',
  'RentDebt',
  'Evicted',
  'HomeMoved',
  'Deposited',
  'Withdrawn',
  'AssetBought',
  'AssetSold',
  'MarketMoved',
  'LoanTaken',
  'LoanPaid',
  'LoanMissed',
  'LoanDefaulted',
  'Subscribed',
  'Unsubscribed',
  'SubBilled',
  'CarBought',
  'CarSold',
  'EventFired',
  'LotteryResolved',
  'WellbeingBand',
  'GoalMet',
  'GoalLost',
  'Won',
  'CommandRejected',
] as const satisfies readonly DomainEventType[];
