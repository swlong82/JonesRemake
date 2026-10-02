import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { checkSvg } from '@hustle-ring/art';
import { nodeParseXml } from '../lib/art.js';
import { drawBenchmark } from './draw.js';

it('the eight committed Modern slots are reproducible, sanitized vectors without text or tint keys', () => {
  const files = drawBenchmark();
  expect(Object.keys(files)).toHaveLength(8);
  for (const [file, svg] of Object.entries(files)) {
    expect(
      readFileSync(
        resolve(import.meta.dirname, '../../packages/art/sets/modern/files', file),
        'utf8',
      ),
    ).toBe(svg);
    const checked = checkSvg(svg, undefined, nodeParseXml);
    expect(checked.issues, file).toEqual([]);
    expect(checked.viewBox).toEqual(
      file.startsWith('interior') ? { width: 1600, height: 1000 } : { width: 240, height: 240 },
    );
    expect(svg).not.toMatch(/<text|<tspan|#ff00ff|#00ffff/i);
  }
});
