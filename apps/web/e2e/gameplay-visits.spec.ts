import { expect, test } from '@playwright/test';
import { clickPlace } from './hud';

test('map starts the round and a single place click enters with job locations shown', async ({
  page,
}) => {
  await page.goto('/?ff=-tutorial');
  await page.getByTestId('new-game').click();
  await page.getByTestId('seed').fill('gameplay-visits');
  await page.getByTestId('start-game').click();

  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  await expect(page.getByTestId(phone ? 'phone-scene' : 'scene-board')).toBeVisible();
  await expect(page.getByTestId('panel-state')).toHaveText('Open');
  if (!phone) {
    await page.getByTestId('square-low-housing').click();
    await expect(page.getByTestId('scene-interior')).toHaveAttribute(
      'aria-label',
      'Inside Low-Cost Housing',
    );
  }

  await clickPlace(page, 'employment-office');
  await expect(page.getByTestId('travel-sheet')).toHaveCount(0);
  await expect(page.getByTestId('panel-location')).toHaveText('Employment Office');
  await expect(page.getByTestId('panel-state')).toHaveText('Open');
  if (!phone)
    await expect(page.getByTestId('scene-interior')).toHaveAttribute(
      'aria-label',
      'Inside Employment Office',
    );

  const list = page.getByTestId('apply-list');
  await expect(list).toBeVisible();
  await expect(list.getByTestId('job-location').first()).toBeVisible();
  await expect(list.getByTestId('job-location').first()).toContainText(/^At /);
});
