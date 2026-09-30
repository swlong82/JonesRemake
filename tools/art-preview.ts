#!/usr/bin/env tsx
/**
 * `pnpm art:preview [--set <id>] [--out <dir>]` — writes a contact sheet for art sets so artists
 * and reviewers can judge a set without running the game: every catalog slot grouped by kind,
 * badged as drawn here, a wireframe, or inherited from the base set (`extends`). Output is one
 * static `index.html` plus the SVG files, under `reports/art-preview/<set>/`. Tint regions show
 * their key colours (magenta/cyan); the game recolours them per player.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ArtManifestSchema, isPlaceholder, type SlotSpec } from '@hustle-ring/art';
import { catalogFromPacks, listSets, readSet } from './lib/art.js';

const setsDir = resolve(import.meta.dirname, '..', 'packages/art/sets');
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outRoot = resolve(flag('out') ?? 'reports/art-preview');
const only = flag('set');
const { catalog } = catalogFromPacks();

type Origin = 'drawn' | 'wireframe' | 'inherited' | 'missing';

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function sheet(setId: string): { html: string; counts: Record<Origin, number> } {
  const set = readSet(setsDir, setId);
  const manifest = ArtManifestSchema.parse(set.manifest);
  const base = manifest.extends ? readSet(setsDir, manifest.extends) : undefined;
  const baseManifest = base ? ArtManifestSchema.parse(base.manifest) : undefined;
  const dest = join(outRoot, setId);
  mkdirSync(join(dest, 'files'), { recursive: true });

  const counts: Record<Origin, number> = { drawn: 0, wireframe: 0, inherited: 0, missing: 0 };
  const groups = new Map<string, string[]>();
  for (const slot of catalog as readonly SlotSpec[]) {
    let origin: Origin = 'missing';
    let file: string | undefined;
    let from = set;
    const own = manifest.assets[slot.key];
    const ownText = own ? set.files.get(own.file) : undefined;
    if (own && ownText !== undefined) {
      origin = isPlaceholder(ownText) ? 'wireframe' : 'drawn';
      file = own.file;
    } else if (base && baseManifest) {
      const inh = baseManifest.assets[slot.key];
      if (inh && base.files.has(inh.file)) {
        origin = 'inherited';
        file = inh.file;
        from = base;
      }
    }
    counts[origin]++;
    if (file !== undefined)
      copyFileSync(join(from.dir, 'files', file), join(dest, 'files', `${from.id}.${file}`));
    const src = file === undefined ? '' : `files/${from.id}.${file}`;
    const card =
      `<figure class="${origin}"><div class="frame" style="aspect-ratio:${slot.width}/${slot.height}">` +
      (src ? `<img loading="lazy" src="${esc(src)}" alt="">` : '') +
      `</div><figcaption><code>${esc(slot.key)}</code><span class="badge">${origin}</span></figcaption></figure>`;
    const list = groups.get(slot.group) ?? [];
    list.push(card);
    groups.set(slot.group, list);
  }
  const total = catalog.length;
  const html = `<!doctype html><meta charset="utf-8"><title>Art set: ${esc(setId)}</title>
<style>
body{font:14px system-ui;margin:16px;background:#f6f1e7;color:#2b2118}
h1{margin:0 0 4px}.sum{margin:0 0 16px}
h2{margin:24px 0 8px;text-transform:capitalize}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
figure{margin:0;background:#fff;border:1px solid #d8c9ad;border-radius:8px;padding:6px}
.frame{background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:4px}
img{width:100%;height:100%;object-fit:contain;display:block}
figcaption{display:flex;justify-content:space-between;gap:4px;margin-top:4px;font-size:11px}
.badge{border-radius:99px;padding:0 6px;border:1px solid #999}
.drawn .badge{background:#d6f5df;border-color:#1b7f3b}.wireframe .badge{background:#ffe9c2;border-color:#b26a00}
.inherited .badge{background:#e2ecff;border-color:#2f6fb5}.missing .badge{background:#ffd9d6;border-color:#b3261e}
</style>
<h1>Art set: ${esc(setId)}${manifest.extends ? ` <small>(extends ${esc(manifest.extends)})</small>` : ''}</h1>
<p class="sum">${counts.drawn}/${total} drawn here · ${counts.inherited} inherited · ${counts.wireframe} wireframe · ${counts.missing} missing</p>
${[...groups.entries()].map(([g, cards]) => `<h2>${esc(g)}</h2><div class="grid">${cards.join('')}</div>`).join('\n')}
`;
  writeFileSync(join(dest, 'index.html'), html);
  return { html, counts };
}

for (const id of listSets(setsDir).filter((s) => only === undefined || s === only)) {
  const { counts } = sheet(id);
  console.log(
    `✓ ${id}: drawn ${counts.drawn}, inherited ${counts.inherited}, wireframe ${counts.wireframe}, missing ${counts.missing} → ${join(outRoot, id, 'index.html')}`,
  );
}
