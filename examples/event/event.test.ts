/** Recipe: add an event (docs/EXTENDING.md). */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '@hustle-ring/engine';
import { overlayManifest, resolveExample, soloGame } from '../lib/overlay.js';
import events from './events.json';
import i18n from './i18n.json';

const pack = resolveExample('example-event', {
  'pack.json': overlayManifest('example-event', 'modern-western'),
  'events.json': events,
  'i18n/en.json': i18n,
});

describe('recipe: add an event', () => {
  it('joins the pack and fires as a weekend event', () => {
    expect(pack.eventById['street-musician']).toMatchObject({ trigger: 'weekend' });
    // Weekend events are one weighted pick a week; weight 1000 against the pack's weekend set makes
    // it common. Play weeks until it fires; every week is deterministic under the seed.
    let s = soloGame(pack, 'musician', 'classic');
    const fired: string[] = [];
    for (let week = 0; week < 20 && !fired.includes('street-musician'); week++) {
      const r = applyCommand(s, 0, { type: 'EndTurn' }, pack);
      for (const e of r.events) if (e.type === 'EventFired') fired.push(e.eventId);
      s = r.state;
    }
    expect(fired).toContain('street-musician');
  });
});
