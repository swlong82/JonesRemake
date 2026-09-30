/** P0 evidence is captured through the public import and game UI, on every configured viewport. */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

const root = resolve(import.meta.dirname, '../../..');
const setDir = resolve(root, 'packages/art/sets/modern');
const zip = readFileSync(resolve(root, 'art/review/p0/modern-benchmark.zip'));

async function loaded(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('img[data-art-key]')
        .evaluateAll((imgs) =>
          imgs.every(
            (img) =>
              img instanceof HTMLImageElement &&
              img.complete &&
              img.naturalWidth > 0 &&
              !img.src.startsWith('data:'),
          ),
        ),
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
}

for (const modern of [false, true]) {
  test(`P0 ${modern ? 'modern' : 'default'}: import, four slots, labels, tint and accessible travel`, async ({
    page,
  }, info) => {
    await page.goto('/?ff=-tutorial');
    if (modern) {
      await page.getByTestId('settings').click();
      await page
        .getByTestId('artpack-file')
        .setInputFiles({ name: 'modern.zip', mimeType: 'application/zip', buffer: zip });
      await expect(page.getByTestId('artpack-report')).toHaveAttribute('data-ok', 'true');
      await expect(page.getByTestId('artset-modern')).toBeChecked();
      await page.reload();
      await page.getByTestId('settings').click();
      await expect(page.getByTestId('artset-modern')).toBeChecked();
      await page.getByTestId('back').click();
    }
    await page.getByTestId('new-game').click();
    await page.locator('#ruleset').selectOption('modern-western');
    await page.getByTestId('seed').fill('art-benchmark-p0');
    await page.getByTestId('start-game').click();
    await loaded(page);
    const room = page.locator('img[data-art-key="interior:low-housing"]');
    await expect(room).toBeVisible();
    if (modern) {
      expect(
        await room.evaluate(async (img) => (await fetch((img as HTMLImageElement).src)).text()),
      ).toBe(readFileSync(resolve(setDir, 'files/interior.low-housing.svg'), 'utf8'));
    }
    await expect(room).toHaveAttribute('src', modern ? /^blob:/ : /interior.low-housing/);
    await expect(page.getByTestId('panel-location')).toHaveText('Co-Living Pod');
    await expectNoA11yViolations(page);
    const out = resolve(root, 'reports/art-benchmark');
    mkdirSync(out, { recursive: true });
    const prefix = `${info.project.name}-${modern ? 'after' : 'before'}`;
    await page.screenshot({
      path: resolve(out, `${prefix}-interior.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByTestId('exit').click();
    await loaded(page);
    for (const [id, name] of [
      ['low-housing', 'Co-Living Pod'],
      ['burger-joint', 'Burger Stack'],
      ['bank', 'NeoBank Branch'],
    ]) {
      await expect(page.locator(`img[data-art-key="building:${id}"]`)).toHaveAttribute(
        'src',
        modern ? /^blob:/ : /building\./,
      );
      await expect(page.getByTestId(`square-${id}`)).toHaveAccessibleName(new RegExp(name!));
      if (modern) {
        const svg = await page
          .locator(`img[data-art-key="building:${id}"]`)
          .evaluate(async (img) => (await fetch((img as HTMLImageElement).src)).text());
        expect(svg).toBe(readFileSync(resolve(setDir, `files/building.${id}.svg`), 'utf8'));
      }
      if (info.project.name === 'phone') {
        const bounds = await page.getByTestId(`square-${id}`).boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
    }
    // Inherited avatar still resolves through the real tint pipeline; no raw magenta/cyan.
    const avatar = page.locator('img[data-art-key^="avatar:"]').first();
    await expect(avatar).toHaveAttribute('src', /^blob:/);
    const tintSvg = await avatar.evaluate(async (img) =>
      (await fetch((img as HTMLImageElement).src)).text(),
    );
    expect(tintSvg).not.toMatch(/#ff00ff|#00ffff/i);
    // The unchanged outside-home action list has no enabled focusable child (see P0 review).
    // Audit the board controls here; the complete interior page is audited above.
    const boardAudit = await new AxeBuilder({ page })
      .include('[data-testid="scene-board"], [data-testid="phone-scene"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(boardAudit.violations).toEqual([]);
    await page.screenshot({
      path: resolve(out, `${prefix}-board.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByTestId('square-bank').click();
    await expect(page.getByTestId('travel-sheet')).toBeVisible();
    await page.getByTestId('travel-go').click();
    await expect(page.getByTestId('panel-location')).toHaveText('NeoBank Branch');
  });
}

test('P0 comparison sheet: matching native and phone sizes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one contact sheet uses fixed comparison dimensions');
  const picture = (set: string, file: string, width: number) =>
    `<img width="${width}" src="data:image/svg+xml;base64,${readFileSync(resolve(root, `packages/art/sets/${set}/files/${file}`)).toString('base64')}" alt="">`;
  const buildings = ['low-housing', 'burger-joint', 'bank'];
  const labels = ['Co-Living Pod', 'Burger Stack', 'NeoBank'];
  await page.setViewportSize({ width: 1240, height: 1140 });
  await page.setContent(
    `<style>body{margin:0;padding:32px;background:#f5f0e7;color:#40524e;font:16px system-ui}h1{margin:0;font-size:30px}p{color:#63716a}section{display:grid;grid-template-columns:100px repeat(3,1fr);align-items:center;gap:12px;margin:20px 0}.asset{background:#fffaf1;border-radius:16px;text-align:center;padding:12px}.row{display:flex;gap:28px;align-items:end;justify-content:center}.rooms{display:grid;grid-template-columns:500px 500px;gap:20px}.rooms img{width:100%;border-radius:16px}h2{font-size:16px;letter-spacing:1px}small{display:block;margin-top:8px}</style><h1>Soft-lit city / P0 benchmark</h1><p>Same slot, same scale. Buildings: 240 px + 44 px. Room: 500 × 312.5 px. No game UI changes.</p>${['default', 'modern'].map((set) => `<section><h2>${set === 'default' ? 'BEFORE' : 'AFTER'}</h2>${buildings.map((id, i) => `<div class="asset"><div class="row">${picture(set, `building.${id}.svg`, 240)}${picture(set, `building.${id}.svg`, 44)}</div><small>${labels[i]}</small></div>`).join('')}</section>`).join('')}<h2>CO-LIVING / MATCHING INTERIOR</h2><div class="rooms">${['default', 'modern'].map((set) => `<div>${picture(set, 'interior.low-housing.svg', 500)}<small>${set === 'default' ? 'Before' : 'After'} · full room, before host and action overlays</small></div>`).join('')}</div>`,
  );
  await page
    .locator('img')
    .evaluateAll(async (imgs) =>
      Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())),
    );
  await page.screenshot({
    path: resolve(root, 'reports/art-benchmark/contact-sheet.png'),
    fullPage: true,
  });
});
