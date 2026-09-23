/**
 * Audio contract (AUDIO_SPEC 8.1). Everything is synthesised at runtime — no audio files ship,
 * and nothing is fetched. The engine has no audio knowledge: sound is driven by `DomainEvent`s
 * through the mapping table in `eventMap.ts`.
 */

/** AUDIO_SPEC 8.2, in table order. */
export const SFX_IDS = [
  'uiClick',
  'step',
  'enter',
  'cashIn',
  'cashOut',
  'hired',
  'fired',
  'graduate',
  'eventGood',
  'eventBad',
  'alarm',
  'turnEnd',
  'win',
  'error',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

/** AUDIO_SPEC 8.3, in table order. */
export const MUSIC_MOODS = ['menu', 'normal', 'boom', 'recession', 'tension', 'victory'] as const;

export type MusicMood = (typeof MUSIC_MOODS)[number];

export type AudioChannel = 'music' | 'sfx' | 'master';

export interface AudioBus {
  /** Call on the first user gesture; browsers refuse to start a context before one. */
  unlock(): Promise<void>;
  playSfx(id: SfxId, opts?: { pitch?: number }): void;
  /** Crossfades over `MOOD_CROSSFADE_SECONDS`. */
  setMood(mood: MusicMood): void;
  setVolume(channel: AudioChannel, v: number): void;
  mute(muted: boolean): void;
  /** Release the audio context; the bus is unusable afterwards. */
  dispose(): void;
}

/** AUDIO_SPEC 8.1: "crossfade 1.5s". */
export const MOOD_CROSSFADE_SECONDS = 1.5;

/** A running music generator. The implementation is the lazy `music.ts` chunk (ADR-0036). */
export interface MusicPlayer {
  /** Fade this mood in over `MOOD_CROSSFADE_SECONDS` and keep generating. */
  start(): void;
  /** Fade out and release every node. */
  stop(): void;
}

/**
 * The shape `WebAudioBus` expects from the lazily imported music chunk. Declaring it here rather
 * than as an `import()` type keeps the dependency one-way and the chunk out of the entry bundle.
 */
export interface MusicModule {
  createMusicPlayer(
    ctx: AudioContext,
    destination: AudioNode,
    mood: MusicMood,
    seed: number,
  ): MusicPlayer;
}
