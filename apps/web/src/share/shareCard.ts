/**
 * Shareable results (M12.10): a result card drawn locally as SVG (then PNG) and a "play this seed"
 * link. Nothing is uploaded — the card is built on the device and saved as a file, the link is
 * plain text for the player to send however they like (CLAUDE.md 1.3: no network at runtime).
 */
import { WORLD } from '@hustle-ring/content';
import type { GameState } from '@hustle-ring/engine';
import type { TFunction } from 'i18next';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const SEED_RE = /^[A-Za-z0-9_-]{1,64}$/;

export interface SeedLink {
  seed: string;
  packId: string;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `?seed=…&pack=…` appended to the app's own address (no fragment, no other parameters). */
export function seedLinkFor(state: GameState, href: string): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', state.config.seed);
  url.searchParams.set('pack', state.packId);
  return url.toString();
}

/** A well-formed seed link from a query string, else null. Unknown packs and odd seeds are dropped. */
export function parseSeedLink(search: string): SeedLink | null {
  const params = new URLSearchParams(search);
  const seed = params.get('seed');
  const packId = params.get('pack');
  if (seed === null || packId === null) return null;
  if (!SEED_RE.test(seed)) return null;
  if (!WORLD.cities.some((c) => c.packId === packId)) return null;
  return { seed, packId };
}

/** The result card as a standalone SVG document (system fonts only, no external references). */
export function resultCardSvg(state: GameState, t: TFunction): string {
  const winner = state.winner === null ? null : state.players[state.winner];
  const rows = state.players
    .map((p, i) => {
      const y = 340 + i * 64;
      const worth = t('panel.preview.money', { n: p.cash + p.bank });
      const mark = p.seat === state.winner ? '★ ' : '';
      return (
        `<text x="80" y="${String(y)}" font-size="36" font-weight="600" fill="#f2f2f0">${escapeXml(mark + p.name)}</text>` +
        `<text x="1120" y="${String(y)}" font-size="36" text-anchor="end" fill="#f2f2f0">${escapeXml(worth)}</text>`
      );
    })
    .slice(0, 4)
    .join('');
  const title = t('share.title', { name: winner?.name ?? '', week: state.week });
  const foot = t('share.footer', { seed: state.config.seed, pack: state.packId });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(CARD_WIDTH)}" height="${String(CARD_HEIGHT)}" viewBox="0 0 ${String(CARD_WIDTH)} ${String(CARD_HEIGHT)}" font-family="system-ui, sans-serif">` +
    `<rect width="${String(CARD_WIDTH)}" height="${String(CARD_HEIGHT)}" fill="#121417"/>` +
    `<rect x="24" y="24" width="${String(CARD_WIDTH - 48)}" height="${String(CARD_HEIGHT - 48)}" rx="28" fill="#1c1f24" stroke="#5aa9e6" stroke-width="4"/>` +
    `<circle cx="120" cy="120" r="34" fill="none" stroke="#5aa9e6" stroke-width="14"/>` +
    `<text x="180" y="132" font-size="52" font-weight="800" fill="#f2f2f0">${escapeXml(t('app.title'))}</text>` +
    `<text x="80" y="230" font-size="46" font-weight="700" fill="#ffd166">${escapeXml(title)}</text>` +
    `<line x1="80" y1="268" x2="1120" y2="268" stroke="#3a3f47" stroke-width="3"/>` +
    `<text x="80" y="308" font-size="26" fill="#b5b8bd">${escapeXml(t('end.stat.netWorth'))}</text>` +
    rows +
    `<text x="80" y="580" font-size="26" fill="#b5b8bd">${escapeXml(foot)}</text>` +
    `</svg>`
  );
}

/** Rasterize an SVG string to PNG in the browser; null when canvas or image decode is missing. */
export function svgToPng(svg: string): Promise<Blob | null> {
  const doc = globalThis.document;
  if (typeof doc === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.onload = () => {
      const canvas = doc.createElement('canvas');
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
}
