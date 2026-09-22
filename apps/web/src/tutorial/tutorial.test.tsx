/** M7.3: the UX 7.6 tutorial — spotlight, event-driven steps, skippable and replayable. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DomainEvent } from '@hustle-ring/shared';
import { useFlags } from '../flags/appFlags';
import { useGame } from '../store/gameStore';
import { useSettings } from '../store/settings';
import { Spotlight } from './Spotlight';
import { advancesOn, stepKeys, TUTORIAL_STEPS, TUTORIAL_STEP_IDS } from './steps';
import { tutorialConfig } from './startTutorial';
import { useTutorial } from './useTutorial';

type EventBody<T = DomainEvent> = T extends DomainEvent
  ? Omit<T, 'seq' | 'week'> & { week?: number }
  : never;

const entry = (
  seq: number,
  body: EventBody,
): { seq: number; week: number; seat: number | null; event: DomainEvent } => ({
  seq,
  week: 1,
  seat: 0,
  event: { week: 1, ...body, seq },
});

beforeEach(() => {
  useGame.getState().quit();
  useSettings.getState().resetData();
  useFlags.getState().reset({ env: {}, search: '' });
  useTutorial.setState({ active: false, index: 0, lastSeq: -1 });
});

describe('tutorial script (UX 7.6)', () => {
  it('is the ten steps the spec lists, in order', () => {
    expect(TUTORIAL_STEP_IDS).toEqual([
      'welcome',
      'travel',
      'apply',
      'work',
      'eat',
      'enrol',
      'relax',
      'endTurn',
      'bank',
      'done',
    ]);
  });

  it('spotlights one element per step and names its own strings', () => {
    for (const step of TUTORIAL_STEPS) {
      // Every step in the shipped script names an element; the type allows a centred card too.
      expect(typeof step.anchor).toBe('string');
      const keys = stepKeys(step);
      expect(keys.title).toBe(`tutorial.${step.id}.title`);
      expect(keys.body).toBe(`tutorial.${step.id}.body`);
    }
  });

  it('advances only on the event the step is waiting for', () => {
    const travel = TUTORIAL_STEPS[1]!;
    expect(advancesOn(travel, entry(1, { type: 'Entered', seat: 0, loc: 'x' }).event)).toBe(true);
    expect(advancesOn(travel, entry(1, { type: 'Worked', seat: 0, hours: 6, pay: 10 }).event)).toBe(
      false,
    );
    // A manual step is never moved by an event.
    expect(
      advancesOn(TUTORIAL_STEPS[0]!, entry(1, { type: 'Entered', seat: 0, loc: 'x' }).event),
    ).toBe(false);
  });

  it('runs one human against one Easy AI on the spec’s fixed seed', () => {
    const config = tutorialConfig();
    expect(config.seed).toBe('tutorial-1');
    expect(config.seats).toHaveLength(2);
    expect(config.seats[0]!.controller).toBe('human-local');
    expect(config.seats[1]!.ai?.difficulty).toBe('easy');
  });
});

describe('tutorial state', () => {
  it('advances a manual step on next, and never on an event', () => {
    const store = useTutorial.getState();
    store.start();
    expect(useTutorial.getState().index).toBe(0);
    useTutorial.getState().observe([entry(1, { type: 'Entered', seat: 0, loc: 'x' })]);
    expect(useTutorial.getState().index).toBe(0);
    useTutorial.getState().next();
    expect(useTutorial.getState().index).toBe(1);
  });

  it('advances an event step on its event, and ignores next', () => {
    useTutorial.getState().start();
    useTutorial.getState().next();
    expect(useTutorial.getState().index).toBe(1);
    useTutorial.getState().next();
    expect(useTutorial.getState().index).toBe(1);
    useTutorial.getState().observe([entry(1, { type: 'Entered', seat: 0, loc: 'x' })]);
    expect(useTutorial.getState().index).toBe(2);
  });

  it('never replays an event it has already seen', () => {
    useTutorial.getState().start();
    useTutorial.getState().next();
    const log = [entry(1, { type: 'Entered', seat: 0, loc: 'x' })];
    useTutorial.getState().observe(log);
    useTutorial.getState().observe(log);
    expect(useTutorial.getState().index).toBe(2);
  });

  it('remembers that the player has seen it once they skip', () => {
    useTutorial.getState().start();
    expect(useSettings.getState().settings.tutorialSeen).toBe(false);
    useTutorial.getState().skip();
    expect(useTutorial.getState().active).toBe(false);
    expect(useSettings.getState().settings.tutorialSeen).toBe(true);
  });

  it('finishes on the last step', () => {
    useTutorial.setState({ active: true, index: TUTORIAL_STEPS.length - 1, lastSeq: -1 });
    useTutorial.getState().next();
    expect(useTutorial.getState().active).toBe(false);
    expect(useSettings.getState().settings.tutorialSeen).toBe(true);
  });
});

describe('spotlight', () => {
  it('renders nothing while the tutorial is off', () => {
    render(<Spotlight />);
    expect(screen.queryByTestId('tutorial')).toBeNull();
  });

  it('shows the step, its progress and a skip, and dims the page', () => {
    useTutorial.getState().start();
    render(<Spotlight />);
    expect(screen.getByTestId('tutorial-card')).toBeTruthy();
    expect(screen.getByTestId('tutorial-progress').textContent).toContain('1');
    expect(screen.getByTestId('tutorial-title').textContent).toBeTruthy();
    fireEvent.click(screen.getByTestId('tutorial-next'));
    expect(useTutorial.getState().index).toBe(1);
    fireEvent.click(screen.getByTestId('tutorial-skip'));
    expect(useTutorial.getState().active).toBe(false);
    expect(screen.queryByTestId('tutorial')).toBeNull();
  });

  it('offers no Next on a step the game has to advance', () => {
    useTutorial.setState({ active: true, index: 1, lastSeq: -1 });
    render(<Spotlight />);
    expect(screen.queryByTestId('tutorial-next')).toBeNull();
    expect(screen.getByTestId('tutorial-skip')).toBeTruthy();
  });
});
