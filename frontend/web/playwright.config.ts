import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const liveBaseURL = process.env.E2E_LIVE_BASE_URL ?? baseURL;

export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'mock',
      testMatch: /.*\\.mock\\.spec\\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live',
      testMatch: /.*\\.live\\.spec\\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: liveBaseURL },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
