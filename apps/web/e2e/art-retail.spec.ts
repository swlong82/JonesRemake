/** P1 cumulative pack: check the delivered archive and the supported browser import flow. */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '../../..');
const setDir = resolve(root, 'packages/art/sets/modern');
const zip = readFileSync(resolve(root, 'art/review/p1/modern-retail-v0.2.0.zip'));
const stores = [
  ['discount-store', 'MegaMart Marketplace'],
  ['clothing-boutique', 'Threadline'],
  ['electronics-store', 'GadgetHub'],
  ['grocery', 'FreshCart Grocery'],
] as const;

test('P1 archive contains exactly the eight source overrides and the v0.2.0 manifest', () => {
  const entries = unzipSync(zip);
  const manifest = JSON.parse(readFileSync(resolve(setDir, 'manifest.json'), 'utf8')) as {
    version: string;
    assets: Record<string, { file: string }>;
  };
  const assets = manifest.assets;
  expect(manifest.version).toBe('0.2.0');
  expect(Object.keys(assets)).toHaveLength(8);
  expect(
    Object.keys(entries)
      .filter((name) => !name.endsWith('/'))
      .sort(),
  ).toEqual(
    ['manifest.json', ...Object.values(assets).map((asset) => `files/${asset.file}`)].sort(),
  );
  for (const name of Object.keys(entries).filter((entry) => !entry.endsWith('/'))) {
    expect(Buffer.from(entries[name]!)).toEqual(readFileSync(resolve(setDir, name)));
  }
});

for (const modern of [false, true]) {
  test(`P1 ${modern ? 'modern' : 'default'} retail board at desktop and phone`, async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone provide the visual evidence');
    await page.goto('/?ff=-tutorial');
    if (modern) {
      await page.getByTestId('settings').click();
      const file = { name: 'modern-retail-v0.2.0.zip', mimeType: 'application/zip', buffer: zip };
      await page.getByTestId('artpack-file').setInputFiles(file);
      await expect(page.getByTestId('artpack-report')).toHaveAttribute('data-ok', 'true');
      await page.getByTestId('artpack-file').setInputFiles(file);
      await expect(page.getByTestId('artpack-report')).toHaveAttribute('data-ok', 'true');
      await page.reload();
      await page.getByTestId('settings').click();
      await expect(page.getByTestId('artset-@imported-modern')).toBeChecked();
      await page.getByTestId('back').click();
    } else {
      await page.getByTestId('settings').click();
      await page.getByTestId('artset-default').check();
      await page.getByTestId('back').click();
    }
    await page.getByTestId('new-game').click();
    await page.locator('#ruleset').selectOption('modern-western');
    await page.getByTestId('seed').fill('art-retail-p1');
    await page.getByTestId('start-game').click();
    await page.getByTestId('exit').click();
    for (const [id, label] of stores) {
      const image = page.locator(`img[data-art-key="building:${id}"]`);
      await expect(image).toHaveAttribute('src', modern ? /^blob:/ : /building\./);
      await expect(page.getByTestId(`square-${id}`)).toHaveAccessibleName(new RegExp(label));
      if (modern) {
        expect(
          await image.evaluate(async (img) => (await fetch((img as HTMLImageElement).src)).text()),
        ).toBe(readFileSync(resolve(setDir, `files/building.${id}.svg`), 'utf8'));
      }
      if (info.project.name === 'phone') {
        const box = await page.getByTestId(`square-${id}`).boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(page.locator('img[data-art-key="building:park"]')).not.toHaveAttribute(
      'src',
      /^blob:/,
    );
    const avatar = page.locator('img[data-art-key^="avatar:"]').first();
    const avatarSvg = await avatar.evaluate(async (img) =>
      (await fetch((img as HTMLImageElement).src)).text(),
    );
    expect(avatarSvg).not.toMatch(/#ff00ff|#00ffff/i);
    const out = resolve(root, 'art/review/p1');
    mkdirSync(out, { recursive: true });
    await page.screenshot({
      path: resolve(out, `${info.project.name}-${modern ? 'after' : 'before'}-board.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('P1 retail contact sheet at 240 and 44 pixels', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'fixed-size sheet');
  const picture = (set: string, id: string, width: number) =>
    `<img width="${width}" src="data:image/svg+xml;base64,${readFileSync(resolve(root, `packages/art/sets/${set}/files/building.${id}.svg`)).toString('base64')}" alt="">`;
  await page.setViewportSize({ width: 1260, height: 850 });
  await page.setContent(
    `<style>body{margin:0;padding:28px;background:#f5f0e7;color:#40524e;font:15px system-ui}h1{margin:0;font-size:28px}p{color:#63716a}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.asset{background:#fffaf1;border-radius:14px;padding:10px;text-align:center}.row{height:260px;display:flex;align-items:end;justify-content:center;gap:8px}h2{font-size:18px;margin:22px 0 10px}small{display:block;margin:8px}</style><h1>Soft-lit city / P1 retail exteriors</h1><p>Same 240 × 240 slot at native size and 44 px. Labels are HTML in the game.</p>${['default', 'modern'].map((set) => `<h2>${set === 'default' ? 'BEFORE · DEFAULT' : 'AFTER · MODERN v0.2.0'}</h2><div class="grid">${stores.map(([id, label]) => `<div class="asset"><div class="row">${picture(set, id, 240)}${picture(set, id, 44)}</div><small>${label}</small></div>`).join('')}</div>`).join('')}`,
  );
  await page
    .locator('img')
    .evaluateAll(async (imgs) =>
      Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: resolve(root, 'art/review/p1/contact-sheet.png'), fullPage: true });
});
