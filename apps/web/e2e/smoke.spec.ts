import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

test('title page renders on every viewport and passes axe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hustle Ring');
  await expect(page.getByTestId('version')).toContainText('Engine');
  await expectNoA11yViolations(page);
});
