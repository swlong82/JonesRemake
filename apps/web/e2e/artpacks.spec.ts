/**
 * Art-pack import (ART_SPEC 17.6, M9.12): a partial pack replaces one building and falls back to
 * the bundled set for everything else; a pack with a script in an SVG is refused with a report.
 */
import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { expectNoA11yViolations } from './axe';

const BANK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="#c0392b"/></svg>';

function pack(svg: string): Buffer {
  const manifest = {
    schemaVersion: 1,
    id: 'red-bank',
    name: 'Red Bank',
    version: '1',
    stage: { width: 1600, height: 1000 },
    tintKeys: { primary: '#FF00FF', secondary: '#00FFFF' },
    assets: { 'building:bank': { file: 'bank.svg', width: 240, height: 240 } },
  };
  return Buffer.from(
    zipSync({
      'red-bank/manifest.json': strToU8(JSON.stringify(manifest)),
      'red-bank/files/bank.svg': strToU8(svg),
    }),
  );
}

test('import an art pack, play with it, refuse a malicious one', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) < 1024, 'one wide viewport covers the flow');
  await page.goto('/?ff=sceneUi,-tutorial');
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('art-packs')).toBeVisible();
  await page
    .getByTestId('artpack-file')
    .setInputFiles({ name: 'red-bank.zip', mimeType: 'application/zip', buffer: pack(BANK) });
  await expect(page.getByTestId('artpack-report')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('artset-red-bank')).toBeChecked();
  await expectNoA11yViolations(page);

  await page.getByTestId('artpack-file').setInputFiles({
    name: 'evil.zip',
    mimeType: 'application/zip',
    buffer: pack(BANK.replace('<rect', '<script>alert(1)</script><rect')),
  });
  await expect(page.getByTestId('artpack-report')).toHaveAttribute('data-ok', 'false');
  await expect(page.getByTestId('artpack-report')).toContainText('not on the allowlist');

  await page.getByTestId('back').click();
  await page.getByTestId('new-game').click();
  await page.getByTestId('seed').fill('e2e-artpack');
  await page.getByTestId('start-game').click();
  await page.getByTestId('exit').click();
  await expect(page.locator('img[data-art-key="building:bank"]')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('img[data-art-key="building:park"]')).not.toHaveAttribute(
    'src',
    /^blob:/,
  );
});
