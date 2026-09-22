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

export interface TutorialStep {
  id: string;
  /** `data-testid` of the element to spotlight, or null to centre the card on the screen. */
  anchor: string | null;
  advance: Advance;
}

/** UX_SPEC 7.6 lists the tutorial's own fixed setup: one human and one Easy AI on a fixed seed. */
export const TUTORIAL_SEED = 'tutorial-1';
export const TUTORIAL_PACK = 'classic';
export const TUTORIAL_GOALS = 30;

/** The employment office, the first place the script sends the player. */
export const JOB_LOCATION = 'employment-office';

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  // 1. Welcome: goals and the 60-hour week.
  { id: 'welcome', anchor: 'hud', advance: { kind: 'manual' } },
  // 2. Travel to JobLink Center; hours per step and transport modes.
  { id: 'travel', anchor: `square-${JOB_LOCATION}`, advance: { kind: 'event', type: 'Entered' } },
  // 3. Apply for the entry job; requirements.
  { id: 'apply', anchor: 'location-panel', advance: { kind: 'event', type: 'Hired' } },
  // 4. Travel to the workplace and work one shift; pay, dependability, experience.
  { id: 'work', anchor: 'location-panel', advance: { kind: 'event', type: 'Worked' } },
  // 5. Buy a meal; starvation.
  { id: 'eat', anchor: 'location-panel', advance: { kind: 'event', type: 'MealEaten' } },
  // 6. Visit the university and enrol; degrees.
  { id: 'enrol', anchor: 'location-panel', advance: { kind: 'event', type: 'Enrolled' } },
  // 7. Go home and relax; happiness and wellbeing.
  { id: 'relax', anchor: 'location-panel', advance: { kind: 'event', type: 'Relaxed' } },
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
