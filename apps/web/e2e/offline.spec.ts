/**
 * Offline play (ART_SPEC 17.8, M9.11): once the service worker has precached the build, a reload
 * with the network off still starts a game and draws the city block with its art.
 */
import { expect, test } from '@playwright/test';

test('an offline reload renders the scene board from the precache', async ({ page, context }) => {
  test.skip((page.viewportSize()?.width ?? 1440) < 1024, 'one viewport is enough for the cache');
  await page.goto('/?ff=sceneUi,-tutorial');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  // The page is controlled once the worker has claimed it.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('new-game').click();
  await page.getByTestId('seed').fill('e2e-offline');
  await page.getByTestId('start-game').click();
  await page.getByTestId('exit').click();
  await expect(page.getByTestId('scene-board')).toBeVisible();
  const building = page.locator('img[data-art-key="building:bank"]');
  await expect
    .poll(() => building.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await context.setOffline(false);
});
