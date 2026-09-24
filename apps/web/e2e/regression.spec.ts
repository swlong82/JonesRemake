import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/**
 * M8.3 full regression (MILESTONES M8): a four-seat hotseat modern game to week 10 with a save and
 * load in the middle, and a phone game played to a winner on autoplay.
 */

/**
 * Move play along: pass the device, dismiss a card, or end the turn — whichever is showing. Clicks
 * carry a timeout so a screen swapped mid-click is retried rather than waited on for ever.
 */
async function advance(page: Page): Promise<void> {
  if (await page.getByTestId('ready').isVisible()) {
    await page.getByTestId('ready').click({ timeout: 5_000 });
    return;
  }
  if (await page.getByTestId('event-dismiss').isVisible()) {
    await page.getByTestId('event-dismiss').click({ timeout: 5_000 });
    return;
  }
  if (await page.getByTestId('end-turn').isVisible()) {
    await page.getByTestId('end-turn').click({ timeout: 5_000 });
    if (await page.getByTestId('end-turn-confirm').isVisible())
      await page.getByTestId('end-turn-confirm').click({ timeout: 5_000 });
  }
}

/** The HUD week, or 0 while the HUD is not showing (the pass screen, a card). Never waits. */
async function weekOf(page: Page): Promise<number> {
  const week = page.getByTestId('week');
  if (!(await week.isVisible())) return 0;
  const text = (await week.textContent()) ?? '';
  return Number(/\d+/.exec(text)?.[0] ?? 0);
}

async function playToWeek(page: Page, week: number): Promise<void> {
  await expect(async () => {
    await advance(page);
    expect(await weekOf(page)).toBeGreaterThanOrEqual(week);
  }).toPass({ timeout: 240_000, intervals: [50] });
}

test('four-seat hotseat modern game to week 10, with a save and load at week 5', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one long game, on desktop');
  test.setTimeout(420_000);
  await page.goto('/?ff=-tutorial');
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption('modern-western');
  await page.getByTestId('add-seat').click();
  await page.getByTestId('add-seat').click();
  for (const i of [1, 2, 3]) {
    await page.locator(`#type-${i}`).selectOption('human-local');
    await page.locator(`#name-${i}`).fill(`Player ${i + 1}`);
  }
  await page.getByTestId('seed').fill('regression-hotseat');
  await page.getByTestId('start-game').click();
  // A hotseat game opens on the pass-the-device screen.
  await page.getByTestId('ready').click({ timeout: 5_000 });
  await expect(page.getByTestId('hud')).toBeVisible();

  await playToWeek(page, 5);
  // Save at the start of a human turn, then note what the HUD shows.
  await expect(async () => {
    await advance(page);
    await expect(page.getByTestId('hud')).toBeVisible({ timeout: 500 });
    await expect(page.getByTestId('ready')).toBeHidden({ timeout: 500 });
  }).toPass({ timeout: 30_000 });
  const saved = await page.getByTestId('hud').innerText();
  await page.keyboard.press('ControlOrMeta+s');
  await page.getByRole('button', { name: 'Save to Slot 1', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Game saved.');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('hud')).toBeVisible();

  await playToWeek(page, 10);
  expect(await weekOf(page)).toBeGreaterThanOrEqual(10);
  await expectNoA11yViolations(page);

  // Loading slot 1 returns the game to week 5, exactly as saved.
  await page.reload();
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.getByRole('button', { name: 'Load Slot 1', exact: true }).click();
  // The loaded hotseat game hands the device to the seat whose turn it is.
  await page.getByTestId('ready').click({ timeout: 5_000 });
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(await page.getByTestId('hud').innerText()).toBe(saved);
});

test('a phone game plays to a winner on autoplay', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the M8 regression names the phone');
  test.setTimeout(420_000);
  await page.goto('/?ff=-tutorial,debugTools&debug=1');
  await page.getByTestId('new-game').click();
  await page.getByTestId('preset-quick').click();
  await page.locator('#diff-1').selectOption('easy');
  await page.locator('#aispeed').selectOption('instant');
  await page.getByTestId('seed').fill('regression-autoplay');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await page.getByTestId('debug-autoplay').click();
  await expect(page.getByTestId('end-heading')).toBeVisible({ timeout: 400_000 });
  await expect(page.getByTestId('end-heading')).toContainText('wins in week');
  await expectNoA11yViolations(page);
});
