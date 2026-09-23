import { loadPack } from '@hustle-ring/content';
import { render } from '@testing-library/react';
import { TOKEN_SHAPES } from '@hustle-ring/shared';
import { describe, expect, it } from 'vitest';
import { itemKey, locationKey, PALETTE_HEX, PlaceholderAssetRegistry } from './AssetRegistry';

const pack = loadPack('classic');
const registry = new PlaceholderAssetRegistry(pack.visuals);

describe('PlaceholderAssetRegistry', () => {
  it('resolves a visual for every location and item in the pack', () => {
    for (const loc of pack.locations) expect(registry.has(locationKey(loc.id))).toBe(true);
    for (const item of pack.items) expect(registry.has(itemKey(item.id))).toBe(true);
  });

  it('renders every modern item with an intentional icon rather than the missing-icon fallback', () => {
    const modern = loadPack('modern-western');
    const modernRegistry = new PlaceholderAssetRegistry(modern.visuals);
    const fallback = modernRegistry.icon('no-such-icon');
    for (const id of [
      'smartphone',
      'laptop',
      'phone-case',
      'tablet',
      'smart-tv',
      'game-console',
      'e-reader',
      'noise-cancelling-headphones',
      'air-fryer',
      'robot-vacuum',
      'massage-chair',
      'bike',
      'gym-card',
    ]) {
      const visual = modern.visuals[itemKey(id)];
      expect(visual, id).toBeDefined();
      expect(modernRegistry.icon(visual!.icon), id).not.toBe(fallback);
    }
  });

  it('never throws on an unknown key: icon and color fall back', () => {
    expect(registry.has('location:atlantis')).toBe(false);
    const Missing = registry.icon('no-such-icon');
    const Known = registry.icon('home');
    expect(Missing).toBeDefined();
    expect(Known).not.toBe(Missing);
    const { container } = render(<Missing aria-hidden="true" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(registry.colorVar('cat-home')).toBe('var(--c-cat-home, var(--c-fallback))');
  });

  it('renders every token shape with a colour-blind-safe fill and a readable initial', () => {
    for (const shape of TOKEN_SHAPES) {
      const { container, unmount } = render(<svg>{registry.token(shape, 'p1', 'A')}</svg>);
      expect(container.querySelector('text')?.textContent).toBe('A');
      expect(container.innerHTML).toContain(PALETTE_HEX.p1);
      unmount();
    }
  });

  it('carries shape and initial so colour is never the only signal', () => {
    const { container } = render(<svg>{registry.token('square', 'p3', 'B', 20)}</svg>);
    expect(container.querySelector('rect')).not.toBeNull();
    expect(container.querySelector('text')?.textContent).toBe('B');
  });
});
