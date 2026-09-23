import type { Page } from '@playwright/test';

/**
 * Elements and text runs whose right edge passes the configured viewport. Text is checked on its
 * own: an unbreakable word spills out of a box that itself fits. On a mobile viewport such a page is
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
        bad.push(
          `${el.tagName.toLowerCase()}[${el.dataset.testid ?? el.id}] "${el.textContent.slice(0, 40)}": right ${Math.round(r.right)}px`,
        );
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      // Screen-reader-only text lives in a 1px clipped box; it paints nothing and scrolls nothing.
      const box = n.parentElement?.getBoundingClientRect();
      if (box && box.width <= 1) continue;
      if (r.width > 0 && r.right > w + 1)
        bad.push(
          `text in ${n.parentElement?.tagName.toLowerCase()}[${n.parentElement?.dataset.testid ?? ''}] "${(n.textContent ?? '').slice(0, 40)}": right ${Math.round(r.right)}px`,
        );
    }
    return bad;
  }, width);
}
