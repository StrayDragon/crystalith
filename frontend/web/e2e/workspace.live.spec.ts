import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures/workspace';

const liveEnabled = process.env.E2E_LIVE === '1' || process.env.E2E_LIVE === 'true';

const pollDefaults = { timeout: 180_000, intervals: [1000, 2000, 5000] } as const;

async function expectVisible(locator: Locator, label?: string) {
  await expect
    .poll(() => locator.isVisible(), { ...pollDefaults, message: label })
    .toBe(true);
}

test.describe('Workspace (live)', () => {
  test.skip(!liveEnabled, 'Set E2E_LIVE=1 to enable live workspace checks');

  test('workspace baseline flows', async ({ page, waitForWorkspaceReady }) => {
    test.slow();
    test.setTimeout(240_000);

    await page.goto('/');
    await waitForWorkspaceReady();

    await expectVisible(page.getByRole('region', { name: '来源' }));
    await expectVisible(page.getByRole('region', { name: '对话' }));
    await expectVisible(page.getByRole('region', { name: 'Studio' }));

    await page.getByRole('button', { name: /笔记本/ }).click();
    await expectVisible(page.getByRole('textbox', { name: '搜索笔记本' }));
    await page.getByRole('main', { name: '三栏工作区' }).click({ position: { x: 10, y: 10 } });

    await page.getByRole('button', { name: /会话/ }).click();
    await expectVisible(page.getByRole('textbox', { name: '搜索会话' }));
    await page.getByRole('main', { name: '三栏工作区' }).click({ position: { x: 10, y: 10 } });

    const query = 'OpenAI';
    const searchInput = page.getByLabel('在网络中搜索新来源');
    await searchInput.fill(query);
    await searchInput.press('Enter');

    const queueHeader = page.getByRole('button', { name: new RegExp(query) });
    await expectVisible(queueHeader);
    await queueHeader.click();

    const selectAll = page.getByRole('checkbox', { name: '全选此搜索结果' }).first();
    await expectVisible(selectAll);
    await selectAll.click();

    await page.getByRole('button', { name: /作为链接导入/ }).first().click();
    await expect
      .poll(() => page.getByText('添加完成').isVisible(), pollDefaults)
      .toBe(true);
    await page.getByRole('button', { name: '完成' }).click();

    const sourceButton = page
      .getByRole('region', { name: '来源' })
      .getByRole('button', { name: /打开来源/ })
      .first();
    await expectVisible(sourceButton);
    await sourceButton.click();

    const qaInput = page.getByRole('textbox', { name: '基于来源内容提问' });
    await expectVisible(qaInput);
    const qaQuestion = '请概述这个来源的重点';
    const qaMessages = page.locator('[role="dialog"] .whitespace-pre-wrap');
    const qaMessageCount = await qaMessages.count();
    await qaInput.fill(qaQuestion);
    await qaInput.press('Enter');

    await expect
      .poll(async () => {
        return (await qaMessages.count()) >= qaMessageCount + 2;
      }, pollDefaults)
      .toBe(true);

    await page.getByRole('button', { name: '关闭来源详情' }).click();

    const chatInput = page.getByRole('textbox', { name: '对话输入' });
    const chatQuestion = '请给出一个简短总结';
    const chatMessages = page
      .getByRole('log', { name: '对话内容' })
      .locator('.whitespace-pre-wrap');
    const chatMessageCount = await chatMessages.count();
    await chatInput.fill(chatQuestion);
    await chatInput.press('Enter');

    await expect
      .poll(async () => {
        return (await chatMessages.count()) >= chatMessageCount + 2;
      }, pollDefaults)
      .toBe(true);

    await page.getByRole('button', { name: '演示' }).first().click();
    await expectVisible(page.getByText('演示生成'));
    await page.getByRole('button', { name: /高级设置/ }).click();
    await expectVisible(page.getByText('Frontmatter 预览'));
    await page.getByRole('button', { name: '关闭演示配置' }).click();

    await page.getByRole('button', { name: '打开知识图谱' }).click();
    await expectVisible(page.getByRole('button', { name: '关闭知识图谱' }));
    await page.getByRole('button', { name: '关闭知识图谱' }).click();
    await expect
      .poll(
        () => page.getByRole('button', { name: '关闭知识图谱' }).isVisible(),
        pollDefaults,
      )
      .toBe(false);
  });
});
