# 13. docs/STATE_MODEL.md

## 13.1 Numeric representation (cross-engine determinism)

- Money: integer dollars. Asset prices: integer cents. Hours: integer half-hours (`hoursLeft: 120` = 60h; GDD hour costs ×2). Probabilities and percentages: basis points (10000 = 100%). Economy index: integer per-mille (1000 = 1.0). Stats: integers.
- Engine MUST NOT call `Math.exp/log/pow/sin/cos/sqrt` or use floating division for game values; `mulDiv(a, b, c) = Math.floor((a * b + (c >> 1)) / c)` on integers is the only scaling primitive (lint rule bans the listed Math functions in `packages/engine`).
- Normal noise N(0, σ): Irwin–Hall approximation `(Σ₁² uniform(0..10000) − 60000) × σ / 10000` (twelve uniforms), integer arithmetic.
- Result: `stateHash` is identical across Node, Chromium, Firefox, Safari (CI runs the replay test on Node and Chromium and compares hashes).

## 13.2 PlayerState

```ts
export interface PlayerState {
  seat: number; name: string; color: PaletteId; shape: TokenShape; cityId: CityId;
  controller: 'human-local' | 'ai' | 'remote'; ai?: { difficulty: Difficulty; personality: PersonalityId };
  goals: { wealth: number; happiness: number; education: number; career: number };
  cash: number; bank: number; investments: Record<AssetId, { units: number; costBasisCents: number }>;
  location: LocationId; inside: boolean; hoursLeft: number; // half-hours
  turn: { jobsTurnedDown: JobId[]; relaxed: boolean; eventsFired: EventId[]; lockedActions: string[] };
  happiness: number; dependability: number; experience: number; relaxation: number;
  maxDependability: number; maxExperience: number;
  job: { jobId: JobId; wage: number; raises: number } | null;
  degrees: DegreeId[]; enrolled: Record<DegreeId, { lessonsLeft: number }>;
  home: { tier: HomeTier; rentLocked: number; paidThroughWeek: number; debt: number; debtSinceWeek: number | null; extensionsBlocked: boolean };
  items: Array<{ uid: string; itemId: ItemId; condition: 'ok' | 'broken'; boughtWeek: number; boughtAt: LocationId }>;
  food: { fridgeUnits: number; unrefrigeratedUnits: number; mealPending: MealId | null };
  clothing: Array<{ tier: UniformTier; weeksLeft: number }>;
  lotteryTickets: number;
  modules: Record<ModuleId, unknown>;   // wellbeing, transport, gig, loans, subscriptions slices
  stats: { earned: number; workSessions: number; lessons: number; eventsSuffered: number };
  history: Array<{ week: number; goals: [number, number, number, number] }>;
}
```

Top-level `GameState` per 5.3 plus `worldId`, `debugTouched: boolean` (immutable once set), `modules`, `pawnShop: Array<{ uid; itemId; sellerSeat; listedWeek; priceCents }>`, `news: { phaseHint: EconPhase; accurate: boolean }`, `engineVersion`, `packId`, `packVersion`.

## 13.3 ErrorCode (complete)

`ERR_NOT_YOUR_TURN`, `ERR_GAME_OVER`, `ERR_NOT_ENOUGH_HOURS`, `ERR_NOT_ENOUGH_CASH`, `ERR_NOT_ENOUGH_BANK`, `ERR_NOT_AT_LOCATION`, `ERR_NOT_INSIDE`, `ERR_ALREADY_INSIDE`, `ERR_LOCATION_CLOSED`, `ERR_UNKNOWN_ID`, `ERR_INVALID_AMOUNT`, `ERR_REQ_EXPERIENCE`, `ERR_REQ_DEPENDABILITY`, `ERR_REQ_EDUCATION`, `ERR_NO_OPENINGS`, `ERR_ALREADY_HAVE_JOB`, `ERR_NO_JOB`, `ERR_UNIFORM_REQUIRED`, `ERR_RAISE_NOT_ELIGIBLE`, `ERR_NOT_ENROLLED`, `ERR_PREREQ_MISSING`, `ERR_ALREADY_HAS_DEGREE`, `ERR_MAX_COURSES`, `ERR_ALREADY_RELAXED`, `ERR_NO_FRIDGE`, `ERR_FRIDGE_FULL`, `ERR_ITEM_NOT_OWNED`, `ERR_ITEM_NOT_FOR_SALE`, `ERR_ITEM_BROKEN`, `ERR_PAWN_LOCKED`, `ERR_RENT_NOT_DUE`, `ERR_EXTENSION_DENIED`, `ERR_ALREADY_IN_TIER`, `ERR_FEATURE_OFF`, `ERR_UNLOCK_MISSING`, `ERR_LOAN_DENIED`, `ERR_LOAN_LIMIT`, `ERR_NO_LOAN`, `ERR_SUB_ACTIVE`, `ERR_SUB_INACTIVE`, `ERR_SUB_WRONG_LOCATION`, `ERR_NO_CAR`, `ERR_HAS_CAR`, `ERR_GIG_REQUIREMENT`, `ERR_MARKET_CLOSED`, `ERR_SCHEDULER_STUB`. Each has an i18n key `error.<code>` with params.

## 13.4 DomainEvent (complete)

`TurnStarted{seat, week}`, `TurnEnded{seat}`, `WeekAdvanced{week}`, `EconomyTicked{econ, phase}`, `Moved{seat, from, to, mode, hours}`, `Entered{seat, loc}`, `Exited{seat, loc}`, `HoursSpent{seat, hours, reason}`, `MoneyChanged{seat, account, delta, reason}`, `StatChanged{seat, stat, delta, reason}`, `Hired{seat, jobId}`, `Refused{seat, jobId, code}`, `Raised{seat, wage}`, `Worked{seat, hours, pay}`, `Fired{seat, reason}`, `GigStarted{seat, gigId}`, `GigWorked{seat, hours, pay}`, `Enrolled{seat, degreeId}`, `Studied{seat, degreeId, counted}`, `Graduated{seat, degreeId}`, `Relaxed{seat}`, `ItemBought{seat, itemId}`, `ItemSold{seat, itemId}`, `ItemBroke{seat, uid}`, `ItemRepaired{seat, uid}`, `ItemsStolen{seat, uids}`, `FoodBought{seat, units}`, `MealEaten{seat}`, `Starved{seat}`, `Spoiled{seat}`, `RentPaid{seat, months}`, `RentDue{seat}`, `RentDebt{seat}`, `Evicted{seat}`, `HomeMoved{seat, tier}`, `Deposited{seat, amount}`, `Withdrawn{seat, amount}`, `AssetBought{seat, assetId, units}`, `AssetSold{seat, assetId, units}`, `MarketMoved{prices}`, `LoanTaken{seat}`, `LoanPaid{seat}`, `LoanMissed{seat}`, `LoanDefaulted{seat}`, `Subscribed{seat, subId}`, `Unsubscribed{seat, subId}`, `SubBilled{seat, total}`, `CarBought{seat}`, `CarSold{seat}`, `EventFired{seat, eventId, effects}`, `LotteryResolved{seat, prize}`, `WellbeingBand{seat, band}`, `GoalMet{seat, goal}`, `GoalLost{seat, goal}`, `Won{seat, week}`, `CommandRejected{seat, type, code}`. Every event carries `seq` and `week`.

## 13.5 Location open rules

`open: 'always' | 'rent-week' | { weeks: number[] }`. `rent-week` (classic rent office / City Services) is open in week 4k, or any week for a player employed there, or while that player holds an extension.
