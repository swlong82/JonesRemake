/**
 * M12 UX pass: quick start, undo, the command palette, the goal levers, coach marks, the hours strip,
 * the result card and seed link, on all three viewports with axe on each new surface.
 */
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function quickStart(page: Page, query = '?ff=-tutorial'): Promise<void> {
  await page.goto(`/${query}`);
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId(isPhone(page) ? 'phone-status' : 'scene-hud')).toBeVisible();
}

test('quick start goes from the title to a playable game in one click', async ({ page }) => {
  await page.goto('/?ff=-tutorial');
  await expectNoA11yViolations(page);
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('location-panel')).toBeVisible();
  await expect(page.getByTestId('hours-strip')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('undo takes back an action, by button and by key', async ({ page }) => {
  await quickStart(page);
  const relax = page.getByTestId('action-Relax');
  const undo = page.getByTestId('undo-btn');
  await expect(undo).toBeDisabled();
  await relax.click();
  await expect(relax).toBeDisabled();
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(relax).toBeEnabled();
  await relax.click();
  await expect(relax).toBeDisabled();
  if (!isPhone(page)) {
    await page.keyboard.press('Control+z');
    await expect(relax).toBeEnabled();
  }
});

test('the command palette finds a place and an action', async ({ page }) => {
  await quickStart(page);
  await page.getByTestId('palette-btn').click();
  await expect(page.getByTestId('palette')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByTestId('palette-input').fill('bank');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('palette')).toHaveCount(0);
  await expect(page.getByTestId('travel-sheet')).toBeVisible();
  await page.getByTestId('travel-cancel').click();

  if (!isPhone(page)) {
    await page.keyboard.press('/');
    await expect(page.getByTestId('palette-input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('palette')).toHaveCount(0);
  }
});

test('a goal bar explains what moves it', async ({ page }) => {
  await quickStart(page);
  if (isPhone(page)) return; // The phone shows goals in the full HUD only.
  await page.getByTestId('goal-btn-happiness').click();
  await expect(page.getByTestId('levers-happiness')).toBeVisible();
  await expect(page.getByTestId('lever-do-Relax')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('the result card and seed link are offered on the end screen', async ({ page }) => {
  await page.goto('/?debug=1&ff=debugTools,-tutorial');
  await page.getByTestId('quick-start').click();
  await expect(page.getByTestId('location-panel')).toBeVisible();
  // The e2e build exposes the store (UX_SPEC 7.9); end the game the way game.spec.ts does.
  await page.evaluate(() => {
    const store = (
      globalThis as unknown as {
        __hustleRing: {
          useGame: { getState: () => Record<string, unknown>; setState: (p: unknown) => void };
        };
      }
    ).__hustleRing.useGame;
    const state = store.getState().state as Record<string, unknown>;
    store.setState({ state: { ...state, winner: 0, week: 3 }, screen: 'end' });
  });
  await expect(page.getByTestId('share-row')).toBeVisible();
  const url = await page.getByTestId('share-url').inputValue();
  expect(url).toMatch(/[?&]seed=[\w-]+&pack=modern-western$/);
  const download = page.waitForEvent('download');
  await page.getByTestId('share-card').click();
  expect((await download).suggestedFilename()).toMatch(/^result-.*\.png$/);
  await expect(page.getByTestId('share-note')).toContainText('saved');
  await expectNoA11yViolations(page);
});

test('a shared seed link opens setup with that seed and city', async ({ page }) => {
  await page.goto('/?seed=shared-1&pack=classic&ff=-tutorial');
  await expect(page.getByTestId('seed')).toHaveValue('shared-1');
  await expect(page.locator('#ruleset')).toHaveValue('classic');
  await expectNoA11yViolations(page);
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId(isPhone(page) ? 'phone-status' : 'scene-hud')).toBeVisible();
});

test('the app offers a web manifest for install', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href ?? '', page.url()).toString());
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { display: string; icons: unknown[] };
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);
});
