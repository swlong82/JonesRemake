/**
 * Coach marks (M12.4): a one-time tip the first time a system the tutorial does not cover shows up
 * in the location panel (gigs, loans, subscriptions, cars, investing, transit, delivery, online
 * study). Pure: a tip is chosen from the command types on offer and the ids already seen.
 */
export type CoachId =
  'gig' | 'loan' | 'subscription' | 'car' | 'invest' | 'transit' | 'delivery' | 'online';

/** Which offered command types introduce which tip, in the order tips are shown. */
export const COACH_TRIGGERS: readonly { id: CoachId; commands: readonly string[] }[] = [
  { id: 'gig', commands: ['GigSignup', 'GigShift'] },
  { id: 'loan', commands: ['TakeLoan', 'RepayLoan'] },
  { id: 'subscription', commands: ['Subscribe', 'Unsubscribe'] },
  { id: 'car', commands: ['BuyCar', 'SellCar', 'RepairCar'] },
  { id: 'invest', commands: ['BuyAsset', 'SellAsset'] },
  { id: 'transit', commands: ['BuyTransitPass'] },
  { id: 'delivery', commands: ['OrderDelivery'] },
  { id: 'online', commands: ['StudyOnline'] },
];

export function pickCoach(offered: readonly string[], seen: readonly string[]): CoachId | null {
  for (const { id, commands } of COACH_TRIGGERS) {
    if (seen.includes(id)) continue;
    if (commands.some((c) => offered.includes(c))) return id;
  }
  return null;
}
