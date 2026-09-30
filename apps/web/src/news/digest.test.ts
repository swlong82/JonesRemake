import { loadPack, type CityPack } from '@hustle-ring/content';
import { createGame, type GameState } from '@hustle-ring/engine';
import { beforeAll, describe, expect, it } from 'vitest';
import i18n, { loadPackStrings } from '../i18n';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { buildDigest } from './digest';

const t = i18n.t.bind(i18n);

function game(packId: string, opaque = false): { state: GameState; pack: CityPack } {
  const pack = loadPack(packId);
  loadPackStrings(pack);
  const config = buildConfig(
    packId,
    [defaultSeat(0, 'human-local', 'Ann'), defaultSeat(1, 'human-local', 'Bo')],
    'digest',
    'classic',
    opaque,
    false,
  );
  return { state: createGame(config, pack), pack };
}

describe('weekly digest', () => {
  beforeAll(() => {
    loadPackStrings(loadPack('modern-western'));
  });

  it('always has a lead and never leaks a raw key or placeholder', () => {
    for (const id of ['classic', 'modern-western']) {
      const { state, pack } = game(id);
      const digest = buildDigest(state, pack, 0, t);
      expect(digest.stories.length).toBeGreaterThan(1);
      expect(digest.stories[0]?.section).toBe('lead');
      for (const s of digest.stories) {
        for (const text of [s.headline, s.body]) {
          expect(text, `${id}/${s.id}`).not.toBe('');
          expect(text, `${id}/${s.id}`).not.toContain('{{');
          expect(text, `${id}/${s.id}`).not.toMatch(/^(news|event|job|location)\./);
        }
      }
    }
  });

  it('reports the market mover and what the reader holds', () => {
    const { state, pack } = game('modern-western');
    const id = pack.assets[0]!.id;
    state.market.history[id] = [10_000, 12_000];
    state.market.prices[id] = 12_000;
    state.players[0]!.investments[id] = { units: 10_000, costBasisCents: 100_000 };
    const story = buildDigest(state, pack, 0, t).stories.find((s) => s.id === 'markets-mover');
    expect(story?.tone).toBe('good');
    expect(story?.headline).toContain('20.0%');
    expect(story?.body).toContain('$1200');
  });

  it('warns about an exposed job and a rent bill that is due', () => {
    const { state, pack } = game('modern-western');
    const exposed = pack.jobs.find((j) => j.automationRiskBp >= 3000 && !j.isGig)!;
    state.players[0]!.job = { jobId: exposed.id, wage: 10, raises: 0, hiredWeek: 1 };
    state.players[0]!.home.debt = 90;
    const ids = buildDigest(state, pack, 0, t).stories.map((s) => s.id);
    expect(ids).toContain('watch-automation');
    expect(ids).toContain('home-debt');
    expect(ids.indexOf('watch-automation')).toBeLessThan(ids.indexOf('markets-flat'));
  });

  it('keeps the economy secret under classic opacity', () => {
    const { state, pack } = game('classic', true);
    const digest = buildDigest(state, pack, 0, t);
    expect(digest.stories[0]?.id).toBe('lead-opaque');
    expect(digest.stories.map((s) => s.id)).not.toContain('lead-economy');
  });

  it('turns this week’s events into city news and names the race leader', () => {
    const { state, pack } = game('modern-western');
    const recent = [
      {
        week: state.week,
        event: {
          type: 'EventFired',
          seat: 0,
          eventId: 'core:rent-hike-notice',
          effects: ['rentBp:800'],
          seq: 1,
          week: state.week,
        },
      },
    ] as const;
    expect(buildDigest(state, pack, 0, t).stories.map((s) => s.id)).not.toContain('rivals-lead');
    state.players[0]!.bank = 1_000_000;
    const digest = buildDigest(state, pack, 0, t, recent as never);
    expect(digest.stories.map((s) => s.id)).toContain('home-hike');
    expect(digest.stories.map((s) => s.id)).toContain('rivals-lead');
  });
});
