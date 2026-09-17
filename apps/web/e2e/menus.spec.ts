import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/** Menu screens (UX 7.1): title, setup, settings, stats, help. Board specs live in game.spec.ts. */
test('menu screens are reachable and pass axe', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-game').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New game');
  await expectNoA11yViolations(page);

  await expect(page.getByTestId('start-game')).toBeEnabled();

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

test('an unfinished feature is still offered, but disabled with the milestone named', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('how-to-play').click();
  await expect(page.getByText('The guided tutorial arrives with milestone M7.')).toBeVisible();
  await page.getByTestId('back').click();
  await page.getByTestId('stats').click();
  await expect(page.getByText('Local leaderboard arrives with milestone M8.')).toBeVisible();
  await expectNoA11yViolations(page);
});
