/**
 * WebAudio implementation of the bus (AUDIO_SPEC 8.1). SFX are oscillator/noise recipes rendered
 * on the fly; music is a lazy chunk imported only after the first gesture, so nothing about it is
 * in the initial bundle. `createAudioBus` falls back to `NullAudioBus` wherever WebAudio is
 * missing or refuses to start.
 */
import { NullAudioBus } from './NullAudioBus.js';
import { hzAt, SFX_RECIPES, tonesOf, type SfxRecipe } from './sfx.recipes.js';
import {
  MOOD_CROSSFADE_SECONDS,
  type AudioBus,
  type AudioChannel,
  type MusicModule,
  type MusicMood,
  type MusicPlayer,
  type SfxId,
} from './types.js';

/** Two seconds of white noise, generated once and reused by every noise recipe. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0x8000_0000 - 1) * 0.6;
  }
  return buffer;
}

export class WebAudioBus implements AudioBus {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly sfxGain: GainNode;
  private readonly musicGain: GainNode;
  private noise: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  private mood: MusicMood | null = null;
  private musicModule: MusicModule | null = null;
  private loading: Promise<MusicModule> | null = null;
  private readonly seed: number;
  private volumes: Record<AudioChannel, number> = { music: 0.6, sfx: 0.8, master: 1 };
  private muted = false;
  private disposed = false;

  constructor(ctx: AudioContext, seed = 0x6d2b79f5) {
    this.ctx = ctx;
    this.seed = seed;
    this.master = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyGains();
  }

  private applyGains(): void {
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.volumes.music;
  }

  async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  playSfx(id: SfxId, opts?: { pitch?: number }): void {
    if (this.disposed || this.muted || this.volumes.sfx === 0) return;
    const recipe = SFX_RECIPES[id];
    const start = this.ctx.currentTime + 0.001;
    const pitch = opts?.pitch ?? 1;
    for (const tone of tonesOf(recipe)) {
      this.renderTone(recipe, tone.semitones, start + tone.at, tone.duration, pitch);
    }
  }

  private renderTone(
    recipe: SfxRecipe,
    semitones: number,
    at: number,
    duration: number,
    pitch: number,
  ): void {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(recipe.gain, at + recipe.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    env.connect(this.sfxGain);
    const hz = hzAt(recipe.rootHz, semitones) * pitch;
    if (recipe.wave === 'noise') {
      this.noise ??= noiseBuffer(this.ctx);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.connect(env);
      src.start(at);
      src.stop(at + duration);
      return;
    }
    const osc = this.ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(hz, at);
    if (recipe.sweepSemitones !== 0)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, hzAt(hz, recipe.sweepSemitones)),
        at + duration,
      );
    osc.connect(env);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  setMood(mood: MusicMood): void {
    if (this.disposed || this.mood === mood) return;
    this.mood = mood;
    this.music?.stop();
    this.music = null;
    if (this.volumes.music === 0 || this.muted) return;
    void this.withMusic((mod) => {
      // A later mood change while the chunk was loading wins.
      if (this.disposed || this.mood !== mood) return;
      this.music = mod.createMusicPlayer(this.ctx, this.musicGain, mood, this.seed);
      this.music.start();
    });
  }

  /** The lazy chunk (AUDIO_SPEC 8.1: "music via … loaded as a lazy chunk after first gesture"). */
  private async withMusic(fn: (mod: MusicModule) => void): Promise<void> {
    if (this.musicModule) {
      fn(this.musicModule);
      return;
    }
    this.loading ??= import('./music.js');
    const mod = await this.loading;
    this.musicModule = mod;
    fn(mod);
  }

  setVolume(channel: AudioChannel, v: number): void {
    this.volumes = { ...this.volumes, [channel]: Math.max(0, Math.min(1, v)) };
    this.applyGains();
    if (channel !== 'sfx' && this.volumes.music === 0) {
      this.music?.stop();
      this.music = null;
    }
  }

  mute(muted: boolean): void {
    this.muted = muted;
    this.applyGains();
  }

  /** AUDIO_SPEC 8.1: pause the music while the document is hidden. */
  setHidden(hidden: boolean): void {
    if (hidden) {
      this.music?.stop();
      this.music = null;
    } else if (this.mood !== null && this.music === null) {
      const mood = this.mood;
      this.mood = null;
      this.setMood(mood);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.music?.stop();
    this.music = null;
    setTimeout(
      () => {
        this.master.disconnect();
        void this.ctx.close();
      },
      (MOOD_CROSSFADE_SECONDS + 0.2) * 1000,
    );
  }
}

type AudioContextCtor = new () => AudioContext;

/** The real bus where WebAudio exists, the null bus everywhere else (tests, SSR, refusals). */
export function createAudioBus(seed?: number): AudioBus {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return new NullAudioBus();
  try {
    return new WebAudioBus(new Ctor(), seed);
  } catch {
    return new NullAudioBus();
  }
}
