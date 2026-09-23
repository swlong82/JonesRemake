import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';

/**
 * M7.5: one e2e run in the pseudo-locale, the themes and the text scales, and the final a11y pass
 * (UX_SPEC 7.8). The pseudo-locale run is the layout test: every string is bracketed, accented and
 * about 40% longer, so anything that only fits English overflows here.
 */

/** Elements whose text is cut off by their own box — the pseudo-locale's reason to exist. */
async function clippedElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.children.length > 0) continue;
      const text = el.textContent.trim();
      if (text === '') continue;
      const style = getComputedStyle(el);
      if (style.overflow === 'visible' && style.overflowX === 'visible') continue;
      // Screen-reader-only content is clipped on purpose (the skip link, the live region).
      if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
      // A tolerance of 1px absorbs sub-pixel rounding in the layout engine.
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        bad.push(`${el.tagName.toLowerCase()}: ${text.slice(0, 40)}`);
    }
    return bad;
  });
}

/**
 * Elements whose right edge passes the configured viewport. On a mobile viewport such a page is
 * zoomed out to fit, so `innerWidth` grows with it — the Playwright project's width is the truth.
 */
async function horizontalOverflow(page: Page): Promise<string[]> {
  const width = page.viewportSize()?.width ?? 0;
  return page.evaluate((w) => {
    const bad: string[] = [];
    if (document.documentElement.scrollWidth > w + 1)
      bad.push(`document: ${document.documentElement.scrollWidth}px > ${w}px`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > w + 1 && el.children.length === 0)
        bad.push(`${el.tagName.toLowerCase()}#${el.id}: right ${Math.round(r.right)}px`);
    }
    return bad;
  }, width);
}

async function setLanguageToPseudo(page: Page): Promise<void> {
  await page.getByTestId('settings').click();
  await page.locator('#language').selectOption('pseudo');
  await page.getByTestId('back').click();
}

test('the interface survives the pseudo-locale without clipping, and still passes axe', async ({
  page,
}) => {
  await page.goto('/?ff=-tutorial');
  await setLanguageToPseudo(page);

  // Every visible string is now bracketed, so an untranslated one would stand out.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('⟦');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-XA');
  expect(await clippedElements(page)).toEqual([]);
  await expectNoA11yViolations(page);

  await page.getByTestId('new-game').click();
  expect(await clippedElements(page)).toEqual([]);
  await page.getByTestId('seed').fill('e2e-pseudo');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();

  // The board is the densest screen, and the pack's own strings are pseudo-localised too.
  expect(await clippedElements(page)).toEqual([]);
  await expectNoA11yViolations(page);
});

test('themes and the largest text scale keep the board readable and accessible', async ({
  page,
}) => {
  await page.goto('/?ff=-tutorial');
  await page.getByTestId('settings').click();
  await page.locator('#theme').selectOption('dark');
  await page.locator('#textScale').selectOption('150');
  expect(await horizontalOverflow(page)).toEqual([]);
  await page.getByTestId('back').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // KI-009: at 150% on a phone the setup form used to be wider than the screen, so mobile
  // Chromium zoomed the page out and a real click on Start missed. It must fit, and be clickable.
  await page.getByTestId('new-game').click();
  expect(await horizontalOverflow(page)).toEqual([]);
  await page.getByTestId('seed').fill('e2e-scale');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();

  // UX 7.8's axe gate, on the board, in the dark theme, at 150% text.
  await expectNoA11yViolations(page);
  expect(await clippedElements(page)).toEqual([]);
});
