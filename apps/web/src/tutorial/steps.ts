/**
 * Tutorial script (UX_SPEC 7.6). Ten steps, each one spotlighting a single element and advancing
 * on the `DomainEvent` that proves the player did the thing — so the tutorial follows the game
 * rather than driving it. Pure data plus two pure helpers, so the script is unit-tested without a
 * rendered screen.
 */
import type { DomainEvent } from '@hustle-ring/shared';

/** What moves the tutorial on. */
export type Advance =
  | { kind: 'event'; type: DomainEvent['type']; /** Location the event must name. */ at?: string }
  | { kind: 'manual' };

/** Where a step sends the player: a location, the workplace of the job they hold, or home. */
export type TravelTarget = { kind: 'location'; id: string } | { kind: 'job' } | { kind: 'home' };

export interface TutorialStep {
  id: string;
  /** `data-testid` of the element to spotlight, or null to centre the card on the screen. */
  anchor: string | null;
  advance: Advance;
  /**
   * A step that needs the player somewhere else. Getting there is input the step needs, so the
   * spotlight follows the journey — travel sheet, destination square, then its door — before it
   * settles on `anchor` (see `anchorFor`).
   */
  travelTo?: TravelTarget;
}

/** What the spotlight needs to know about the viewer to follow a step's journey. */
export interface TutorialView {
  location: string;
  inside: boolean;
  travelOpen: boolean;
  /** The End turn confirmation is showing. */
  endTurnPending: boolean;
  /** Workplace of the viewer's current job, if any. */
  jobWorkplace: string | null;
  /** The location of the viewer's home. */
  home: string | null;
}

/**
 * The element the spotlight belongs on right now (UX 7.6 "blocks unrelated input"): the input a
 * step needs includes getting to where it happens, so a travel step lights the open travel sheet,
 * then the destination square, then the location panel with its Enter button — and only then the
 * step's own anchor.
 */
export function anchorFor(step: TutorialStep, view: TutorialView): string | null {
  if (step.travelTo !== undefined) {
    const t = step.travelTo;
    const dest = t.kind === 'job' ? view.jobWorkplace : t.kind === 'home' ? view.home : t.id;
    if (dest !== null) {
      if (view.travelOpen) return 'travel-sheet';
      if (view.location !== dest) return `square-${dest}`;
      if (!view.inside) return 'location-panel';
    }
  }
  // Ending the turn takes a confirmation; while it shows, that is the input the step needs.
  if (step.anchor === 'end-turn' && view.endTurnPending) return 'end-turn-dialog';
  return step.anchor;
}

/** UX_SPEC 7.6 lists the tutorial's own fixed setup: one human and one Easy AI on a fixed seed. */
export const TUTORIAL_SEED = 'tutorial-1';
export const TUTORIAL_PACK = 'classic';
export const TUTORIAL_GOALS = 30;

/** The employment office, the first place the script sends the player. */
export const JOB_LOCATION = 'employment-office';

/** Where the tutorial buys its meal: the classic burger joint sells them. */
export const MEAL_LOCATION = 'burger-joint';

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  // 1. Welcome: goals and the 60-hour week.
  { id: 'welcome', anchor: 'hud', advance: { kind: 'manual' } },
  // 2. Travel to JobLink Center; hours per step and transport modes.
  {
    id: 'travel',
    anchor: 'location-panel',
    advance: { kind: 'event', type: 'Entered' },
    travelTo: { kind: 'location', id: JOB_LOCATION },
  },
  // 3. Apply for the entry job; requirements.
  { id: 'apply', anchor: 'location-panel', advance: { kind: 'event', type: 'Hired' } },
  // 4. Travel to the workplace and work one shift; pay, dependability, experience.
  {
    id: 'work',
    anchor: 'location-panel',
    advance: { kind: 'event', type: 'Worked' },
    travelTo: { kind: 'job' },
  },
  // 5. Buy a meal; starvation.
  {
    id: 'eat',
    anchor: 'location-panel',
    advance: { kind: 'event', type: 'MealEaten' },
    travelTo: { kind: 'location', id: MEAL_LOCATION },
  },
  // 6. Visit the university and enrol; degrees.
  {
    id: 'enrol',
    anchor: 'location-panel',
    advance: { kind: 'event', type: 'Enrolled' },
    travelTo: { kind: 'location', id: 'university' },
  },
  // 7. Go home and relax; happiness and wellbeing.
  {
    id: 'relax',
    anchor: 'location-panel',
    advance: { kind: 'event', type: 'Relaxed' },
    travelTo: { kind: 'home' },
  },
  // 8. End the turn; rent every four weeks and events.
  { id: 'endTurn', anchor: 'end-turn', advance: { kind: 'event', type: 'TurnEnded' } },
  // 9. Week 2: the bank, one investment preview, and the street-theft warning.
  { id: 'bank', anchor: 'hud', advance: { kind: 'manual' } },
  // 10. Done: a tooltip tour of the HUD, then normal play continues.
  { id: 'done', anchor: 'hud', advance: { kind: 'manual' } },
];

export const TUTORIAL_STEP_IDS = TUTORIAL_STEPS.map((s) => s.id);

/** True when this event is the one the step is waiting for. */
export function advancesOn(step: TutorialStep, event: DomainEvent): boolean {
  if (step.advance.kind !== 'event') return false;
  if (event.type !== step.advance.type) return false;
  if (step.advance.at === undefined) return true;
  return 'loc' in event && event.loc === step.advance.at;
}

/** i18n keys for a step, so every string stays out of the component (CLAUDE.md 1.3). */
export function stepKeys(step: TutorialStep): { title: string; body: string } {
  return { title: `tutorial.${step.id}.title`, body: `tutorial.${step.id}.body` };
}
