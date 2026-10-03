/** The bundled Modern set is visible without importing a zip and survives a reload. */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const root = resolve(import.meta.dirname, '../../..');
const retail = ['discount-store', 'clothing-boutique', 'electronics-store', 'grocery'] as const;

test('fresh desktop and phone profiles show bundled Modern, with Original available', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'tablet', 'desktop and phone cover the release views');
  await page.goto('/?ff=-tutorial');
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('artset-modern')).toBeChecked();
  await page.getByTestId('back').click();
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption('modern-western');
  await page.getByTestId('seed').fill('bundled-modern-release');
  await page.getByTestId('start-game').click();
  await page.getByTestId('exit').click();

  for (const id of retail) {
    const image = page.locator(`img[data-art-key="building:${id}"]`);
    await expect(image).toHaveAttribute('src', /building\./);
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    expect(
      await image.evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text()),
    ).toBe(
      readFileSync(resolve(root, `packages/art/sets/modern/files/building.${id}.svg`), 'utf8'),
    );
  }
  const park = page.locator('img[data-art-key="building:park"]');
  expect(await park.evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text())).toBe(
    readFileSync(resolve(root, 'packages/art/sets/default/files/building.park.svg'), 'utf8'),
  );
  const out = resolve(root, 'art/review/release');
  mkdirSync(out, { recursive: true });
  await page.screenshot({
    path: resolve(out, `${info.project.name}-modern-no-import.png`),
    fullPage: true,
    animations: 'disabled',
  });

  await page.reload();
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('artset-modern')).toBeChecked();
  await page.getByTestId('artset-default').check();
  await page.getByTestId('back').click();
  await page.reload();
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('artset-default')).toBeChecked();
});
