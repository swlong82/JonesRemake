/**
 * SFX recipes (AUDIO_SPEC 8.2), jsfxr-style: a short oscillator or noise burst with an envelope.
 * Pure data plus one pure synth function, so the table is testable without a WebAudio context.
 */
import { SFX_IDS, type SfxId } from './types.js';

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface SfxTone {
  /** Semitone offset from the recipe's root, so a recipe is a shape rather than a pitch. */
  semitones: number;
  /** Seconds from the start of the sound. */
  at: number;
  duration: number;
}

export interface SfxRecipe {
  /** What it should sound like, in the spec's own words. */
  character: string;
  wave: Waveform;
  /** Root frequency in Hz before `opts.pitch`. */
  rootHz: number;
  /** Peak gain, 0..1, before the sfx and master channels scale it. */
  gain: number;
  attack: number;
  decay: number;
  /** Frequency sweep across the whole sound, in semitones; 0 is a flat tone. */
  sweepSemitones: number;
  /** Notes after the first; an empty list is a single blip. */
  tones: readonly SfxTone[];
}

const s = (semitones: number, at: number, duration: number): SfxTone => ({
  semitones,
  at,
  duration,
});

/** Every `SfxId` has exactly one recipe — asserted in `audio.test.ts`. */
export const SFX_RECIPES: Record<SfxId, SfxRecipe> = {
  uiClick: {
    character: '30ms tick',
    wave: 'square',
    rootHz: 880,
    gain: 0.12,
    attack: 0.001,
    decay: 0.029,
    sweepSemitones: 0,
    tones: [],
  },
  step: {
    character: 'soft blip, pitch rises with mode speed',
    wave: 'triangle',
    rootHz: 420,
    gain: 0.1,
    attack: 0.004,
    decay: 0.07,
    sweepSemitones: 2,
    tones: [],
  },
  enter: {
    character: 'two-note chime',
    wave: 'sine',
    rootHz: 660,
    gain: 0.16,
    attack: 0.005,
    decay: 0.16,
    sweepSemitones: 0,
    tones: [s(0, 0, 0.16), s(5, 0.11, 0.2)],
  },
  cashIn: {
    character: 'ascending arpeggio',
    wave: 'triangle',
    rootHz: 523.25,
    gain: 0.16,
    attack: 0.004,
    decay: 0.12,
    sweepSemitones: 0,
    tones: [s(0, 0, 0.1), s(4, 0.07, 0.1), s(7, 0.14, 0.14)],
  },
  cashOut: {
    character: 'descending blip',
    wave: 'triangle',
    rootHz: 392,
    gain: 0.14,
    attack: 0.004,
    decay: 0.12,
    sweepSemitones: -5,
    tones: [],
  },
  hired: {
    character: 'major triad',
    wave: 'sine',
    rootHz: 523.25,
    gain: 0.18,
    attack: 0.006,
    decay: 0.3,
    sweepSemitones: 0,
    tones: [s(0, 0, 0.3), s(4, 0, 0.3), s(7, 0, 0.3)],
  },
  fired: {
    character: 'minor fall',
    wave: 'sawtooth',
    rootHz: 392,
    gain: 0.16,
    attack: 0.006,
    decay: 0.34,
    sweepSemitones: -7,
    tones: [s(0, 0, 0.18), s(-3, 0.16, 0.26)],
  },
  graduate: {
    character: 'fanfare 4 notes',
    wave: 'square',
    rootHz: 523.25,
    gain: 0.15,
    attack: 0.005,
    decay: 0.16,
    sweepSemitones: 0,
    tones: [s(0, 0, 0.13), s(4, 0.12, 0.13), s(7, 0.24, 0.13), s(12, 0.36, 0.3)],
  },
  eventGood: {
    character: 'sparkle',
    wave: 'sine',
    rootHz: 1046.5,
    gain: 0.12,
    attack: 0.003,
    decay: 0.09,
    sweepSemitones: 7,
    tones: [s(0, 0, 0.08), s(7, 0.06, 0.08), s(12, 0.12, 0.12)],
  },
  eventBad: {
    character: 'low buzz',
    wave: 'sawtooth',
    rootHz: 110,
    gain: 0.14,
    attack: 0.01,
    decay: 0.35,
    sweepSemitones: -2,
    tones: [],
  },
  alarm: {
    character: 'two-tone alert',
    wave: 'square',
    rootHz: 740,
    gain: 0.14,
    attack: 0.004,
    decay: 0.14,
    sweepSemitones: 0,
    tones: [s(0, 0, 0.14), s(-5, 0.17, 0.18)],
  },
  turnEnd: {
    character: 'clock ding',
    wave: 'sine',
    rootHz: 987.77,
    gain: 0.14,
    attack: 0.003,
    decay: 0.45,
    sweepSemitones: 0,
    tones: [],
  },
  win: {
    character: 'fanfare 8 notes',
    wave: 'square',
    rootHz: 523.25,
    gain: 0.16,
    attack: 0.005,
    decay: 0.16,
    sweepSemitones: 0,
    tones: [
      s(0, 0, 0.14),
      s(4, 0.12, 0.14),
      s(7, 0.24, 0.14),
      s(12, 0.36, 0.14),
      s(7, 0.48, 0.14),
      s(12, 0.6, 0.14),
      s(16, 0.72, 0.14),
      s(19, 0.84, 0.5),
    ],
  },
  error: {
    character: 'short noise burst',
    wave: 'noise',
    rootHz: 220,
    gain: 0.1,
    attack: 0.001,
    decay: 0.11,
    sweepSemitones: 0,
    tones: [],
  },
};

/** Hz for a semitone offset from a root, equal temperament. */
export function hzAt(rootHz: number, semitones: number): number {
  return rootHz * Math.pow(2, semitones / 12);
}

/** The tones a recipe plays, normalised so a single-blip recipe is one tone at t=0. */
export function tonesOf(recipe: SfxRecipe): readonly SfxTone[] {
  return recipe.tones.length > 0
    ? recipe.tones
    : [{ semitones: 0, at: 0, duration: recipe.attack + recipe.decay }];
}

/** Total length of a recipe in seconds, used to schedule and to stop the graph cleanly. */
export function lengthOf(recipe: SfxRecipe): number {
  let end = 0;
  for (const t of tonesOf(recipe)) end = Math.max(end, t.at + t.duration);
  return end + recipe.attack;
}

export const SFX_RECIPE_IDS: readonly SfxId[] = SFX_IDS;
