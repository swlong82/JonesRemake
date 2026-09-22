/**
 * Tutorial state (UX_SPEC 7.6). A tiny store beside the game store rather than inside it: the
 * tutorial observes `DomainEvent`s and never mutates game state, so the single-mutation-path
 * invariant (CLAUDE.md 1.3) is untouched.
 */
import { create } from 'zustand';
import type { DomainEvent } from '@hustle-ring/shared';
import { useSettings } from '../store/settings.js';
import { advancesOn, TUTORIAL_STEPS, type TutorialStep } from './steps.js';

export interface TutorialStore {
  active: boolean;
  index: number;
  /** Highest `seq` already considered, so a re-render cannot double-advance. */
  lastSeq: number;
  start: () => void;
  /** Advance a `manual` step; an `event` step ignores it. */
  next: () => void;
  /** Leave the tutorial; UX 7.6 allows it at any time. */
  skip: () => void;
  /** Feed the store's event log; advances at most one step per call. */
  observe: (log: readonly { seq: number; event: DomainEvent }[]) => void;
}

export const useTutorial = create<TutorialStore>((set, get) => ({
  active: false,
  index: 0,
  lastSeq: -1,
  start() {
    set({ active: true, index: 0, lastSeq: -1 });
  },
  next() {
    const { active, index } = get();
    if (!active) return;
    const step = TUTORIAL_STEPS[index];
    if (step?.advance.kind !== 'manual') return;
    if (index + 1 >= TUTORIAL_STEPS.length) {
      get().skip();
      return;
    }
    set({ index: index + 1 });
  },
  skip() {
    set({ active: false, index: 0, lastSeq: -1 });
    useSettings.getState().update({ tutorialSeen: true });
  },
  observe(log) {
    const { active, index, lastSeq } = get();
    if (!active || index >= TUTORIAL_STEPS.length) return;
    let at = index;
    let seq = lastSeq;
    let finished = false;
    for (const entry of log) {
      if (entry.seq <= lastSeq) continue;
      seq = Math.max(seq, entry.seq);
      if (!advancesOn(TUTORIAL_STEPS[at]!, entry.event)) continue;
      if (at + 1 >= TUTORIAL_STEPS.length) {
        finished = true;
        break;
      }
      at += 1;
    }
    if (finished) {
      get().skip();
      return;
    }
    if (at !== index || seq !== lastSeq) set({ index: at, lastSeq: seq });
  },
}));

/** The step being shown, or null when the tutorial is not running. */
export function currentStep(): TutorialStep | null {
  const { active, index } = useTutorial.getState();
  return active ? (TUTORIAL_STEPS[index] ?? null) : null;
}
