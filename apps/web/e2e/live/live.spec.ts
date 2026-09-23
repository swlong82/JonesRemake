import { expect, test, type Page, type Request } from '@playwright/test';
import { expectNoA11yViolations } from '../axe';

/**
 * Post-deploy smoke test (M8.4, ADR-0037): runs against the live Pages URL after every deploy.
 * On failure deploy.yml redeploys the last good build and opens an issue.
 */
const expectSha = process.env.EXPECT_SHA;

/** Every request the page makes must stay on the site's own origin (CLAUDE.md 1.3). */
function watchOrigins(page: Page, origin: string): string[] {
  const foreign: string[] = [];
  page.on('request', (r: Request) => {
    const url = r.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });
  return foreign;
}

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe.configure({ mode: 'serial' });

test('the deployed build is the commit just pushed', async ({ page, baseURL }) => {
  test.skip(!expectSha, 'EXPECT_SHA is only set by deploy.yml');
  // Pages can take a minute or two to publish: poll the HTML, never a cached copy.
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`${baseURL}?nocache=${Date.now()}`);
        const html = await res.text();
        return /<meta name="build-sha" content="([^"]+)"/.exec(html)?.[1] ?? '';
      },
      { timeout: 150_000, intervals: [5_000] },
    )
    .toBe(expectSha);
});

test('every asset loads, the title renders cleanly, and nothing leaves the origin', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const foreign = watchOrigins(page, origin);
  const errors = watchConsole(page);
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('./?ff=-tutorial');
  await expect(page.getByTestId('new-game')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Hustle Ring');
  // Every script and stylesheet index.html names, fetched directly as well.
  const assets = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll('script[src]'), (s) => (s as HTMLScriptElement).src),
    ...Array.from(
      document.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"]'),
      (l) => (l as HTMLLinkElement).href,
    ),
  ]);
  expect(assets.length).toBeGreaterThan(0);
  for (const url of assets) expect((await page.request.get(url)).status(), url).toBe(200);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
  await expectNoA11yViolations(page);
});

test('a deep link and an unknown path fall back to the app', async ({ page }) => {
  for (const path of ['./game', './no/such/page']) {
    await page.goto(path);
    await expect(page.getByTestId('new-game')).toBeVisible();
  }
});

test('a seeded classic game survives a save and a reload', async ({ page, baseURL }) => {
  const foreign = watchOrigins(page, new URL(baseURL!).origin);
  await page.goto('./?ff=-tutorial');
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption('classic');
  await page.getByTestId('seed').fill('live-smoke');
  await page.getByTestId('start-game').click();
  await page.getByTestId('action-Relax').click();
  const hud = await page.getByTestId('hud').innerText();
  await page.keyboard.press('ControlOrMeta+s');
  await page.getByRole('button', { name: 'Save to Slot 1', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Game saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.getByRole('button', { name: 'Load Slot 1', exact: true }).click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(await page.getByTestId('hud').innerText()).toBe(hud);
  expect(foreign).toEqual([]);
});

test('the modern ruleset starts and the board passes axe', async ({ page }) => {
  await page.goto('./?ff=-tutorial');
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption('modern-western');
  await page.getByTestId('seed').fill('live-smoke-modern');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await expectNoA11yViolations(page);
});
