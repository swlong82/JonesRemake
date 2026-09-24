/**
 * Art-set manifest (ART_SPEC 17.2). A set is `manifest.json` + `files/*.svg`; the manifest maps
 * slot keys (17.3) to files and carries the board layout, the tint key colours and the theme.
 */
import { z } from 'zod';

/** Coordinate space of the board, interiors and full-screen scenes (17.2). */
export const STAGE = { width: 1600, height: 1000 } as const;

/**
 * Fonts an art set may name (17.7). Only fonts bundled with the app are allowed (no CDN,
 * CLAUDE.md 1.3): `system` is the platform UI stack, `nunito` the bundled OFL face.
 */
export const ART_FONTS = ['system', 'nunito'] as const;
export type ArtFont = (typeof ART_FONTS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a #RRGGBB colour');
const setId = z.string().regex(/^[a-z0-9-]+$/, 'expected lowercase letters, digits and dashes');
/** `group:part[:part…]`, e.g. `building:bank`, `avatar:player-1:walk1:e`. */
export const ART_KEY_RE = /^[a-z]+(:[a-z0-9-]+)+$/;
const artKey = z.string().regex(ART_KEY_RE, 'expected an art key like "building:bank"');

const point = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const rect = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

export const BoardSlotSchema = z
  .object({
    /** Where the building art is fitted. */
    rect,
    /** Where the street path touches this slot; avatars stand here. */
    door: point,
    /** Anchor (top centre) of the name plate. */
    label: point,
  })
  .strict();

export const BoardLayoutSchema = z
  .object({
    /** One per ring index, in ring order. */
    slots: z.array(BoardSlotSchema).min(2),
    /** Closed street polyline, one waypoint per ring index, walked in ring order. */
    path: z.array(point).min(2),
  })
  .strict();

export const PALETTE_TOKENS = [
  'surface',
  'surface2',
  'ink',
  'inkMuted',
  'line',
  'accent',
  'onAccent',
  'focus',
  'danger',
  'onDanger',
] as const;
export type PaletteToken = (typeof PALETTE_TOKENS)[number];

export const ThemeSchema = z
  .object({
    font: z.enum(ART_FONTS),
    palette: z.object(Object.fromEntries(PALETTE_TOKENS.map((t) => [t, hex]))).strict(),
    frames: z.object({ panel: artKey, button: artKey }).partial().strict().optional(),
  })
  .strict();

export const AssetEntrySchema = z
  .object({
    /** Relative to the set's `files/` folder. */
    file: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.svg$/, 'expected a lowercase .svg file name'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const ArtManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: setId,
    name: z.string().min(1),
    version: z.string().min(1),
    author: z.string().optional(),
    license: z.string().optional(),
    /** Base set; keys this set does not define resolve from it. Omitted = a base set. */
    extends: setId.optional(),
    stage: z.object({ width: z.literal(STAGE.width), height: z.literal(STAGE.height) }).strict(),
    tintKeys: z.object({ primary: hex, secondary: hex }).strict(),
    theme: ThemeSchema.optional(),
    board: BoardLayoutSchema.optional(),
    assets: z.record(artKey, AssetEntrySchema),
  })
  .strict();

export type Point = z.infer<typeof point>;
export type Rect = z.infer<typeof rect>;
export type BoardSlot = z.infer<typeof BoardSlotSchema>;
export type BoardLayout = z.infer<typeof BoardLayoutSchema>;
export type ArtTheme = z.infer<typeof ThemeSchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type ArtManifest = z.infer<typeof ArtManifestSchema>;
export type Palette = Record<PaletteToken, string>;
