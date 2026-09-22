import { expect, test, type Page } from '@playwright/test';
import type { GameStore } from '../src/store/gameStore';
import { expectNoA11yViolations } from './axe';

async function snapshot(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      globalThis as unknown as { __hustleRing: { useGame: { getState(): GameStore } } }
    ).__hustleRing.useGame
      .getState()
      .hash(),
  );
}
for (const pack of ['classic', 'modern-western']) {
  test(`${pack}: manual slots, reload equality, Continue, export/import and axe`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('new-game').click();
    await page.locator('#ruleset').selectOption(pack);
    await page.getByTestId('seed').fill('e2e-saves');
    await page.getByTestId('start-game').click();
    await page.getByTestId('action-Relax').click();
    const expected = await snapshot(page);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByRole('heading', { name: 'Save and load' })).toBeVisible();
    for (const n of [1, 2, 3]) {
      await page.getByRole('button', { name: `Save to Slot ${n}`, exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Game saved.');
    }
    await expectNoA11yViolations(page);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export current game' }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('save-Hustle-Ring-week1.json');
    const path = await file.path();
    await page.reload();
    await expect(page.getByTestId('continue')).toBeVisible();
    await page.getByRole('button', { name: 'Load / Import' }).click();
    await page.getByRole('button', { name: 'Load Slot 2', exact: true }).click();
    await expect(page.getByTestId('hud')).toBeVisible();
    expect(await snapshot(page)).toBe(expected);
    await page.keyboard.press('ControlOrMeta+s');
    await page.locator('#save-import').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{'),
    });
    await expect(page.getByRole('alert')).toContainText('damaged');
    expect(await snapshot(page)).toBe(expected);
    await page.locator('#save-import').setInputFiles(path);
    await expect(page.getByTestId('hud')).toBeVisible();
    expect(await snapshot(page)).toBe(expected);
    await page.reload();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('hud')).toBeVisible();
    expect(await snapshot(page)).toBe(expected);
  });
}

test('unavailable IndexedDB reports a recoverable error without claiming a save', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      get: () => {
        throw new Error('Unavailable');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('storage failed');
  await page.getByTestId('new-game').click();
  await page.getByTestId('start-game').click();
  await page.keyboard.press('ControlOrMeta+s');
  await page.getByRole('button', { name: 'Save to Slot 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('storage failed');
  await expect(page.getByRole('button', { name: 'Export current game' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Load Slot 1', exact: true })).toBeDisabled();
});
