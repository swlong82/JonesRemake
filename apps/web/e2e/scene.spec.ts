/**
 * Scene UI (ART_SPEC 17.9, M9.6–M9.8) behind the `sceneUi` flag: the city block, the HUD bar,
 * interiors, travel from a building, the avatar picker and the axe gate on every viewport.
 * Phones keep the list layout until M9.9, with the cropped room header of M9.8.
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
    // Phones keep the list layout (M9.9) with a cropped room header while inside (M9.8).
    await expect(page.getByTestId('phone-locations')).toBeVisible();
    await expect(page.getByTestId('scene-screen')).toHaveCount(0);
    await expect(page.getByTestId('interior-header')).toBeVisible();
    await expect(page.getByTestId('host-speech')).not.toBeEmpty();
    await expectNoA11yViolations(page);
    return;
  }
  await expect(page.getByTestId('scene-screen')).toBeVisible();
  await expect(page.getByTestId('scene-hud')).toBeVisible();
  await expect(page.getByTestId('scene-cash')).toHaveText('$200');

  // Turns start inside the home: its room, host and greeting, with the panel in the room.
  await expect(page.getByTestId('scene-interior')).toBeVisible();
  await expect(page.getByTestId('host-speech')).not.toBeEmpty();
  await expect(page.getByTestId('interior-panel').getByTestId('location-panel')).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByTestId('exit').click();
  await expect(page.getByTestId('scene-board')).toBeVisible();
  await expect(page.getByTestId('avatar-0')).toHaveAttribute('data-pose', 'idle');
  await expectNoA11yViolations(page);

  await page.getByTestId('square-bank').click();
  await expect(page.getByTestId('travel-sheet')).toBeVisible();
  await page.getByTestId('travel-go').click();
  await expect(page.getByTestId('panel-location')).toHaveText('Bank');
  await expect(page.getByTestId('square-bank')).toHaveAttribute('aria-current', 'true');

  // The ring keyboard map still works on the scene (UX 7.7): "2" is the rent office.
  await page.keyboard.press('2');
  await expect(page.getByTestId('travel-sheet')).toContainText('Rent Office');
  await page.getByTestId('travel-cancel').click();

  await page.getByTestId('enter').click();
  await expect(page.getByTestId('scene-interior')).toHaveAttribute('aria-label', 'Inside Bank');
  await expect(page.getByTestId('section-bank')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('the avatar picker records the chosen avatar', async ({ page }) => {
  await page.goto('/?ff=sceneUi,-tutorial');
  await page.getByTestId('new-game').click();
  await page.getByTestId('avatar-picker-0').getByText('Avatar 4').click();
  await expect(page.getByTestId('avatar-0-player-4')).toBeChecked();
  await expectNoA11yViolations(page);
  await page.getByTestId('seed').fill('e2e-avatar');
  await page.getByTestId('start-game').click();
  if (isPhone(page)) return;
  await expect(page.getByTestId('hud-avatar')).toHaveAttribute(
    'data-art-key',
    'avatar:player-4:idle:s',
  );
});
