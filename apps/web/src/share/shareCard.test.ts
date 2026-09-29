import { loadPack } from '@hustle-ring/content';
import { createGame } from '@hustle-ring/engine';
import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { useSeedLink, captureSeedLink } from '../store/seedLink';
import { quickStartConfig, quickStartPackId } from '../ui/screens/quickStart';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { escapeXml, parseSeedLink, resultCardSvg, seedLinkFor } from './shareCard';

function game(name = 'You') {
  const pack = loadPack('classic');
  return createGame(
    buildConfig(
      'classic',
      [defaultSeat(0, 'human-local', name)],
      'abc-123',
      'classic',
      false,
      true,
    ),
    pack,
  );
}

describe('seed links (M12.10)', () => {
  it('round-trips the seed and city and drops everything else', () => {
    const link = seedLinkFor(game(), 'https://example.test/base/?debug=1#x');
    expect(link).toBe('https://example.test/base/?seed=abc-123&pack=classic');
    expect(parseSeedLink(new URL(link).search)).toEqual({ seed: 'abc-123', packId: 'classic' });
  });

  it('rejects odd seeds, unknown cities and partial links', () => {
    expect(parseSeedLink('?seed=a b&pack=classic')).toBeNull();
    expect(parseSeedLink('?seed=<x>&pack=classic')).toBeNull();
    expect(parseSeedLink(`?seed=${'a'.repeat(65)}&pack=classic`)).toBeNull();
    expect(parseSeedLink('?seed=ok&pack=nowhere')).toBeNull();
    expect(parseSeedLink('?seed=ok')).toBeNull();
    expect(parseSeedLink('')).toBeNull();
  });

  it('holds a captured link for the setup screen', () => {
    useSeedLink.getState().set(null);
    expect(captureSeedLink('?nothing=1')).toBe(false);
    expect(captureSeedLink('?seed=zz9&pack=modern-western')).toBe(true);
    expect(useSeedLink.getState().link).toEqual({ seed: 'zz9', packId: 'modern-western' });
    useSeedLink.getState().set(null);
  });
});

describe('result card (M12.10)', () => {
  it('is a self-contained SVG with the winner, players, seed and no external references', () => {
    const svg = resultCardSvg(game('A<b>&"'), i18n.t.bind(i18n));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('abc-123');
    expect(svg).toContain('A&lt;b&gt;&amp;&quot;');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<image');
  });

  it('escapes the five XML specials', () => {
    expect(escapeXml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&apos;');
  });
});

describe('quick start (M12.1)', () => {
  it('builds a modern-city game with one human and one rival on defaults', () => {
    expect(quickStartPackId()).toBe('modern-western');
    const cfg = quickStartConfig('fixed-seed');
    expect(cfg.packId).toBe('modern-western');
    expect(cfg.seed).toBe('fixed-seed');
    expect(cfg.chaos).toBe('modern');
    expect(cfg.seats.map((s) => s.controller)).toEqual(['human-local', 'ai']);
    expect(quickStartConfig('x', true).classicOpacity).toBe(true);
    expect(quickStartConfig().seed).toMatch(/\S/);
  });
});
