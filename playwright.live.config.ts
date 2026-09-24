import { defineConfig, devices } from '@playwright/test';

/**
 * Post-deploy smoke test against the live site (M8.4). deploy.yml sets LIVE_URL to the Pages URL
 * (with its trailing slash) and EXPECT_SHA to the commit it just deployed. There is no local web
 * server: the test exercises exactly what players get.
 */
const liveUrl = process.env.LIVE_URL ?? 'http://127.0.0.1:4173/';

export default defineConfig({
  testDir: 'apps/web/e2e/live',
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: liveUrl,
    trace: 'retain-on-failure',
    ...(process.env.PW_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
