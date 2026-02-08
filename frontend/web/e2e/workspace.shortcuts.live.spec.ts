import { test, expect } from './fixtures/workspace';

const pollDefaults = { timeout: 180_000, intervals: [1000, 2000, 5000] } as const;

test.describe('Workspace keyboard shortcuts (live)', () => {
  test('core shortcuts work in workspace', async ({ page, request, waitForWorkspaceReady }) => {
    test.slow();
    test.setTimeout(360_000);

    await page.goto('/');
    await waitForWorkspaceReady();

    // Ctrl+? opens shortcut help
    await page.keyboard.press('Control+Shift+/');
    const helpDialog = page.getByRole('dialog', { name: '快捷键帮助' });
    await expect(helpDialog).toBeVisible();
    await expect(helpDialog.getByText('打开会话搜索面板')).toBeVisible();
    await expect(helpDialog.getByText('发送消息')).toBeVisible();

    // Escape closes help
    await page.keyboard.press('Escape');
    await expect(helpDialog).toBeHidden();

    // Ctrl+K opens search panel
    await page.keyboard.press('Control+K');
    const sessionSearch = page.getByRole('textbox', { name: '搜索会话' });
    await expect(sessionSearch).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sessionSearch).toBeHidden();

    // Ctrl+N creates notebook (also ensures chat input becomes enabled)
    const listBefore = await request.get('http://127.0.0.1:8032/v1/notebooks');
    expect(listBefore.ok()).toBe(true);
    const beforeCount = (await listBefore.json()).length;

    await page.keyboard.press('Control+N');

    await expect.poll(async () => {
      const listAfter = await request.get('http://127.0.0.1:8032/v1/notebooks');
      if (!listAfter.ok()) return beforeCount;
      const notebooks = await listAfter.json();
      return notebooks.length;
    }, pollDefaults).toBeGreaterThan(beforeCount);

    const chatInput = page.getByRole('textbox', { name: '对话输入' });
    await expect(chatInput).toBeEnabled();

    // Ctrl+K is ignored in input focus (AC-3)
    await chatInput.focus();
    await expect.poll(
      () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
      pollDefaults,
    ).toBe('对话输入');

    await page.keyboard.press('Control+K');
    await expect(sessionSearch).toHaveCount(0);

    // Blur input before panel-level navigation shortcuts
    await page.getByRole('region', { name: '来源' }).click({ position: { x: 12, y: 12 } });

    // Panel focus shortcuts Ctrl+1/2/3
    await page.keyboard.press('Control+1');
    await expect.poll(
      () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
      pollDefaults,
    ).toBe('来源');

    await page.keyboard.press('Control+2');
    await expect.poll(
      () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
      pollDefaults,
    ).toBe('对话');

    await page.keyboard.press('Control+3');
    await expect.poll(
      () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
      pollDefaults,
    ).toBe('Studio');

    // Ctrl+Enter sends message
    const messageList = page.getByTestId('chat-message-item');
    const beforeMessages = await messageList.count();
    await chatInput.fill(`快捷键发送测试 ${Date.now()}`);
    await page.keyboard.press('Control+Enter');

    await expect.poll(async () => {
      return await messageList.count();
    }, pollDefaults).toBeGreaterThan(beforeMessages);
  });
});
