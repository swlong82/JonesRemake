import type { Locator, Page } from '@playwright/test';

/**
 * The HUD readouts that exist in every layout: the scene's bar on wide screens, the phone's sticky
 * status bar, and the full HUD (an overlay on desktop, always shown on phones). `first()` picks
 * whichever is on screen.
 */
export const hud = (page: Page): Locator =>
  page
    .locator('[data-testid="scene-hud"], [data-testid="hud"], [data-testid="phone-status"]')
    .first();
export const weekText = (page: Page): Locator =>
  page.locator('[data-testid="scene-week"], [data-testid="week"]').first();
export const cashText = (page: Page): Locator =>
  page.locator('[data-testid="scene-cash"], [data-testid="cash"]').first();

/** Open the full HUD where it is an overlay (the scene's Details button); no-op where it is shown. */
export async function openDetails(page: Page): Promise<void> {
  const button = page.getByTestId('hud-details-btn');
  if ((await button.isVisible()) && !(await page.getByTestId('hud').isVisible())) {
    await button.click();
    await page.getByTestId('hud').waitFor();
  }
}

export const standingsBtn = (page: Page): Locator =>
  page.locator('[data-testid="standings-btn"], [data-testid="scene-standings-btn"]').first();

/** Close the full-HUD overlay so the map is clickable again; no-op where the HUD is not an overlay. */
export async function closeDetails(page: Page): Promise<void> {
  const button = page.getByTestId('hud-details-btn');
  if ((await button.isVisible()) && (await page.getByTestId('hud').isVisible())) {
    await button.click();
    await page.getByTestId('hud').waitFor({ state: 'hidden' });
  }
}

/** Travel to a place from the map (wide screens) or the list (phones), leaving any overlay first. */
export async function clickPlace(page: Page, id: string): Promise<void> {
  await closeDetails(page);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  if (phone) {
    const list = page.getByTestId('phone-view-list');
    if (await list.isVisible()) await list.click();
    await page.getByTestId(`phone-loc-${id}`).click();
  } else {
    const map = page.getByTestId('interior-map');
    if (await map.isVisible()) await map.click();
    await page.getByTestId(`square-${id}`).click();
  }
}
