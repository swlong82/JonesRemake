/**
 * Procedural music (AUDIO_SPEC 8.3). Loaded as a lazy chunk: nothing imports this module
 * statically, `WebAudioBus.setMood` reaches it with `import()` after the first gesture
 * (asserted in `audio.test.ts`).
 *
 * Generative rules from the spec: the lead is a weighted random walk inside the mood's scale
 * (70% step, 30% leap) with a new phrase every 8 bars, seeded from a UI-side RNG so music can
 * never touch game determinism (ADR-0036).
 */
import { MOOD_CROSSFADE_SECONDS, type MusicMood, type MusicPlayer } from './types.js';

export interface MoodSpec {
  /** AUDIO_SPEC 8.3 "When" column, for the mapping table's own documentation. */
  when: string;
  bpm: number;
  /** Semitone offsets from the root, one octave of the mood's scale. */
  scale: readonly number[];
  /** Root note in Hz. */
  rootHz: number;
  /** Chord roots, in scale degrees, one per bar of the loop. */
  progression: readonly number[];
  /** Pad cutoff in Hz; low values are the spec's "filtered" and "low-pass" moods. */
  cutoffHz: number;
  /** A drum layer on the offbeat (hi-hats) or on the beat (heartbeat kick). */
  percussion: 'none' | 'light' | 'hats' | 'heartbeat';
  /** `victory` plays its progression once and then stops. */
  once: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
const PENTATONIC = [0, 2, 4, 7, 9] as const;

export const MOODS: Record<MusicMood, MoodSpec> = {
  menu: {
    when: 'title/setup',
    bpm: 90,
    scale: MAJOR,
    rootHz: 261.63,
    progression: [0, 5, 3, 4],
    cutoffHz: 2200,
    percussion: 'none',
    once: false,
  },
  normal: {
    when: 'econ Stable',
    bpm: 100,
    scale: PENTATONIC,
    rootHz: 261.63,
    progression: [0, 0, 3, 4, 0, 5, 3, 4],
    cutoffHz: 2600,
    percussion: 'light',
    once: false,
  },
  boom: {
    when: 'econ Boom',
    bpm: 112,
    scale: MAJOR,
    rootHz: 293.66,
    progression: [0, 4, 5, 3, 0, 4, 5, 4],
    cutoffHz: 3400,
    percussion: 'hats',
    once: false,
  },
  recession: {
    when: 'econ Recession',
    bpm: 84,
    scale: MINOR,
    rootHz: 220,
    progression: [0, 0, 5, 4],
    cutoffHz: 900,
    percussion: 'none',
    once: false,
  },
  tension: {
    when: 'active player wellbeing < 25 or rent debt',
    bpm: 96,
    scale: MINOR,
    rootHz: 174.61,
    progression: [0, 0, 0, 0],
    cutoffHz: 600,
    percussion: 'heartbeat',
    once: false,
  },
  victory: {
    when: 'end screen',
    bpm: 104,
    scale: MAJOR,
    rootHz: 329.63,
    progression: [0, 3, 4, 0, 5, 3, 4, 0, 0, 3, 4, 0, 5, 4, 0, 0],
    cutoffHz: 3000,
    percussion: 'light',
    once: true,
  },
};

/** A small xorshift so the lead is reproducible per session and never touches the game RNG. */
export class MusicRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed || 0x9e3779b9;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

/** Bars per generated phrase (AUDIO_SPEC 8.3: "new phrase every 8 bars"). */
export const PHRASE_BARS = 8;
/** Chance the lead steps to an adjacent scale degree rather than leaping (8.3: 70%). */
export const STEP_CHANCE = 0.7;

/**
 * One phrase of lead notes as scale-degree indices. Pure, so the generative rule is unit-tested
 * without a WebAudio context.
 */
export function phrase(rng: MusicRng, scaleLength: number, notes: number): number[] {
  const out: number[] = [];
  let degree = 0;
  for (let i = 0; i < notes; i++) {
    out.push(degree);
    const step = rng.next() < STEP_CHANCE ? 1 : 2 + Math.floor(rng.next() * 3);
    degree += rng.next() < 0.5 ? -step : step;
    // Keep the walk inside two octaves of the scale by reflecting at the edges.
    const span = scaleLength * 2;
    if (degree < 0) degree = -degree;
    if (degree > span) degree = span - (degree - span);
  }
  return out;
}

/** Hz of a scale degree, wrapping into octaves. */
export function degreeHz(spec: MoodSpec, degree: number): number {
  const len = spec.scale.length;
  const octave = Math.floor(degree / len);
  const semis = spec.scale[((degree % len) + len) % len]! + 12 * octave;
  return spec.rootHz * Math.pow(2, semis / 12);
}

/**
 * Schedule the mood on a live context. Everything is oscillators and a filter — no samples, no
 * fetches (CLAUDE.md 1.3: no third-party assets, no network at runtime).
 */
export function createMusicPlayer(
  ctx: AudioContext,
  destination: AudioNode,
  mood: MusicMood,
  seed: number,
): MusicPlayer {
  const spec = MOODS[mood];
  const rng = new MusicRng(seed);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.cutoffHz;
  filter.connect(gain);
  gain.connect(destination);

  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBar = 0;
  let stopped = false;

  const note = (hz: number, at: number, dur: number, level: number, wave: OscillatorType): void => {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = hz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    env.connect(filter);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  const scheduleBar = (index: number, at: number): void => {
    const chordRoot = spec.progression[index % spec.progression.length]!;
    // Pad: the chord's root and fifth, held for the bar.
    note(degreeHz(spec, chordRoot) / 2, at, bar, 0.05, 'triangle');
    note(degreeHz(spec, chordRoot + 4) / 2, at, bar, 0.035, 'sine');
    // Lead: a fresh phrase every PHRASE_BARS, one note per beat.
    const lead = phrase(rng, spec.scale.length, 4);
    lead.forEach((degree, i) => {
      note(degreeHz(spec, chordRoot + degree), at + i * beat, beat * 0.8, 0.045, 'square');
    });
    if (spec.percussion === 'hats' || spec.percussion === 'light') {
      const every = spec.percussion === 'hats' ? beat / 2 : beat;
      for (let t = 0; t < bar; t += every) note(5000, at + t, 0.03, 0.02, 'square');
    }
    if (spec.percussion === 'heartbeat') {
      note(70, at, 0.16, 0.08, 'sine');
      note(70, at + beat * 0.35, 0.16, 0.05, 'sine');
    }
  };

  return {
    start(): void {
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + MOOD_CROSSFADE_SECONDS);
      nextBar = now + 0.05;
      let index = 0;
      const pump = (): void => {
        if (stopped) return;
        // Keep two bars queued; `once` moods stop after their progression.
        while (nextBar < ctx.currentTime + bar * 2) {
          if (spec.once && index >= spec.progression.length) {
            this.stop();
            return;
          }
          scheduleBar(index++, nextBar);
          nextBar += bar;
        }
      };
      pump();
      timer = setInterval(pump, Math.max(200, bar * 500));
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearInterval(timer);
      timer = null;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + MOOD_CROSSFADE_SECONDS);
      setTimeout(
        () => {
          gain.disconnect();
          filter.disconnect();
        },
        (MOOD_CROSSFADE_SECONDS + 0.2) * 1000,
      );
    },
  };
}
