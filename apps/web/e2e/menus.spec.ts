import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/**
 * The screens that are live at the M4 checkpoint (M4.2): title, setup, settings, stats, help.
 * The board and end screen are gated off behind app flags (ADR-0017); their e2e acceptance
 * criteria land with M4.3–M4.8.
 */
test('menu screens are reachable and pass axe', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-game').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New game');
  await expectNoA11yViolations(page);

  // Starting a game is blocked while the board UI is unbuilt, and the UI says which milestone.
  await expect(page.getByTestId('start-game')).toBeDisabled();
  await expect(page.getByTestId('board-gated')).toContainText('M4.3');

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByTestId('settings').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expectNoA11yViolations(page);

  await page.getByTestId('back').click();
  await page.getByTestId('stats').click();
  await expect(page.getByTestId('games-played')).toHaveText('0');
  await expectNoA11yViolations(page);

  await page.getByTestId('back').click();
  await page.getByTestId('how-to-play').click();
  await expect(page.getByRole('table')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('a gated screen explains itself instead of breaking the app', async ({ page }) => {
  await page.goto('/?ff=gameBoard');
  // The flag is on, but the board component does not exist yet: the router falls back.
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('unavailable')).toBeVisible();
  await expect(page.getByTestId('unavailable-milestone')).toContainText('M4.3');
  await expectNoA11yViolations(page);

  await page.getByTestId('unavailable-back').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hustle Ring');
});
