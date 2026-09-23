import type { Page } from '@playwright/test';

/**
 * Elements whose right edge passes the configured viewport. On a mobile viewport such a page is
 * zoomed out to fit, so `innerWidth` grows with it — the Playwright project's width is the truth.
 */
export async function horizontalOverflow(page: Page): Promise<string[]> {
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
