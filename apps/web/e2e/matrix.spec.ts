import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './axe';
import { horizontalOverflow } from './layout';

/**
 * Ring-board spec: it pins `-sceneUi` while the ring still exists (removed in M10); the scene UI,
 * on by default since the M9 gate, has its own specs (`scene`, `artpacks`, `offline`).
 */

/**
 * M8.3 (ADR-0037): menu and setup options in combination. A full Cartesian product is thousands of
 * games, so this covers every *pair* of option values at least once (all-pairs), generated
 * deterministically below. The whole matrix runs on the desktop project; tablet and phone run the
 * first five combinations.
 */
const FACTORS = {
  ruleset: ['classic', 'modern-western'],
  seats: ['solo', 'versus-ai', 'two-humans', 'four-seats'],
  difficulty: ['easy', 'normal', 'hard'],
  preset: ['quick', 'standard', 'marathon'],
  chaos: ['off', 'classic', 'modern', 'chaotic'],
  opacity: ['off', 'on'],
  theme: ['light', 'dark'],
  scale: ['100', '125', '150'],
  language: ['en', 'pseudo'],
} as const;
type Factor = keyof typeof FACTORS;
type Combo = { [K in Factor]: (typeof FACTORS)[K][number] };

/** Greedy all-pairs: add the candidate covering the most uncovered pairs until none are left. */
function allPairs(): Combo[] {
  const names = Object.keys(FACTORS) as Factor[];
  const pair = (a: Factor, av: string, b: Factor, bv: string): string =>
    names.indexOf(a) < names.indexOf(b) ? `${a}=${av}|${b}=${bv}` : `${b}=${bv}|${a}=${av}`;
  const uncovered = new Set<string>();
  names.forEach((a, i) => {
    for (const b of names.slice(i + 1))
      for (const av of FACTORS[a]) for (const bv of FACTORS[b]) uncovered.add(pair(a, av, b, bv));
  });
  const combos: Combo[] = [];
  while (uncovered.size > 0) {
    // Seed with the first uncovered pair, then pick each other factor's most useful value.
    const c = new Map<Factor, string>();
    for (const part of [...uncovered][0]!.split('|')) {
      const [f, v] = part.split('=') as [Factor, string];
      c.set(f, v);
    }
    for (const f of names) {
      if (c.has(f)) continue;
      let best: string = FACTORS[f][0];
      let bestGain = -1;
      for (const v of FACTORS[f]) {
        let gain = 0;
        for (const [g, gv] of c) if (uncovered.has(pair(f, v, g, gv))) gain++;
        if (gain > bestGain) {
          best = v;
          bestGain = gain;
        }
      }
      c.set(f, best);
    }
    const entries = [...c];
    entries.forEach(([a, av], i) => {
      for (const [b, bv] of entries.slice(i + 1)) uncovered.delete(pair(a, av, b, bv));
    });
    combos.push(Object.fromEntries(c) as Combo);
  }
  return combos;
}

const COMBOS = allPairs();

async function applySettings(page: Page, c: Combo): Promise<void> {
  await page.getByTestId('settings').click();
  await page.locator('#theme').selectOption(c.theme);
  await page.locator('#textScale').selectOption(c.scale);
  await page.locator('#language').selectOption(c.language);
  await page.getByTestId('back').click();
}

async function configureSetup(page: Page, c: Combo): Promise<void> {
  await page.getByTestId('new-game').click();
  await page.locator('#ruleset').selectOption(c.ruleset);
  // Seats: the form starts with You + one AI rival.
  if (c.seats === 'solo') {
    await page.locator('[data-testid="seat-1"] button').last().click();
    await page.getByTestId('solo-practice').check();
  } else if (c.seats === 'two-humans') {
    await page.locator('#type-1').selectOption('human-local');
  } else if (c.seats === 'four-seats') {
    await page.getByTestId('add-seat').click();
    await page.getByTestId('add-seat').click();
    await page.locator('#type-2').selectOption('human-local');
  }
  for (const i of [1, 2, 3]) {
    const diff = page.locator(`#diff-${i}`);
    if ((await diff.count()) > 0) await diff.selectOption(c.difficulty);
  }
  await page.getByTestId(`preset-${c.preset}`).click();
  await page.locator('#chaos').selectOption(c.chaos);
  if (c.opacity === 'on') await page.getByTestId('classic-opacity').check();
  else await page.getByTestId('classic-opacity').uncheck();
  await page.locator('#aispeed').selectOption('instant');
  await page.getByTestId('seed').fill(`matrix-${COMBOS.indexOf(c)}`);
}

test.describe('setup and settings in combination (all-pairs)', () => {
  test('the generated set covers every pair of option values', () => {
    expect(COMBOS.length).toBeGreaterThan(10);
    expect(COMBOS.length).toBeLessThan(40);
  });

  for (const [i, c] of COMBOS.entries()) {
    test(`combination ${i + 1}: ${Object.values(c).join(' · ')}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop' && i >= 5, 'tablet and phone run the first five');
      // A round with AI seats is real play: on a loaded CI runner it outlasts the default 30 s.
      test.setTimeout(90_000);
      await page.goto('/?ff=-tutorial,-sceneUi');
      await applySettings(page, c);
      await configureSetup(page, c);
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.getByTestId('start-game').click();
      // Hotseat games open on the pass-the-device screen for the first human.
      if (c.seats === 'two-humans' || c.seats === 'four-seats')
        await page.getByTestId('ready').click();
      await expect(page.getByTestId('hud')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute(
        'lang',
        c.language === 'pseudo' ? 'en-XA' : 'en',
      );
      // One full round: end the turn, pass the device between humans, dismiss any event card.
      await page.getByTestId('end-turn').click();
      await page.getByTestId('end-turn-confirm').click();
      try {
        await expect(async () => {
          // Clicks carry a timeout: a pass screen can be swapped for the next one mid-click, and an
          // untimed click then waits for ever instead of letting the loop try again.
          if (await page.getByTestId('ready').isVisible())
            await page.getByTestId('ready').click({ timeout: 5_000 });
          if (await page.getByTestId('event-dismiss').isVisible())
            await page.getByTestId('event-dismiss').click({ timeout: 5_000 });
          await expect(page.getByTestId('hud')).toBeVisible({ timeout: 1_000 });
        }).toPass({ timeout: 60_000 });
      } catch (error) {
        // CI keeps no page to look at; the visible text says which screen the round stopped on.
        console.log(`round stopped on:\n${await page.locator('body').innerText()}`);
        throw error;
      }
      expect(await horizontalOverflow(page)).toEqual([]);
      await expectNoA11yViolations(page);
    });
  }
});
