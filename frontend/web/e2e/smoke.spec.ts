import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - 基础设施验证
 *
 * 这些测试用于验证 E2E 测试基础设施是否正常工作
 */

test.describe('Smoke Tests', () => {
  test('应用程序可以正常加载', async ({ page }) => {
    await page.goto('http://localhost:3000/');

    // 验证页面标题
    await expect(page).toHaveTitle(/研究工作台/);

    // 验证主要区域存在
    await expect(page.locator('main')).toBeVisible();
  });

  test('三栏布局正确渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/');

    // 等待页面加载
    await page.waitForSelector('main', { timeout: 10000 });

    // 验证三个主要区域
    await expect(page.locator('[aria-label="来源"]')).toBeVisible();
    await expect(page.locator('[aria-label="对话"]')).toBeVisible();
    await expect(page.locator('[aria-label="Studio"]')).toBeVisible();
  });

  test('笔记本切换器可以打开', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForSelector('main', { timeout: 10000 });

    // 点击笔记本切换器
    const notebookSwitcher = page.getByRole('button', { name: /笔记本/ }).first();
    await notebookSwitcher.click();

    // 验证弹出内容可见
    await page.waitForTimeout(500);
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('会话切换器可以打开', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForSelector('main', { timeout: 10000 });

    // 点击会话切换器
    const sessionSwitcher = page.getByRole('button', { name: /会话/ }).first();
    await sessionSwitcher.click();

    // 验证弹出内容可见
    await page.waitForTimeout(500);
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });
});
