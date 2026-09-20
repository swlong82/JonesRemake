import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/**
 * Board acceptance criteria (M4 gate): a classic game is playable on all three viewports, the board
 * and its modals pass axe, and the keyboard map works. States that take a whole game to reach are
 * set through the debug-only store hook of the e2e build (UX_SPEC 7.9).
 */

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

async function startGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.getByTestId('new-game').click();
  await page.getByTestId('seed').fill('e2e-board');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
}

async function startModernGame(page: Page): Promise<void> {
  await page.goto('/?debug=1&ff=debugTools');
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption('modern-western');
  await page.getByTestId('seed').fill('e2e-modern');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
}

test('plays a classic turn on the board and passes axe', async ({ page }) => {
  await startGame(page);

  await expect(page.getByTestId('week')).toContainText('1');
  await expect(page.getByTestId('cash')).toContainText('$');
  await expect(page.getByTestId(isPhone(page) ? 'board-mini' : 'board')).toBeVisible();
  if (isPhone(page)) await expect(page.getByTestId('phone-locations')).toBeVisible();
  await expectNoA11yViolations(page);

  // You start inside your home (GDD 4.1.6): relax, then travel to the bank and enter it.
  await expect(page.getByTestId('panel-state')).toHaveText('Open');
  await page.getByTestId('action-Relax').click();
  await expect(page.getByTestId('action-Relax')).toBeDisabled();

  await page.getByTestId('exit').click();
  await page.getByTestId(isPhone(page) ? 'phone-loc-bank' : 'square-bank').click();
  await expect(page.getByTestId('travel-sheet')).toBeVisible();
  await expect(page.getByTestId('mode-walk')).toBeVisible();
  await page.getByTestId('travel-go').click();
  await expect(page.getByTestId('panel-location')).toHaveText('Bank');

  await page.getByTestId('enter').click();
  await expect(page.getByTestId('section-bank')).toBeVisible();
  await expectNoA11yViolations(page);

  // Ending the turn with hours left asks first (UX 7.7).
  await page.getByTestId('end-turn').click();
  await page.getByTestId('end-turn-confirm').click();
  await expect(page.getByTestId('week')).toContainText('2');
});

test('standings, log and the keyboard map', async ({ page }) => {
  await startGame(page);

  await page.getByTestId('standings-btn').click();
  await expect(page.getByTestId('standings')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByTestId('standings-close').click();

  await page.keyboard.press('l');
  await expect(page.getByTestId('log-drawer')).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.getByTestId('standings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('standings')).toBeHidden();

  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('menu-hash')).toContainText(/[0-9a-f]/);
  await expectNoA11yViolations(page);
});

test('an event card is readable, dismissible and passes axe', async ({ page }) => {
  await startGame(page, '?debug=1&ff=debugTools');
  await expect(page.getByTestId('debug-panel')).toBeVisible();

  await page.evaluate(() => {
    const store = (
      globalThis as unknown as { __hustleRing: { useGame: { setState: (p: unknown) => void } } }
    ).__hustleRing.useGame;
    store.setState({
      cards: [
        {
          type: 'EventFired',
          seat: 0,
          eventId: 'found-cash',
          effects: ['money:cash:40'],
          seq: 99,
          week: 1,
        },
      ],
    });
  });

  await expect(page.getByTestId('event-modal')).toBeVisible();
  await expect(page.getByTestId('event-title')).toHaveText('Found cash');
  await expectNoA11yViolations(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('event-modal')).toBeHidden();
});

test('the end screen shows the goal chart and passes axe', async ({ page }) => {
  await startGame(page, '?debug=1&ff=debugTools');

  await page.evaluate(() => {
    const store = (
      globalThis as unknown as {
        __hustleRing: {
          useGame: { getState: () => Record<string, unknown>; setState: (p: unknown) => void };
        };
      }
    ).__hustleRing.useGame;
    const state = store.getState().state as {
      players: { history: unknown[] }[];
      [k: string]: unknown;
    };
    const players = state.players.map((p) => ({
      ...p,
      history: [
        { week: 1, goals: [0, 10, 1, 0] },
        { week: 2, goals: [20, 30, 10, 12] },
      ],
    }));
    store.setState({ state: { ...state, players, winner: 0, week: 2 }, screen: 'end' });
  });

  await expect(page.getByTestId('end-heading')).toContainText('week 2');
  await expect(page.getByTestId('goal-chart')).toBeVisible();
  await expect(page.getByTestId('end-stats')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('modern actions, costs and unavailable reasons are exposed through the interface', async ({
  page,
}) => {
  await startModernGame(page);

  await expect(page.getByTestId('wellbeing')).toBeVisible();
  await expect(page.getByTestId('subscription-total')).toBeVisible();
  await expect(page.getByTestId('loan-due')).toBeVisible();
  await expect(page.getByTestId('section-delivery')).toBeVisible();
  await expect(
    page.getByTestId('section-delivery').getByTestId('disabled-reason').first(),
  ).toBeVisible();

  // Gig signup is scoped to the employment office and keeps its requirement visible when locked.
  await page.getByTestId('exit').click();
  await page
    .getByTestId(isPhone(page) ? 'phone-loc-employment-office' : 'square-employment-office')
    .click();
  await page.getByTestId('travel-go').click();
  await page.getByTestId('enter').click();
  await expect(page.getByTestId('section-gig')).toBeVisible();
  await expect(
    page.getByTestId('section-gig').getByTestId('disabled-reason').first(),
  ).toBeVisible();
  await page.getByTestId('exit').click();

  // Modern travel exposes the available modes and gives a human-readable reason for locked ones.
  await page.getByTestId(isPhone(page) ? 'phone-loc-bank' : 'square-bank').click();
  await expect(page.getByTestId('mode-transit')).toBeVisible();
  await expect(page.getByTestId('mode-ride-hail')).toBeDisabled();

  // At the bank, investment and loan summaries accompany the actionable rows.
  await page.getByTestId('travel-go').click();
  await page.getByTestId('enter').click();
  await expect(page.getByTestId('section-invest')).toBeVisible();
  await expect(page.getByTestId('investment-summary')).toBeVisible();
  await expect(page.getByTestId('section-loans')).toBeVisible();
  await expect(page.getByTestId('loan-summary')).toBeVisible();
  await page
    .getByTestId(/^action-BuyAsset/)
    .first()
    .click();
  await expect(page.getByTestId('investment-summary')).not.toContainText('No investments yet.');
  await expectNoA11yViolations(page);
});
