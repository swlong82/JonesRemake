/**
 * The bus used in tests, in hosts without WebAudio, and whenever creating a context throws
 * (AUDIO_SPEC 8.1). It records what it was asked to do so a test can assert the wiring without a
 * sound card.
 */
import type { AudioBus, AudioChannel, MusicMood, SfxId } from './types.js';

export class NullAudioBus implements AudioBus {
  readonly played: SfxId[] = [];
  mood: MusicMood | null = null;
  muted = false;
  readonly volumes: Record<AudioChannel, number> = { music: 1, sfx: 1, master: 1 };
  unlocked = false;
  disposed = false;

  unlock(): Promise<void> {
    this.unlocked = true;
    return Promise.resolve();
  }

  playSfx(id: SfxId): void {
    this.played.push(id);
  }

  setMood(mood: MusicMood): void {
    this.mood = mood;
  }

  setVolume(channel: AudioChannel, v: number): void {
    this.volumes[channel] = v;
  }

  mute(muted: boolean): void {
    this.muted = muted;
  }

  dispose(): void {
    this.disposed = true;
  }
}
