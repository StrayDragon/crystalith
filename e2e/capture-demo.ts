/**
 * Demo capture — three README clips via Playwright 1.64 `page.screencast`
 * against the LIVE dev instance (server :8032 + web :3000).
 *
 * Clips (stable product surface only — skip onboarding / one-off wizards):
 *   chat      基本介绍 + 带引用问答   → 1-overview + 2-chat
 *   notebook  来源与 Studio 输出     → 3-sources + 4-generate
 *   research  Deep Research Lab      → 5-research
 *
 * Setup (notebook switch) is NOT recorded. Each chapter starts screencast
 * with a chapter card, synthetic cursor, and captions.
 *
 * Prerequisites:
 *   - `just dev` with live gateways
 *   - Demo notebook with at least one ready source
 *   - research clip: a ResearchRun already in the tasks drawer
 *
 * Usage:
 *   bun e2e/capture-demo.ts
 *   DEMO_CHAPTERS=chat,research bun e2e/capture-demo.ts
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const WEB_URL = process.env.DEMO_WEB_URL ?? 'http://localhost:3000';
const OUT_DIR = resolve(process.env.OUT_DIR ?? join(import.meta.dirname, '.tmp', 'demo-videos'));
const NOTEBOOK_NAME = process.env.DEMO_NOTEBOOK ?? 'Crystalith 功能演示';
const VIEWPORT = { width: 1280, height: 720 };
const FPS = Number(process.env.DEMO_FPS ?? 30);

mkdirSync(OUT_DIR, { recursive: true });

type Page = Awaited<ReturnType<Context['newPage']>>;
type Context = Awaited<ReturnType<Browser['newContext']>>;
type Browser = Awaited<ReturnType<typeof chromium.launch>>;

const ACTION_STYLE = {
  cursor: 'pointer' as const,
  duration: 800,
  style: {
    point:
      'width: 16px; height: 16px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 8px rgba(59,130,246,0.28);',
    highlight: 'outline: 2px solid #3b82f6; background: rgba(59,130,246,0.12); border-radius: 8px;',
    title: 'display: none;',
  },
};

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function captionHtml(text: string): string {
  return `<div style="
    position:fixed;left:28px;top:72px;z-index:2147483647;
    font-family:ui-sans-serif,system-ui,sans-serif;
    font-size:17px;font-weight:600;letter-spacing:.01em;line-height:1.35;
    color:#e2e8f0;background:rgba(15,23,42,.88);
    border:1px solid #334155;border-radius:12px;
    padding:10px 16px;backdrop-filter:blur(10px);
    box-shadow:0 8px 24px rgba(0,0,0,.28);
  ">${escapeHtml(text)}</div>`;
}

async function caption(page: Page, text: string, duration = 2600) {
  await page.screencast.showOverlay(captionHtml(text), { duration });
}

/** Fresh context per chapter → always select the demo notebook explicitly. */
async function selectNotebook(page: Page) {
  await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ws-root').waitFor({ timeout: 30_000 });
  const trigger = page.getByTestId('notebook-switcher-trigger');
  if ((await trigger.innerText()).includes(NOTEBOOK_NAME)) return;
  await trigger.click();
  await page.getByTestId('notebook-switcher-overlay').waitFor();
  await page.getByTestId('notebook-option').filter({ hasText: NOTEBOOK_NAME }).first().click();
  await page.waitForTimeout(1_200);
}

async function withChapter(
  browser: Browser,
  fileName: string,
  title: string,
  description: string,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  try {
    await selectNotebook(page);
    const target = join(OUT_DIR, `${fileName}.webm`);
    await page.screencast.start({ path: target, size: VIEWPORT, fps: FPS });
    await page.screencast.showActions(ACTION_STYLE);
    await page.screencast.showChapter(title, { description, duration: 1700 });
    await run(page);
    await pause(page, 900);
    await page.screencast.stop();
    console.log(`[capture-demo] wrote ${target}`);
  } finally {
    await context.close();
  }
}

async function chapterWorkspace(browser: Browser) {
  await withChapter(browser, '1-overview', '工作台', '资料、问答、输出同屏', async (page) => {
    await caption(page, '一个笔记本 = 一组资料 + 带引用的对话');
    await pause(page, 600);
    await page.getByTestId('sources-panel').hover();
    await pause(page, 1600);
    await page.getByTestId('chat-panel').hover();
    await pause(page, 1800);
    await page.getByTestId('studio-generate').hover();
    await pause(page, 1400);
  });
}

async function chapterChat(browser: Browser) {
  await withChapter(browser, '2-chat', '带引用问答', '回答附来源，可当场核对', async (page) => {
    await caption(page, '问笔记本里的资料，而不是凭空生成');
    await page.getByTestId('session-create-button').click();
    await page.getByText(/直接提问/u).waitFor({ timeout: 10_000 });
    await pause(page, 400);
    const input = page.getByTestId('chat-input');
    await input.click();
    await input.pressSequentially('Crystalith 怎么保证回答有据可依？', { delay: 38 });
    await pause(page, 400);
    await page.getByTestId('chat-send').click();
    await page
      .getByTestId('chat-message-item')
      .filter({ hasText: 'Crystalith 怎么保证回答有据可依？' })
      .waitFor({ timeout: 10_000 });
    await pause(page, 700);

    const citationsButton = page.getByRole('button', { name: /查看引用/u }).last();
    await citationsButton.waitFor({ timeout: 120_000 });
    await caption(page, '引用可点开，来源留在回答旁边', 2800);
    await pause(page, 1200);
    await citationsButton.click();
    await pause(page, 2800);
    await page.keyboard.press('Escape');
    await pause(page, 800);
  });
}

async function chapterSources(browser: Browser) {
  await withChapter(
    browser,
    '3-sources',
    '资料来源',
    '喂进去的内容，检索只在这里面',
    async (page) => {
      await caption(page, 'PDF、网页、Markdown 都落在同一个笔记本');
      await page.getByTestId('source-row').first().click();
      await page.getByTestId('source-detail-dialog').waitFor();
      await pause(page, 1800);
      const summaryTab = page.getByTestId('source-detail-tab-summary');
      if (await summaryTab.isVisible()) {
        await summaryTab.click();
        await pause(page, 1400);
      }
      await page.getByTestId('source-detail-close').click();
      await pause(page, 700);
    },
  );
}

async function chapterGenerate(browser: Browser) {
  await withChapter(
    browser,
    '4-generate',
    'Studio 输出',
    '一键生成可交互的学习材料',
    async (page) => {
      await caption(page, '简报、闪卡、导图、测验……同一批资料');
      await page.getByTestId('studio-generate').click();
      await page.getByTestId('studio-tools-popover').waitFor();
      await pause(page, 900);
      await caption(page, '正在生成简报…', 4000);
      await page.getByRole('button', { name: '简报', exact: true }).click();
      await page.getByTestId('studio-output-item').first().waitFor({ timeout: 180_000 });
      await pause(page, 800);
      await page.getByTestId('studio-output-item').first().click();
      await caption(page, '打开即可阅读，也能导出 PDF / PPTX');
      await pause(page, 2400);
      await page.mouse.wheel(0, 380);
      await pause(page, 1600);
      await page.keyboard.press('Escape');
      await pause(page, 700);
    },
  );
}

async function chapterResearch(browser: Browser) {
  await withChapter(
    browser,
    '5-research',
    'Deep Research',
    '预算内多轮取证，再综合成报告',
    async (page) => {
      await caption(page, '从任务抽屉进入 Research Lab');
      await page.getByTestId('research-tasks-trigger').click();
      await page.getByTestId('research-tasks-drawer').waitFor();
      await pause(page, 1400);
      const item = page.getByTestId('research-tasks-item').first();
      await item.waitFor({ timeout: 15_000 });
      await item.click();
      await page.getByTestId('research-lab-graph').waitFor({ timeout: 30_000 });
      await caption(page, '任务图画在图上：每条支路都看得到');
      await pause(page, 2200);

      await page.mouse.move(640, 400);
      await page.mouse.down();
      await page.mouse.move(430, 340, { steps: 16 });
      await pause(page, 350);
      await page.mouse.move(700, 420, { steps: 18 });
      await page.mouse.up();
      await pause(page, 1400);

      await page.getByTestId('research-lab-back').click();
      await pause(page, 800);
    },
  );
}

const CHAPTERS: Record<string, (browser: Browser) => Promise<void>> = {
  workspace: chapterWorkspace,
  chat: chapterChat,
  sources: chapterSources,
  generate: chapterGenerate,
  research: chapterResearch,
};

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
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
