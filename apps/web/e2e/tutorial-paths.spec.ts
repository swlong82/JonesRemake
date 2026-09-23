import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/**
 * M8.3 (ADR-0037): every way through the tutorial. Its ten steps (UX 7.6) advance on the player's
 * own actions, so reaching step N means playing steps 1…N−1 for real on the fixed tutorial seed.
 * The desktop project runs every path; tablet and phone run the complete path and Escape.
 */

const progress = (page: Page) => page.getByTestId('tutorial-progress');

async function startFromHowToPlay(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('how-to-play').click();
  await page.getByTestId('tutorial-start').click();
  await expect(progress(page)).toContainText('1');
}

/**
 * Travel by the square's keyboard shortcut (UX 7.7), read from its label: a square with a rival's
 * token on it animates, which a pointer click in the test would wait on forever.
 */
async function travelTo(page: Page, locationId: string): Promise<void> {
  const label = (await page.getByTestId(`square-${locationId}`).getAttribute('aria-label')) ?? '';
  const key = /Press (\S+) to travel/.exec(label)?.[1];
  expect(key, label).toBeDefined();
  await page.keyboard.press(key!);
  await page.getByTestId('travel-go').click();
  await page.getByTestId('enter').click();
}

async function act(page: Page, prefix: string): Promise<void> {
  await page.locator(`[data-testid^="action-${prefix}"]`).first().click();
}

/** Play the script until step `n` (1-based) is showing. */
async function reachStep(page: Page, n: number): Promise<void> {
  const steps: (() => Promise<void>)[] = [
    () => page.getByTestId('tutorial-next').click(), // 1 welcome
    () => travelTo(page, 'employment-office'), // 2 travel
    () => act(page, 'ApplyJob:jobId=burger-joint-cook'), // 3 apply (always hires)
    async () => {
      await travelTo(page, 'burger-joint'); // 4 work
      await act(page, 'Work');
    },
    () => act(page, 'EatMeal'), // 5 eat
    async () => {
      await travelTo(page, 'university'); // 6 enrol
      await act(page, 'Enroll');
    },
    async () => {
      await travelTo(page, 'low-housing'); // 7 relax
      await act(page, 'Relax');
    },
    async () => {
      await page.getByTestId('end-turn').click(); // 8 end the turn
      await page.getByTestId('end-turn-confirm').click();
    },
    () => page.getByTestId('tutorial-next').click(), // 9 bank
  ];
  for (let i = 0; i < n - 1; i++) {
    await steps[i]!();
    await expect(progress(page)).toContainText(String(i + 2));
  }
}

test('the tutorial can be played to the end', async ({ page }) => {
  await startFromHowToPlay(page);
  await reachStep(page, 10);
  await expectNoA11yViolations(page);
  await page.getByTestId('tutorial-next').click(); // 10 done → Finish
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
  await expect(page.getByTestId('hud')).toBeVisible();
});

for (let n = 1; n <= 10; n++) {
  test(`skipping at step ${n} ends the tutorial and leaves the game playable`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'every step on desktop only');
    await startFromHowToPlay(page);
    await reachStep(page, n);
    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('tutorial')).toHaveCount(0);
    await expect(page.getByTestId('hud')).toBeVisible();
  });
}

test('Escape on the tutorial card skips it; Escape elsewhere is left to the game', async ({
  page,
}) => {
  await startFromHowToPlay(page);
  await reachStep(page, 2);
  // Escape while the travel sheet has focus closes the sheet, not the tutorial.
  await page.getByTestId('square-employment-office').click();
  await expect(page.getByTestId('travel-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('travel-sheet')).toBeHidden();
  await expect(progress(page)).toContainText('2');
  await page.getByTestId('tutorial-skip').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tutorial')).toHaveCount(0);
});

test('a finished tutorial replays from How to Play', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await startFromHowToPlay(page);
  await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('menu-btn').click();
  await page.getByTestId('menu-quit').click();
  await page.getByTestId('menu-quit-confirm').click();
  await startFromHowToPlay(page);
  await expect(page.getByTestId('tutorial-card')).toBeVisible();
});

test('the spotlight follows its element when the window is resized mid-step', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await startFromHowToPlay(page);
  await reachStep(page, 3); // the location panel is spotlighted
  const overlaps = async (): Promise<boolean> => {
    const spot = await page.getByTestId('tutorial-spotlight').boundingBox();
    const panel = await page.getByTestId('location-panel').boundingBox();
    if (!spot || !panel) return false;
    return (
      Math.abs(spot.x - panel.x) < 12 &&
      Math.abs(spot.y - panel.y) < 12 &&
      Math.abs(spot.width - panel.width) < 24
    );
  };
  expect(await overlaps()).toBe(true);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect.poll(overlaps).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(overlaps).toBe(true);
});
