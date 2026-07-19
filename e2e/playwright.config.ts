import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * Critical browser gate for Crystalith.
 *
 * - Isolated ports so `just e2e` can run beside `just dev`.
 * - Fresh SQLite via CL_DB_PATH under e2e/.tmp/
 * - Prefer data-testid (apps/web/src/shared/testids.ts) over visible text.
 */

const ROOT = resolve(import.meta.dirname, '..');
const TMP = resolve(import.meta.dirname, '.tmp');
const DB = resolve(TMP, 'crystalith.e2e.db');

mkdirSync(TMP, { recursive: true });

const SERVER_PORT = process.env.CL_E2E_SERVER_PORT ?? '18032';
const WEB_PORT = process.env.CL_E2E_WEB_PORT ?? '13000';
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

const reuse = !process.env.CI && process.env.CL_E2E_REUSE === '1';

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Local: system Chrome (avoids blocked playwright CDN downloads).
        // CI: set CL_E2E_USE_SYSTEM_CHROME=0 and run `just e2e-install`.
        ...(process.env.CL_E2E_USE_SYSTEM_CHROME === '0' ? {} : { channel: 'chrome' as const }),
      },
    },
  ],
  webServer: [
    {
      command: `bun ${resolve(ROOT, 'apps/server/src/server.ts')}`,
      url: `${SERVER_URL}/v2/health`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      cwd: ROOT,
      env: {
        ...process.env,
        CL_DB_PATH: DB,
        CL_SERVER_HOST: '127.0.0.1',
        CL_SERVER_PORT: SERVER_PORT,
      },
    },
    {
      command: `bunx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: reuse,
      timeout: 120_000,
      cwd: resolve(ROOT, 'apps/web'),
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: SERVER_URL,
      },
    },
  ],
});
