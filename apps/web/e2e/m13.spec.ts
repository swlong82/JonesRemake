/**
 * M13 playability pass: double-click travel, result pop-ups and the goal/job/home/studies cards,
 * on all three viewports with axe on each new surface.
 */
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function quickStart(page: Page): Promise<void> {
  await page.goto('/?ff=-tutorial');
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId(isPhone(page) ? 'phone-status' : 'scene-hud')).toBeVisible();
}

for (const [btn, extra] of [
  ['info-job-btn', 'info-job-none'],
  ['info-home-btn', 'info-home-rent'],
  ['info-edu-btn', 'info-title'],
] as const) {
  test(`${btn} opens a card that closes on Escape`, async ({ page }) => {
    await quickStart(page);
    await page.getByTestId(btn).first().click();
    await expect(page.getByTestId('info-modal')).toBeVisible();
    await expect(page.getByTestId(extra)).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('info-modal')).toHaveCount(0);
  });
}

test('double-clicking a place travels there without the sheet', async ({ page }) => {
  await quickStart(page);
  if (isPhone(page)) return; // The phone map pans on touch; the list has its own double-tap.
  if (await page.getByTestId('scene-interior').isVisible()) await page.getByTestId('exit').click();
  const square = page.locator('[data-testid^="square-"]:not([aria-current="true"])').first();
  const id = (await square.getAttribute('data-testid')) ?? '';
  await square.dblclick();
  await expect(page.getByTestId('travel-sheet')).toHaveCount(0);
  await expect(page.getByTestId(id)).toHaveAttribute('aria-current', 'true');
});
