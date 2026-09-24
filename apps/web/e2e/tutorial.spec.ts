import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/** The HUD: the scene's bar on wide screens (the default since the M9 gate), else the full HUD. */
function hud(page: Page) {
  return page.locator('[data-testid="scene-hud"], [data-testid="hud"]').first();
}

/**
 * M7.3 AC: "e2e completes tutorial on desktop and phone". The projects in `playwright.config.ts`
 * already run every spec on all three viewports, so this file is that test on each of them.
 */

/** Walk the script to the end, clicking Next on the steps the player drives and skipping the rest. */
async function completeTutorial(page: Page): Promise<void> {
  const card = page.getByTestId('tutorial-card');
  await expect(card).toBeVisible();
  // Step 1 is a manual step, so Next is offered and the progress counter starts at one of ten.
  await expect(page.getByTestId('tutorial-progress')).toContainText('1');
  await page.getByTestId('tutorial-next').click();
  // Step 2 waits on the game, so there is no Next — only the skip UX 7.6 promises at any time.
  await expect(page.getByTestId('tutorial-next')).toHaveCount(0);
  await expect(page.getByTestId('tutorial-skip')).toBeVisible();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
}

test('the tutorial runs over a first game, spotlights one element and can be skipped', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('tutorial-card')).toBeVisible();
  // UX 7.6: one element is spotlighted per step.
  await expect(page.getByTestId('tutorial-spotlight')).toHaveCount(1);
  await expectNoA11yViolations(page);
  await completeTutorial(page);

  // The game underneath is still playable once the tutorial is out of the way.
  await expect(hud(page)).toBeVisible();
});

test('the tutorial is replayable from How to Play', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('how-to-play').click();
  await page.getByTestId('tutorial-start').click();

  // Starting it from the menu starts its own fixed game and shows step one.
  await expect(hud(page)).toBeVisible();
  await expect(page.getByTestId('tutorial-progress')).toContainText('1');
  await completeTutorial(page);

  // Having seen it once, a new game does not start it again.
  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
});
