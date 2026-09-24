/**
 * Scene UI (ART_SPEC 17.9, M9.6–M9.8) behind the `sceneUi` flag: the city block, the HUD bar,
 * travel from a building, and the axe gate on every viewport. Phones keep the list layout until
 * M9.9, so they check that the flag leaves it intact.
 */
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function startScene(page: Page): Promise<void> {
  await page.goto('/?ff=sceneUi,-tutorial');
  await page.getByTestId('new-game').click();
  await page.getByTestId('seed').fill('e2e-scene');
  await page.getByTestId('start-game').click();
}

test('the scene board travels by building and passes axe', async ({ page }) => {
  await startScene(page);
  if (isPhone(page)) {
    await expect(page.getByTestId('phone-locations')).toBeVisible();
    await expect(page.getByTestId('scene-screen')).toHaveCount(0);
    return;
  }
  await expect(page.getByTestId('scene-screen')).toBeVisible();
  await expect(page.getByTestId('scene-hud')).toBeVisible();
  await expect(page.getByTestId('scene-cash')).toHaveText('$200');
  await expectNoA11yViolations(page);

  await page.getByTestId('exit').click();
  await page.getByTestId('square-bank').click();
  await expect(page.getByTestId('travel-sheet')).toBeVisible();
  await page.getByTestId('travel-go').click();
  await expect(page.getByTestId('panel-location')).toHaveText('Bank');
  await expect(page.getByTestId('square-bank')).toHaveAttribute('aria-current', 'true');

  // The ring keyboard map still works on the scene (UX 7.7): "2" is the rent office.
  await page.keyboard.press('2');
  await expect(page.getByTestId('travel-sheet')).toContainText('Rent Office');
  await expectNoA11yViolations(page);
});
