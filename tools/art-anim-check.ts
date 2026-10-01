#!/usr/bin/env tsx
/**
 * `pnpm art:anim-check [--browser chromium|firefox|webkit]` — does CSS animation inside an art SVG
 * actually play when the file is drawn as an `<img>`, the way the game draws art (ART_SPEC 17.5)?
 * GRAPHICS_PLAN section 3 relies on it. Checks, in one browser: a `data:` image, a `blob:` image,
 * a tinted `blob:` image (the registry's tint path), the registry-side motion strip (a rewrite that
 * switches animation off, the mitigation GRAPHICS_PLAN 3.1 relies on), and, for information only,
 * whether a file's own `prefers-reduced-motion` rule is honoured inside an `<img>` (in Chromium it
 * is not, so reduced motion must be done by omitting or stripping the animation, never by CSS in
 * the file). "Plays" means the rendered pixels change between frames. Also runs the file through the art sanitizer, so the sample stays valid.
 *
 * Needs the browser installed for Playwright; set PW_CHROMIUM_EXECUTABLE for a preinstalled Chromium.
 * No browser, no check: it exits 2 so CI cannot mistake "not run" for "passed".
 */
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit, type Browser, type BrowserType } from '@playwright/test';
import { JSDOM } from 'jsdom';
import { checkSvg, USER_LIMITS } from '../packages/art/src/sanitize.js';

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96"><style>@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(-20px)}100%{transform:translateY(0)}}.b{animation:bob 1s infinite;transform-box:fill-box}@media (prefers-reduced-motion: reduce){.b{animation:none}}</style><circle class="b" cx="32" cy="48" r="10" fill="#FF00FF"/></svg>`;

const name = process.argv.includes('--browser')
  ? process.argv[process.argv.indexOf('--browser') + 1]
  : 'chromium';
const types: Record<string, BrowserType> = { chromium, firefox, webkit };
const type = types[name ?? ''];
if (!type) {
  console.error(`unknown browser "${name}"`);
  process.exit(1);
}

const parse = (text: string): Document =>
  new new JSDOM('').window.DOMParser().parseFromString(text, 'image/svg+xml');
const sanitizer = checkSvg(SAMPLE, USER_LIMITS, parse);
if (!sanitizer.ok) {
  console.error(`✗ sample fails the sanitizer: ${sanitizer.issues.join('; ')}`);
  process.exit(1);
}

const executablePath =
  name === 'chromium' && process.env.PW_CHROMIUM_EXECUTABLE
    ? process.env.PW_CHROMIUM_EXECUTABLE
    : undefined;
let browser: Browser;
try {
  browser = await type.launch(executablePath ? { executablePath } : {});
} catch (e) {
  console.error(`✗ could not launch ${name}: ${(e as Error).message.split('\n')[0]}`);
  process.exit(2);
}

/** The rewrite the registry would apply for reduced motion: every animation off, whatever the file says. */
const STRIP = '<style>*{animation:none!important}</style>';

async function plays(
  reducedMotion: 'reduce' | 'no-preference',
  source: 'data' | 'blob' | 'tint' | 'strip',
) {
  const page = await browser.newPage({ viewport: { width: 160, height: 200 } });
  await page.emulateMedia({ reducedMotion });
  const svg =
    source === 'tint'
      ? SAMPLE.replaceAll('#FF00FF', '#2f6fb5')
      : source === 'strip'
        ? SAMPLE.replace('</svg>', `${STRIP}</svg>`)
        : SAMPLE;
  const kind: 'data' | 'blob' = source === 'data' ? 'data' : 'blob';
  await page.setContent('<body style="margin:0"></body>');
  await page.evaluate(
    ({ svg: text, kind }: { svg: string; kind: 'data' | 'blob' }) => {
      const img = new Image();
      img.style.width = '128px';
      img.src =
        kind === 'data'
          ? `data:image/svg+xml;utf8,${encodeURIComponent(text)}`
          : URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
      document.body.append(img);
      return img.decode();
    },
    { svg, kind },
  );
  const frames = new Set<string>();
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(230);
    frames.add(
      createHash('md5')
        .update(await page.screenshot())
        .digest('hex'),
    );
  }
  await page.close();
  return frames.size > 1;
}

const rows: [string, boolean, boolean][] = [
  ['data: image plays', await plays('no-preference', 'data'), true],
  ['blob: image plays', await plays('no-preference', 'blob'), true],
  ['tinted blob: image plays (registry path)', await plays('no-preference', 'tint'), true],
  ['registry motion strip stops it', await plays('no-preference', 'strip'), false],
];
const fileRuleHonoured = !(await plays('reduce', 'blob'));
console.log(
  `ℹ ${name}: a prefers-reduced-motion rule inside the file is ${fileRuleHonoured ? 'honoured' : 'IGNORED'} for <img> SVG${fileRuleHonoured ? '' : ' (do not rely on it)'}`,
);
let failed = 0;
for (const [label, got, want] of rows) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${label}`);
}
await browser.close();
console.log(`art:anim-check (${name}) — ${failed === 0 ? 'OK' : 'FAIL'}`);
process.exit(failed === 0 ? 0 : 1);
