/**
 * Audio wiring (AUDIO_SPEC 8.1). One bus per app, created lazily on the first user gesture,
 * driven by the store's `DomainEvent` log through `eventMap` and by the settings store for
 * volume and mute. Behind the `audio` app flag until M7.1 lands it (`flags/appFlags.ts`).
 */
import { useEffect, useRef } from 'react';
import { useAppFlag } from '../flags/appFlags.js';
import { useGame } from '../store/gameStore.js';
import { useSettings } from '../store/settings.js';
import { sfxForEvent } from './eventMap.js';
import { moodFor } from './mood.js';
import { NullAudioBus } from './NullAudioBus.js';
import { createAudioBus, WebAudioBus } from './WebAudioBus.js';
import type { AudioBus } from './types.js';

/** Gestures that count as "the user touched the page", so a context may start. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/** At most this many sounds per store update, so a busy AI turn cannot machine-gun. */
const MAX_SFX_PER_UPDATE = 3;

let shared: AudioBus | null = null;

/** The process-wide bus, or null before the first gesture. Exported for tests. */
export function currentAudioBus(): AudioBus | null {
  return shared;
}

/** Replace the bus (tests inject a `NullAudioBus`; passing null drops it). */
export function setAudioBus(bus: AudioBus | null): void {
  shared = bus;
}

export function useAudio(): void {
  const enabled = useAppFlag('audio');
  const settings = useSettings((s) => s.settings);
  const screen = useGame((s) => s.screen);
  const state = useGame((s) => s.state);
  const log = useGame((s) => s.log);
  const lastSeq = useRef<number>(-1);

  // The bus cannot exist before a gesture, so the first one creates it.
  useEffect(() => {
    if (!enabled) return;
    const onGesture = (): void => {
      shared ??= createAudioBus();
      void shared.unlock();
    };
    for (const g of GESTURES) globalThis.addEventListener(g, onGesture, { passive: true });
    return () => {
      for (const g of GESTURES) globalThis.removeEventListener(g, onGesture);
    };
  }, [enabled]);

  // Settings are the source of truth for volume and mute, and they persist (UX 7.1).
  useEffect(() => {
    if (!enabled || !shared) return;
    shared.setVolume('music', settings.musicVolume);
    shared.setVolume('sfx', settings.sfxVolume);
    shared.mute(settings.muted);
  }, [enabled, settings.musicVolume, settings.sfxVolume, settings.muted]);

  // AUDIO_SPEC 8.1: pause the music while the tab is hidden.
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = (): void => {
      if (shared instanceof WebAudioBus)
        shared.setHidden(globalThis.document.visibilityState === 'hidden');
    };
    globalThis.document.addEventListener('visibilitychange', onVisibility);
    return () => {
      globalThis.document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !shared) return;
    shared.setMood(moodFor(screen, state));
  }, [enabled, screen, state]);

  useEffect(() => {
    if (!enabled || !shared) return;
    const bus = shared;
    let played = 0;
    for (const entry of log) {
      if (entry.seq <= lastSeq.current) continue;
      lastSeq.current = entry.seq;
      if (played >= MAX_SFX_PER_UPDATE) continue;
      const id = sfxForEvent(entry.event);
      if (id === null) continue;
      bus.playSfx(id);
      played++;
    }
  }, [enabled, log]);
}

/** A click sound for UI affordances the engine never hears about (AUDIO_SPEC 8.2 `uiClick`). */
export function playUiClick(): void {
  shared?.playSfx('uiClick');
}

export { NullAudioBus };
