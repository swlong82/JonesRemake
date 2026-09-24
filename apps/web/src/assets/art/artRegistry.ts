/**
 * ArtRegistry (ART_SPEC 17.5): resolves art-set keys to image URLs for the scene UI (M9.6+).
 *
 * Lookup walks the active set's chain (user set → its `extends` → `default`); tinted slots are
 * fetched as text, recoloured by key colour (17.4) and served as cached `blob:` URLs; anything
 * unresolved or failing renders the slot's wireframe. Every URL is used as `<img src>`, never
 * inlined, so a set cannot run script or fetch (17.6). Nothing here throws.
 */
import {
  ArtManifestSchema,
  applyTint,
  boardOf,
  catalogFor,
  resolveAsset,
  setChain,
  slotSpecFor,
  themeOf,
  tintColours,
  wireframeDataUrl,
  type ArtManifest,
  type ArtTheme,
  type BoardLayout,
  type SlotSpec,
} from '@hustle-ring/art';
import defaultManifestJson from '@hustle-ring/art/sets/default/manifest.json';
import type { PaletteId } from '@hustle-ring/shared';
import { PALETTE_HEX } from '../AssetRegistry';

/**
 * Bundled files of the default set as hashed static URLs. `vite.config.ts` keeps them out of the
 * JS bundle (no data-URL inlining), so art does not count against the initial budget (17.8).
 */
const DEFAULT_FILES = import.meta.glob<string>(
  '../../../../../packages/art/sets/default/files/*.svg',
  {
    query: '?url',
    import: 'default',
    eager: true,
  },
);

function bundledUrls(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, url] of Object.entries(DEFAULT_FILES)) {
    out.set(`default/${path.slice(path.lastIndexOf('/') + 1)}`, url);
  }
  return out;
}

export const DEFAULT_ART_SET: ArtManifest = ArtManifestSchema.parse(defaultManifestJson);

export interface ArtRegistryDeps {
  /** `setId/file` → URL. Bundled sets come from the glob; user sets from their stored blobs. */
  fileUrls: ReadonlyMap<string, string>;
  fetchText: (url: string) => Promise<string>;
  makeObjectUrl: (svg: string) => string;
}

const browserDeps = (): ArtRegistryDeps => ({
  fileUrls: bundledUrls(),
  fetchText: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },
  makeObjectUrl: (svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
});

/** Size used for the wireframe of a key the catalog does not know. */
const UNKNOWN_SLOT = { group: 'ui', width: 160, height: 100, tint: false } as const;

export class ArtRegistry {
  private readonly chain: ArtManifest[];
  private readonly tinted = new Map<string, Promise<string>>();

  constructor(
    sets: ReadonlyMap<string, ArtManifest>,
    activeSetId: string,
    private readonly catalog: readonly SlotSpec[],
    private readonly deps: ArtRegistryDeps,
  ) {
    this.chain = setChain(activeSetId, sets);
  }

  /** Whether any set in the chain (or an optional fallback) defines the key. */
  has(key: string): boolean {
    return resolveAsset(key, this.chain, this.catalog) !== undefined;
  }

  /** Whether a set in the chain defines exactly this key (no optional fallback). */
  hasOwn(key: string): boolean {
    return this.chain.some((set) => key in set.assets);
  }

  /** Synchronous `data:` URL of the slot's wireframe; always available. */
  wireframe(key: string): string {
    const spec = slotSpecFor(key, this.catalog) ?? { ...UNKNOWN_SLOT, key };
    const tintKeys = this.chain[0]?.tintKeys ?? DEFAULT_ART_SET.tintKeys;
    return wireframeDataUrl(spec, tintKeys);
  }

  /** URL for `<img src>`: the file, a tinted blob, or the wireframe on any failure. */
  async url(key: string, tint?: PaletteId): Promise<string> {
    const hit = resolveAsset(key, this.chain, this.catalog);
    const fileUrl = hit ? this.deps.fileUrls.get(`${hit.setId}/${hit.entry.file}`) : undefined;
    if (!hit || fileUrl === undefined) return this.wireframe(key);
    const spec = slotSpecFor(hit.key, this.catalog);
    if (tint === undefined || !spec?.tint) return fileUrl;
    const cacheKey = `${hit.setId}/${hit.entry.file}#${tint}`;
    let pending = this.tinted.get(cacheKey);
    if (!pending) {
      const set = this.chain.find((s) => s.id === hit.setId)!;
      pending = this.deps
        .fetchText(fileUrl)
        .then((svg) =>
          this.deps.makeObjectUrl(applyTint(svg, set.tintKeys, tintColours(PALETTE_HEX[tint]))),
        );
      // A failed fetch is not cached, so a later render can retry.
      pending.catch(() => this.tinted.delete(cacheKey));
      this.tinted.set(cacheKey, pending);
    }
    return pending.catch(() => this.wireframe(key));
  }

  board(): BoardLayout | undefined {
    return boardOf(this.chain);
  }

  theme(): ArtTheme | undefined {
    return themeOf(this.chain);
  }
}

const registries = new WeakMap<object, ArtRegistry>();

/** Registry of the bundled default set for a pack (one per pack; the catalog follows the pack). */
export function artRegistryFor(pack: {
  board: { locationAt: readonly (string | null)[] };
  personalities: readonly { id: string }[];
}): ArtRegistry {
  let r = registries.get(pack);
  if (!r) {
    const catalog = catalogFor({
      locationIds: pack.board.locationAt.filter((l): l is string => l !== null),
      personalityIds: pack.personalities.map((p) => p.id),
    });
    r = new ArtRegistry(new Map([['default', DEFAULT_ART_SET]]), 'default', catalog, browserDeps());
    registries.set(pack, r);
  }
  return r;
}

let base: ArtRegistry | undefined;

/** Pack-independent registry for UI chrome (frames, title and setup art). */
export function baseArtRegistry(): ArtRegistry {
  base ??= new ArtRegistry(
    new Map([['default', DEFAULT_ART_SET]]),
    'default',
    catalogFor({ locationIds: [], personalityIds: [] }),
    browserDeps(),
  );
  return base;
}
