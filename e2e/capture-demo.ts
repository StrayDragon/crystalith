/**
 * Demo capture — records the README walkthrough chapters with Playwright's
 * built-in video against the LIVE dev instance (server :8032 + web :3000).
 *
 * Prerequisites:
 *   - `just dev` running with live gateways (real streaming, real LLM)
 *   - A demo notebook with sources / a completed research run
 *     (prepare via API; see chapter helpers below — notebook selected by name)
 *
 * Usage:
 *   bun e2e/capture-demo.ts            # writes e2e/.tmp/demo-videos/*.webm
 *   OUT_DIR=/path bun e2e/capture-demo.ts
 *
 * Chapters are separate browser contexts → one webm each, so ffmpeg can
 * apply per-chapter trim/speed before concatenation (see docs/ demo build).
 */
import { mkdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const WEB_URL = process.env.DEMO_WEB_URL ?? 'http://localhost:3000';
const OUT_DIR = resolve(process.env.OUT_DIR ?? join(import.meta.dirname, '.tmp', 'demo-videos'));
const NOTEBOOK_NAME = process.env.DEMO_NOTEBOOK ?? 'Crystalith 功能演示';
const VIEWPORT = { width: 1280, height: 720 };

mkdirSync(OUT_DIR, { recursive: true });

type Page = Awaited<ReturnType<Context['newPage']>>;
type Context = Awaited<ReturnType<Browser['newContext']>>;
type Browser = Awaited<ReturnType<typeof chromium.launch>>;

async function newChapter(
  browser: Browser,
  name: string,
): Promise<{ page: Page; finish: () => Promise<string> }> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  return {
    page,
    finish: async () => {
      const video = page.video();
      if (!video) throw new Error('recording unavailable');
      const videoPath = await video.path();
      await context.close();
      const target = join(OUT_DIR, `${name}.webm`);
      renameSync(videoPath, target);
      return target;
    },
  };
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Fresh context per chapter → always select the demo notebook explicitly. */
async function selectNotebook(page: Page) {
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ws-root').waitFor({ timeout: 30_000 });
  const trigger = page.getByTestId('notebook-switcher-trigger');
  if ((await trigger.innerText()).includes(NOTEBOOK_NAME)) return;
  await trigger.click();
  await page.getByTestId('notebook-switcher-overlay').waitFor();
  await page.getByTestId('notebook-option').filter({ hasText: NOTEBOOK_NAME }).first().click();
  await page.waitForTimeout(1_500);
}

async function chapterWorkspace(browser: Browser) {
  const { page, finish } = await newChapter(browser, '1-overview');
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ws-root').waitFor({ timeout: 30_000 });
  await selectNotebook(page);
  await pause(page, 2_500);
  await page.getByTestId('sources-panel').hover();
  await pause(page, 2_000);
  await page.getByTestId('chat-panel').hover();
  await pause(page, 2_500);
  await finish();
}

async function chapterChat(browser: Browser) {
  const { page, finish } = await newChapter(browser, '2-chat');
  await selectNotebook(page);
  await pause(page, 1_500);

  const input = page.getByTestId('chat-input');
  await input.click();
  await input.pressSequentially('Crystalith 怎么保证回答有据可依？', { delay: 45 });
  await pause(page, 600);
  await page.getByTestId('chat-send').click();

  // Answer streams until the citations action appears; .last() targets THIS
  // question's answer when earlier Q&A already exists in the session.
  const citationsButton = page.getByRole('button', { name: /查看引用/ }).last();
  await citationsButton.waitFor({ timeout: 120_000 });
  await pause(page, 2_000);

  await citationsButton.click();
  await page.waitForTimeout(1_200);
  await pause(page, 3_000);
  await page.keyboard.press('Escape');
  await pause(page, 1_500);
  await finish();
}

async function chapterGenerate(browser: Browser) {
  const { page, finish } = await newChapter(browser, '3-generate');
  await selectNotebook(page);
  await pause(page, 1_200);

  await page.getByTestId('studio-generate').click();
  await page.getByTestId('studio-tools-popover').waitFor();
  await pause(page, 1_200);
  // Generation POST is synchronous server-side — this segment is sped up in post.
  await page.getByRole('button', { name: '简报', exact: true }).click();
  await page.getByTestId('studio-output-item').first().waitFor({ timeout: 180_000 });
  await pause(page, 1_500);

  await page.getByTestId('studio-output-item').first().click();
  await page.waitForTimeout(2_000);
  await pause(page, 3_500);
  await page.mouse.wheel(0, 400);
  await pause(page, 2_000);
  await page.keyboard.press('Escape');
  await pause(page, 1_200);
  await finish();
}

async function chapterResearch(browser: Browser) {
  const { page, finish } = await newChapter(browser, '4-research');
  await selectNotebook(page);
  await pause(page, 1_200);

  await page.getByTestId('research-tasks-trigger').click();
  await page.getByTestId('research-tasks-drawer').waitFor();
  await pause(page, 2_000);
  await page.getByTestId('research-tasks-item').first().click();
  await page.getByTestId('research-lab-graph').waitFor({ timeout: 30_000 });
  await pause(page, 3_500);

  // Gentle pan across the research graph.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(430, 340, { steps: 12 });
  await pause(page, 400);
  await page.mouse.move(700, 420, { steps: 14 });
  await page.mouse.up();
  await pause(page, 2_000);

  await page.getByTestId('research-lab-back').click();
  await pause(page, 1_500);
  await finish();
}

async function chapterNotebookCreate(browser: Browser) {
  const { page, finish } = await newChapter(browser, '5-new-notebook');
  await selectNotebook(page);
  await pause(page, 1_000);

  await page.getByTestId('notebook-create-button').click();
  await page.getByTestId('notebook-create-overlay').waitFor();
  await pause(page, 800);
  const nameInput = page
    .getByTestId('notebook-create-overlay')
    .locator('input:not([type="file"])')
    .first();
  await nameInput.pressSequentially('我的新笔记本', { delay: 60 });
  await pause(page, 500);
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByTestId('sources-empty').waitFor({ timeout: 15_000 });
  await pause(page, 3_000);
  await finish();
}

const CHAPTERS: Record<string, (browser: Browser) => Promise<void>> = {
  workspace: chapterWorkspace,
  chat: chapterChat,
  generate: chapterGenerate,
  research: chapterResearch,
  'new-notebook': chapterNotebookCreate,
};

async function main() {
  // System Chrome (matches e2e default) — the Playwright-cached headless
  // shell often lags what the installed @playwright/test version expects.
  const browser = await chromium.launch({ channel: 'chrome' });
  // DEMO_CHAPTERS=chat,research → re-record only those chapters.
  const only = process.env.DEMO_CHAPTERS?.split(',').filter(Boolean) ?? Object.keys(CHAPTERS);
  try {
    for (const name of only) {
      const chapter = CHAPTERS[name];
      if (!chapter) {
        console.error(
          `[capture-demo] unknown chapter "${name}" (known: ${Object.keys(CHAPTERS).join(', ')})`,
        );
        process.exit(1);
      }
      console.log(`[capture-demo] recording chapter: ${name}`);
      await chapter(browser);
    }
    console.log(`[capture-demo] chapters written to ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

await main();
