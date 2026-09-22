/** M7.1: AudioBus, SFX recipes, procedural music moods and settings persistence (AUDIO_SPEC 8). */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@hustle-ring/shared';
import { sfxForEvent, sfxForEventTone } from './eventMap.js';
import { moodFor, TENSION_WELLBEING } from './mood.js';
import { degreeHz, MOODS, MusicRng, phrase, PHRASE_BARS, STEP_CHANCE } from './music.js';
import { NullAudioBus } from './NullAudioBus.js';
import { hzAt, lengthOf, SFX_RECIPES, tonesOf } from './sfx.recipes.js';
import { MUSIC_MOODS, SFX_IDS, type SfxId } from './types.js';

/**
 * Distributive, so each member of the union keeps its own fields rather than collapsing to the
 * fields they all share. `week` is optional because the envelope supplies one.
 */
type EventBody<T = DomainEvent> = T extends DomainEvent
  ? Omit<T, 'seq' | 'week'> & { week?: number }
  : never;

const ev = (body: EventBody): DomainEvent => ({ week: 1, ...body, seq: 1 });

describe('SFX recipes (AUDIO_SPEC 8.2)', () => {
  it('has exactly one recipe per SfxId, and no extras', () => {
    expect(Object.keys(SFX_RECIPES).sort()).toEqual([...SFX_IDS].sort());
  });

  it('every recipe is audible, finite and short enough to be a sound effect', () => {
    for (const id of SFX_IDS) {
      const r = SFX_RECIPES[id];
      expect(r.character.length, id).toBeGreaterThan(0);
      expect(r.gain, id).toBeGreaterThan(0);
      expect(r.gain, id).toBeLessThanOrEqual(0.25);
      expect(r.rootHz, id).toBeGreaterThan(20);
      expect(r.rootHz, id).toBeLessThan(20_000);
      expect(r.attack, id).toBeGreaterThan(0);
      expect(lengthOf(r), id).toBeGreaterThan(0);
      expect(lengthOf(r), id).toBeLessThan(2);
      for (const tone of tonesOf(r)) expect(tone.duration, id).toBeGreaterThan(0);
    }
  });

  it('the fanfares are the long ones, and the tick is the short one', () => {
    expect(tonesOf(SFX_RECIPES.win)).toHaveLength(8);
    expect(tonesOf(SFX_RECIPES.graduate)).toHaveLength(4);
    expect(lengthOf(SFX_RECIPES.uiClick)).toBeLessThan(0.05);
  });

  it('hzAt is equal temperament', () => {
    expect(hzAt(440, 12)).toBeCloseTo(880, 6);
    expect(hzAt(440, 0)).toBe(440);
    expect(hzAt(440, -12)).toBeCloseTo(220, 6);
  });
});

describe('event → SFX mapping (AUDIO_SPEC 8.1)', () => {
  it('maps money by sign', () => {
    const money = (delta: number): SfxId | null =>
      sfxForEvent(ev({ type: 'MoneyChanged', seat: 0, account: 'cash', delta, reason: 'x' }));
    expect(money(10)).toBe('cashIn');
    expect(money(-10)).toBe('cashOut');
    expect(money(0)).toBeNull();
  });

  it('maps the events the player has to react to onto the alert', () => {
    expect(sfxForEvent(ev({ type: 'RentDue', seat: 0 }))).toBe('alarm');
    expect(sfxForEvent(ev({ type: 'LoanMissed', seat: 0 }))).toBe('alarm');
    expect(sfxForEvent(ev({ type: 'WellbeingBand', seat: 0, band: 'burnout' }))).toBe('alarm');
    expect(sfxForEvent(ev({ type: 'WellbeingBand', seat: 0, band: 'thrive' }))).toBe('eventGood');
  });

  it('maps the milestones', () => {
    expect(sfxForEvent(ev({ type: 'Hired', seat: 0, jobId: 'x' }))).toBe('hired');
    expect(sfxForEvent(ev({ type: 'Fired', seat: 0, reason: 'x' }))).toBe('fired');
    expect(sfxForEvent(ev({ type: 'Graduated', seat: 0, degreeId: 'x' }))).toBe('graduate');
    expect(sfxForEvent(ev({ type: 'Won', seat: 0, week: 10 }))).toBe('win');
    expect(sfxForEvent(ev({ type: 'TurnEnded', seat: 0 }))).toBe('turnEnd');
    expect(
      sfxForEvent(ev({ type: 'CommandRejected', seat: 0, cmdType: 'Work', code: 'ERR_NO_JOB' })),
    ).toBe('error');
  });

  it('is silent for the events that would only add noise', () => {
    expect(
      sfxForEvent(ev({ type: 'StatChanged', seat: 0, stat: 'happiness', delta: 1, reason: 'x' })),
    ).toBeNull();
    expect(sfxForEvent(ev({ type: 'WeekAdvanced', week: 2 }))).toBeNull();
    expect(sfxForEvent(ev({ type: 'MarketMoved', prices: {} }))).toBeNull();
  });

  // AC: "mapping table covers every SfxId".
  it('reaches every SfxId between the event map and the UI click', () => {
    const reached = new Set<SfxId>(['uiClick']);
    const samples: EventBody[] = [
      { type: 'Moved', seat: 0, from: 'a', to: 'b', mode: 'walk', hours: 1 },
      { type: 'Entered', seat: 0, loc: 'a' },
      { type: 'MoneyChanged', seat: 0, account: 'cash', delta: 5, reason: 'x' },
      { type: 'MoneyChanged', seat: 0, account: 'cash', delta: -5, reason: 'x' },
      { type: 'Hired', seat: 0, jobId: 'x' },
      { type: 'Fired', seat: 0, reason: 'x' },
      { type: 'Graduated', seat: 0, degreeId: 'x' },
      { type: 'GoalMet', seat: 0, goal: 'wealth' },
      { type: 'GoalLost', seat: 0, goal: 'wealth' },
      { type: 'RentDue', seat: 0 },
      { type: 'TurnEnded', seat: 0 },
      { type: 'Won', seat: 0, week: 3 },
      { type: 'CommandRejected', seat: 0, cmdType: 'Work', code: 'ERR_NO_JOB' },
    ];
    for (const body of samples) {
      const id = sfxForEvent(ev(body));
      if (id) reached.add(id);
    }
    expect([...reached].sort()).toEqual([...SFX_IDS].sort());
  });

  it('turns a content tone into a sound', () => {
    expect(sfxForEventTone('good')).toBe('eventGood');
    expect(sfxForEventTone('bad')).toBe('eventBad');
    expect(sfxForEventTone('neutral')).toBeNull();
    expect(sfxForEventTone(undefined)).toBeNull();
  });
});

describe('music moods (AUDIO_SPEC 8.3)', () => {
  it('specifies every mood with the spec table values', () => {
    expect(Object.keys(MOODS).sort()).toEqual([...MUSIC_MOODS].sort());
    expect(MOODS.menu.bpm).toBe(90);
    expect(MOODS.normal.bpm).toBe(100);
    expect(MOODS.boom.bpm).toBe(112);
    expect(MOODS.recession.bpm).toBe(84);
    expect(MOODS.victory.once).toBe(true);
    expect(MOODS.tension.percussion).toBe('heartbeat');
    // Recession and tension are the filtered ones.
    expect(MOODS.recession.cutoffHz).toBeLessThan(MOODS.normal.cutoffHz);
    expect(MOODS.tension.cutoffHz).toBeLessThan(MOODS.recession.cutoffHz);
    for (const mood of MUSIC_MOODS) {
      expect(MOODS[mood].progression.length, mood).toBeGreaterThan(0);
      expect(MOODS[mood].scale.length, mood).toBeGreaterThan(0);
    }
  });

  it('generates a seeded phrase that mostly steps and stays inside the scale', () => {
    const rng = new MusicRng(1234);
    const notes = phrase(rng, 7, 2000);
    expect(notes).toHaveLength(2000);
    for (const n of notes) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(14);
    }
    let steps = 0;
    for (let i = 1; i < notes.length; i++) if (Math.abs(notes[i]! - notes[i - 1]!) === 1) steps++;
    // The walk reflects at the edges, so the measured share is near but under the 70% rule.
    expect(steps / notes.length).toBeGreaterThan(0.5);
    expect(STEP_CHANCE).toBe(0.7);
    expect(PHRASE_BARS).toBe(8);
  });

  it('is deterministic for a seed, and different for another', () => {
    expect(phrase(new MusicRng(7), 5, 32)).toEqual(phrase(new MusicRng(7), 5, 32));
    expect(phrase(new MusicRng(7), 5, 32)).not.toEqual(phrase(new MusicRng(8), 5, 32));
  });

  it('maps scale degrees onto octaves', () => {
    const spec = MOODS.menu;
    expect(degreeHz(spec, 0)).toBeCloseTo(spec.rootHz, 6);
    expect(degreeHz(spec, spec.scale.length)).toBeCloseTo(spec.rootHz * 2, 6);
  });
});

describe('mood selection (AUDIO_SPEC 8.3 "When")', () => {
  const state = (patch: Record<string, unknown>): never =>
    ({
      activeSeat: 0,
      econ: { phase: 'stable' },
      players: [{ home: { debt: 0 }, modules: {} }],
      ...patch,
    }) as never;

  it('is the menu outside a game and the fanfare on the end screen', () => {
    expect(moodFor('title', null)).toBe('menu');
    expect(moodFor('setup', null)).toBe('menu');
    expect(moodFor('end', state({}))).toBe('victory');
  });

  it('follows the economy while nothing is wrong', () => {
    expect(moodFor('game', state({}))).toBe('normal');
    expect(moodFor('game', state({ econ: { phase: 'boom' } }))).toBe('boom');
    expect(moodFor('game', state({ econ: { phase: 'recession' } }))).toBe('recession');
  });

  it('turns tense on rent debt or low wellbeing, whatever the economy is doing', () => {
    expect(moodFor('game', state({ players: [{ home: { debt: 100 }, modules: {} }] }))).toBe(
      'tension',
    );
    expect(
      moodFor(
        'game',
        state({
          econ: { phase: 'boom' },
          players: [
            { home: { debt: 0 }, modules: { wellbeing: { value: TENSION_WELLBEING - 1 } } },
          ],
        }),
      ),
    ).toBe('tension');
    expect(
      moodFor(
        'game',
        state({
          players: [{ home: { debt: 0 }, modules: { wellbeing: { value: TENSION_WELLBEING } } }],
        }),
      ),
    ).toBe('normal');
  });
});

describe('NullAudioBus (AUDIO_SPEC 8.1)', () => {
  it('records what it was asked to do and never throws', async () => {
    const bus = new NullAudioBus();
    await bus.unlock();
    bus.playSfx('win');
    bus.setMood('boom');
    bus.setVolume('music', 0.25);
    bus.mute(true);
    bus.dispose();
    expect(bus.unlocked).toBe(true);
    expect(bus.played).toEqual(['win']);
    expect(bus.mood).toBe('boom');
    expect(bus.volumes.music).toBe(0.25);
    expect(bus.muted).toBe(true);
    expect(bus.disposed).toBe(true);
  });
});

// AC: "music chunk lazy-loaded (bundle report)". A static import anywhere would fold the
// generator into the entry chunk, so the source is what this asserts.
describe('the music generator is only ever imported dynamically', () => {
  it('has no static import of ./music from any other module', () => {
    const dir = import.meta.dirname;
    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file === 'music.ts' || file.endsWith('.test.ts')) continue;
      const src = readFileSync(join(dir, file), 'utf8');
      // `import('./music.js')` is the dynamic form and is what WebAudioBus uses.
      if (/^\s*import[^(]*['"]\.\/music\.js['"]/m.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
    expect(readFileSync(join(dir, 'WebAudioBus.ts'), 'utf8')).toContain("import('./music.js')");
  });
});
