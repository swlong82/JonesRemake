/**
 * DomainEvent → SFX mapping (AUDIO_SPEC 8.1: "Driven only by `DomainEvent`s through a mapping
 * table; engine has no audio knowledge"). Pure: it reads an event and names a sound, so the whole
 * table is testable without a WebAudio context.
 */
import type { DomainEvent } from '@hustle-ring/shared';
import type { SfxId } from './types.js';

/** Events whose sound depends only on their type. */
const BY_TYPE: Partial<Record<DomainEvent['type'], SfxId>> = {
  Moved: 'step',
  Entered: 'enter',
  Hired: 'hired',
  Raised: 'cashIn',
  Fired: 'fired',
  Refused: 'eventBad',
  Graduated: 'graduate',
  Enrolled: 'uiClick',
  Studied: 'uiClick',
  Relaxed: 'eventGood',
  ItemBought: 'cashOut',
  ItemSold: 'cashIn',
  ItemBroke: 'eventBad',
  ItemRepaired: 'uiClick',
  ItemsStolen: 'eventBad',
  MealEaten: 'uiClick',
  Starved: 'alarm',
  Spoiled: 'eventBad',
  RentPaid: 'cashOut',
  RentDue: 'alarm',
  ExtensionDenied: 'error',
  RentDebt: 'alarm',
  Evicted: 'eventBad',
  HomeMoved: 'eventGood',
  LoanTaken: 'cashIn',
  LoanPaid: 'cashOut',
  LoanMissed: 'alarm',
  LoanDefaulted: 'alarm',
  Subscribed: 'uiClick',
  Unsubscribed: 'uiClick',
  SubBilled: 'cashOut',
  CarBought: 'cashOut',
  CarSold: 'cashIn',
  GigStarted: 'uiClick',
  TurnEnded: 'turnEnd',
  Won: 'win',
  CommandRejected: 'error',
};

/**
 * The sound an event makes, or null when it is silent. Amount-carrying events pick their sound
 * from the sign, and the two events with a band or a goal in them pick from that.
 */
export function sfxForEvent(event: DomainEvent): SfxId | null {
  switch (event.type) {
    case 'MoneyChanged':
      return event.delta === 0 ? null : event.delta > 0 ? 'cashIn' : 'cashOut';
    case 'Worked':
    case 'GigWorked':
      return event.pay > 0 ? 'cashIn' : 'uiClick';
    case 'Deposited':
    case 'Withdrawn':
      return 'uiClick';
    case 'AssetBought':
      return 'cashOut';
    case 'AssetSold':
      return 'cashIn';
    case 'FoodBought':
      return 'cashOut';
    case 'LotteryResolved':
      return event.prize > 0 ? 'cashIn' : 'eventBad';
    case 'WellbeingBand':
      // Burnout and collapse are the two the player has to act on.
      return event.band === 'burnout' || event.band === 'collapse' ? 'alarm' : 'eventGood';
    case 'GoalMet':
      return 'eventGood';
    case 'GoalLost':
      return 'eventBad';
    case 'StatChanged':
      return null;
    default:
      return BY_TYPE[event.type] ?? null;
  }
}

/**
 * Event families carry their own tone in content, which the log already resolves; the caller
 * passes it so a good event sparkles and a bad one buzzes.
 */
export function sfxForEventTone(tone: 'good' | 'bad' | 'neutral' | undefined): SfxId | null {
  if (tone === 'good') return 'eventGood';
  if (tone === 'bad') return 'eventBad';
  return null;
}
