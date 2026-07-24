import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * Critical browser gate for Crystalith.
 *
 * - Isolated ports so `just e2e` can run beside `just dev` (8032/3000).
 * - Fresh SQLite via CL_DB_PATH under e2e/.tmp/
 * - Live chat/embedding gateways → local mock OpenAI gateway (c100 L1=B)
 *   plus CL_RESEARCH_E2E_STUB=1 deterministic research kernel (c100 L1=A).
 * - Prefer data-testid (apps/web/src/shared/testids.ts) over visible text.
 * - Failure artifacts: screenshot + trace + video + attached run JSON (c100 L6).
 */

const ROOT = resolve(import.meta.dirname, '..');
const TMP = resolve(import.meta.dirname, '.tmp');
const DB = resolve(TMP, 'crystalith.e2e.db');

mkdirSync(TMP, { recursive: true });

const SERVER_PORT = process.env.CL_E2E_SERVER_PORT ?? '18032';
const WEB_PORT = process.env.CL_E2E_WEB_PORT ?? '13000';
const MOCK_GATEWAY_PORT = process.env.CL_E2E_MOCK_GATEWAY_PORT ?? '18039';
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const MOCK_GATEWAY_URL = `http://127.0.0.1:${MOCK_GATEWAY_PORT}/v1`;

const reuse = !process.env.CI && process.env.CL_E2E_REUSE === '1';

/**
 * Strip live model/gateway vars inherited from the parent shell, then pin
 * mock gateway + research stub + isolated DB/ports.
 */
function e2eServerEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  const liveKeys = [
    'CL_CHAT_API_BASE',
    'CL_CHAT_API_KEY',
    'CL_CHAT_MODEL',
    'CL_CHAT_LIGHT_MODEL',
    'CL_EMBEDDING_API_BASE',
    'CL_EMBEDDING_API_KEY',
    'CL_EMBEDDING_MODEL',
    'CL_DEFAULT_CHAT_MODEL',
    'CL_DEFAULT_EMBEDDING_MODEL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'VITE_LAB_FIXTURE',
  ] as const;

  for (const key of liveKeys) {
    delete env[key];
  }

  return {
    ...env,
    CL_DB_PATH: DB,
    CL_SERVER_HOST: '127.0.0.1',
    CL_SERVER_PORT: SERVER_PORT,
    CL_CHAT_API_BASE: MOCK_GATEWAY_URL,
    CL_EMBEDDING_API_BASE: MOCK_GATEWAY_URL,
    CL_CHAT_API_KEY: 'e2e-mock',
    CL_EMBEDDING_API_KEY: 'e2e-mock',
    CL_RESEARCH_E2E_STUB: '1',
  };
}

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CL_E2E_USE_SYSTEM_CHROME === '0' ? {} : { channel: 'chrome' as const }),
      },
    },
  ],
  webServer: [
    {
      command: `bun ${resolve(import.meta.dirname, 'mock-openai-gateway.ts')}`,
      url: `http://127.0.0.1:${MOCK_GATEWAY_PORT}/health`,
      reuseExistingServer: reuse,
      timeout: 60_000,
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        CL_E2E_MOCK_GATEWAY_PORT: MOCK_GATEWAY_PORT,
      },
    },
    {
      command: `bun ${resolve(ROOT, 'apps/server/src/server.ts')}`,
      url: `${SERVER_URL}/v2/health`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      cwd: ROOT,
      env: e2eServerEnv(),
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
        // c100 L5=A: production Eden path — never enable fixture Lab
        VITE_LAB_FIXTURE: '',
      },
    },
  ],
});
