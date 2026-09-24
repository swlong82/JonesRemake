/**
 * Placeholder planning for `pnpm art:placeholders` (ART_SPEC 17.3). Pure: given the current
 * manifest and files, returns the manifest to write and the wireframes to (re)write. Drawn art —
 * any file without the placeholder marker — is never in the write set.
 */
import type { SlotSpec } from './catalog.js';
import { defaultBoardLayout, isPlaceholder, wireframeSvg } from './placeholder.js';
import { STAGE, type ArtManifest, type ArtTheme } from './schema.js';

export const DEFAULT_TINT_KEYS = { primary: '#FF00FF', secondary: '#00FFFF' } as const;

/** Rounded cartoon kit colours (17.7); contrast is checked by `art:check`. */
export const DEFAULT_THEME: ArtTheme = {
  font: 'system',
  palette: {
    surface: '#fff8ec',
    surface2: '#ffffff',
    ink: '#2b2118',
    inkMuted: '#5c4d3f',
    line: '#e3d3bb',
    accent: '#2f6fb5',
    onAccent: '#ffffff',
    focus: '#d4570f',
    danger: '#b3261e',
    onDanger: '#ffffff',
  },
  frames: { panel: 'frame:panel', button: 'frame:button' },
};

export function fileNameFor(key: string): string {
  return `${key.replace(/:/g, '.')}.svg`;
}

export interface PlaceholderPlan {
  manifest: ArtManifest;
  /** File name → wireframe text; only new files and stale wireframes. */
  writes: Map<string, string>;
  /** Slots whose file is drawn art (kept as is). */
  drawn: string[];
}

export function planPlaceholders(input: {
  manifest: ArtManifest | undefined;
  files: ReadonlyMap<string, string>;
  catalog: readonly SlotSpec[];
  boardSize: number;
}): PlaceholderPlan {
  const base: ArtManifest = input.manifest ?? {
    schemaVersion: 1,
    id: 'default',
    name: 'Default',
    version: '0.1.0',
    license: 'MIT',
    stage: { width: STAGE.width, height: STAGE.height },
    tintKeys: { ...DEFAULT_TINT_KEYS },
    assets: {},
  };
  const manifest: ArtManifest = {
    ...base,
    theme: base.theme ?? DEFAULT_THEME,
    board: base.board ?? defaultBoardLayout(input.boardSize),
    assets: { ...base.assets },
  };
  const writes = new Map<string, string>();
  const drawn: string[] = [];
  for (const slot of input.catalog) {
    if (slot.optional) continue;
    const entry = manifest.assets[slot.key];
    const file = entry?.file ?? fileNameFor(slot.key);
    const current = input.files.get(file);
    if (current !== undefined && !isPlaceholder(current)) {
      drawn.push(slot.key);
      manifest.assets[slot.key] = entry ?? { file, width: slot.width, height: slot.height };
      continue;
    }
    manifest.assets[slot.key] = { file, width: slot.width, height: slot.height };
    const svg = wireframeSvg(slot, manifest.tintKeys);
    if (current !== svg) writes.set(file, svg);
  }
  // Stable key order keeps the manifest diff-friendly.
  manifest.assets = Object.fromEntries(
    Object.entries(manifest.assets).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { manifest, writes, drawn };
}
