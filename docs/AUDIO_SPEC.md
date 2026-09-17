# 8. docs/AUDIO_SPEC.md

All audio is synthesized at runtime; no audio files shipped.

## 8.1 AudioBus

```ts
interface AudioBus {
  unlock(): Promise<void>;                 // call on first user gesture
  playSfx(id: SfxId, opts?: { pitch?: number }): void;
  setMood(mood: MusicMood): void;          // crossfade 1.5s
  setVolume(channel: 'music'|'sfx'|'master', v: number): void; // 0..1, persisted
  mute(muted: boolean): void;              // persisted
}
```

- Implementation: WebAudio `AudioContext`; SFX via small oscillator/noise envelope recipes (jsfxr-style params in `sfx.recipes.ts`); music via Tone.js loaded as a lazy chunk after first gesture.
- `NullAudioBus` used in tests, SSR-less environments, and when WebAudio unavailable.
- Driven only by `DomainEvent`s through a mapping table; engine has no audio knowledge.
- Respect `document.visibilityState` (pause music when hidden).

## 8.2 SFX list

| SfxId | Trigger event | Character |
| --- | --- | --- |
| uiClick | any button | 30ms tick |
| step | token passes square | soft blip, pitch rises with mode speed |
| enter | enter location | two-note chime |
| cashIn | money + | ascending arpeggio |
| cashOut | money − | descending blip |
| hired | job gained | major triad |
| fired | job lost | minor fall |
| graduate | degree | fanfare 4 notes |
| eventGood | positive event | sparkle |
| eventBad | negative event | low buzz |
| alarm | rent due, loan missed, burnout | two-tone alert |
| turnEnd | end turn | clock ding |
| win | winner declared | fanfare 8 notes |
| error | invalid command | short noise burst |

## 8.3 Procedural music

| Mood | When | Spec |
| --- | --- | --- |
| menu | title/setup | 90 BPM, I–vi–IV–V in C major, soft pad + plucked lead |
| normal | econ Stable | 100 BPM, pentatonic generative lead over 8-bar loop, light drums |
| boom | econ Boom | 112 BPM, major, brighter lead, added hi-hats |
| recession | econ Recession | 84 BPM, A minor, sparse, low-pass filtered |
| tension | active player wellbeing < 25 or rent debt | filtered pad drone, heartbeat kick |
| victory | end screen | 1 play of 16-bar major progression then silence |

Generative rules: seeded from a UI-side RNG (not game RNG) so music never affects determinism; lead notes chosen by weighted random walk within scale (step 70%, leap 30%); new phrase every 8 bars. CPU budget: < 3% main thread on desktop (measured with Performance API in a dev check).
