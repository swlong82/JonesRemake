/**
 * The default art set's generator (ART_SPEC 17.3, M9.13): one drawing per catalog slot, all
 * modern cartoon, deterministic, no text. `pnpm art:draw` writes them over wireframes and over its
 * own earlier output, never over art drawn by hand (a file without either marker).
 */
import { isPlaceholder, type BoardLayout, type SlotSpec } from '@hustle-ring/art';
import { buildingSvg } from './buildings.js';
import { avatarSvg, hostSvg, type Dir, type Pose } from './people.js';
import {
  boardBackground,
  frameSvg,
  interiorSvg,
  mastheadSvg,
  setupSvg,
  titleSvg,
  weekendSvg,
} from './scenes.js';
import { GENERATED_MARKER } from './svg.js';

export { GENERATED_MARKER } from './svg.js';

/** The drawing for a slot, or null for a key this generator does not know. */
export function drawSlot(slot: Pick<SlotSpec, 'key'>, layout: BoardLayout): string | null {
  const [group, a = '', b = '', c = ''] = slot.key.split(':');
  switch (group) {
    case 'board':
      return boardBackground(layout);
    case 'building':
      return buildingSvg(a);
    case 'interior':
      return interiorSvg(a);
    case 'host':
      return hostSvg(a);
    case 'avatar':
      return avatarSvg(a, b as Pose, c as Dir);
    case 'weekend':
      return a === 'positive' || a === 'negative' || a === 'neutral' ? weekendSvg(a) : null;
    case 'frame':
      return a === 'panel' || a === 'button' ? frameSvg(a) : null;
    case 'ui':
      return a === 'title'
        ? titleSvg()
        : a === 'setup'
          ? setupSvg()
          : a === 'newspaper-masthead'
            ? mastheadSvg()
            : null;
    default:
      return null;
  }
}

/** Whether `art:draw` may replace this file: a wireframe or its own earlier output. */
export function mayRedraw(current: string | undefined): boolean {
  return current === undefined || isPlaceholder(current) || current.includes(GENERATED_MARKER);
}
