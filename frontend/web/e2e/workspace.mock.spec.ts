import { test, expect } from './fixtures/workspace';

test.describe('Workspace (mock)', () => {
  test.beforeEach(async ({ page, waitForWorkspaceReady }) => {
    await page.goto('/');
    await waitForWorkspaceReady();
  });

  test('workspace loads with three panels and switchers', async ({ page, workspace }) => {
    await expect(page.getByRole('region', { name: '来源' })).toBeVisible();
    await expect(page.getByRole('region', { name: '对话' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Studio' })).toBeVisible();

    await page.getByRole('button', { name: /笔记本/ }).click();
    await expect(page.getByRole('textbox', { name: '搜索笔记本' })).toBeVisible();
    await expect(page.getByText(workspace.notebooks[0].name)).toBeVisible();
    await page.getByRole('main', { name: '三栏工作区' }).click({ position: { x: 8, y: 8 } });

    await page.getByRole('button', { name: /会话/ }).click();
    await expect(page.getByRole('textbox', { name: '搜索会话' })).toBeVisible();
    await expect(page.getByText(workspace.sessions[0].title ?? '未命名会话')).toBeVisible();
  });

  test('sources queue batch add and source QA', async ({ page }) => {
    const query = 'OpenAI';
    const searchInput = page.getByLabel('在网络中搜索新来源');
    await searchInput.fill(query);
    await searchInput.press('Enter');

    const queueHeader = page.getByRole('button', { name: new RegExp(query) });
    await expect(queueHeader).toBeVisible();
    await queueHeader.click();

    const selectAll = page.getByRole('checkbox', { name: '全选此搜索结果' }).first();
    await selectAll.click();

    await page.getByRole('button', { name: '作为链接导入' }).first().click();
    await expect(page.getByText('添加完成')).toBeVisible();
    await page.getByRole('button', { name: '完成' }).click();

    const sourceButton = page
      .getByRole('region', { name: '来源' })
      .getByRole('button', { name: /打开来源/ })
      .first();
    await expect(sourceButton).toBeVisible();
    await sourceButton.click();

    const qaInput = page.getByRole('textbox', { name: '基于来源内容提问' });
    await qaInput.fill('这份来源讲了什么？');
    await qaInput.press('Enter');

    await expect(page.getByText('这是基于来源的示例回答。')).toBeVisible();
    await page.getByRole('button', { name: '关闭来源详情' }).click();
  });

  test('chat streaming, studio slides config, and graph view', async ({ page }) => {
    const chatInput = page.getByRole('textbox', { name: '对话输入' });
    await chatInput.fill('请总结最新进展');
    await chatInput.press('Enter');

    await expect(page.getByRole('log', { name: '对话内容' })).toContainText(
      '这是一次模拟流式示例回答。',
    );

    await page.getByRole('button', { name: '演示' }).first().click();
    await expect(page.getByText('演示生成')).toBeVisible();
    await page.getByRole('button', { name: /高级设置/ }).click();
    await expect(page.getByText('Frontmatter 预览')).toBeVisible();
    await page.getByRole('button', { name: '关闭演示配置' }).click();

    await page.getByRole('button', { name: '打开知识图谱' }).click();
    await expect(page.getByRole('button', { name: '关闭知识图谱' })).toBeVisible();
    await page.getByRole('button', { name: '关闭知识图谱' }).click();
    await expect(page.getByRole('button', { name: '关闭知识图谱' })).toBeHidden();
  });
});
