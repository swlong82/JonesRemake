import { describe, expect, it } from 'vitest';
import { contrastRatio, paletteIssues } from './contrast.js';
import { applyTint, hasTintKey, shade, tintColours } from './tint.js';

const keys = { primary: '#FF00FF', secondary: '#00FFFF' };

describe('key-colour tint (ART_SPEC 17.4)', () => {
  it('replaces only the key colours, case-insensitively, in attributes and styles', () => {
    const svg =
      '<rect fill="#ff00ff"/><rect style="fill:#FF00FF;stroke:#00ffff"/><rect fill="#ff00fe"/>' +
      '<rect fill="#FF00FF80"/>';
    const out = applyTint(svg, keys, { primary: '#0072b2', secondary: '#004a73' });
    expect(out).toBe(
      '<rect fill="#0072b2"/><rect style="fill:#0072b2;stroke:#004a73"/><rect fill="#ff00fe"/>' +
        '<rect fill="#FF00FF80"/>',
    );
  });

  it('detects whether a file is tintable', () => {
    expect(hasTintKey('<rect fill="#FF00FF"/>', keys.primary)).toBe(true);
    expect(hasTintKey('<rect fill="#FF00FE"/>', keys.primary)).toBe(false);
  });

  it('derives a darker secondary', () => {
    expect(shade('#ffffff', 0)).toBe('#ffffff');
    expect(shade('#ffffff', 1)).toBe('#000000');
    expect(tintColours('#0072B2')).toEqual({
      primary: '#0072b2',
      secondary: shade('#0072B2', 0.35),
    });
  });
});

describe('theme contrast (ART_SPEC 17.7)', () => {
  const good = {
    surface: '#ffffff',
    surface2: '#f7f7f5',
    ink: '#1a1a1a',
    inkMuted: '#545454',
    line: '#c9c9c2',
    accent: '#0b5fa5',
    onAccent: '#ffffff',
    focus: '#d55e00',
    danger: '#b3261e',
    onDanger: '#ffffff',
  };

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('accepts a legible palette and names each failing pair', () => {
    expect(paletteIssues(good)).toEqual([]);
    const issues = paletteIssues({ ...good, ink: '#dddddd', focus: '#fefefe' });
    expect(issues.some((i) => i.startsWith('ink on surface'))).toBe(true);
    expect(issues.some((i) => i.startsWith('focus on surface'))).toBe(true);
  });
});
