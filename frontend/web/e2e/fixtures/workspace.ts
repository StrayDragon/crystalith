import { expect, test as base } from '@playwright/test';

type WorkspaceFixtures = {
  waitForWorkspaceReady: () => Promise<void>;
};

export const test = base.extend<WorkspaceFixtures>({
  waitForWorkspaceReady: async ({ page }, use) => {
    await use(async () => {
      await page.waitForLoadState('domcontentloaded');
      const panels = [
        page.locator('[aria-label="来源"]'),
        page.locator('[aria-label="对话"]'),
        page.locator('[aria-label="Studio"]'),
      ];
      await expect.poll(
        async () =>
          (await panels[0].isVisible()) &&
          (await panels[1].isVisible()) &&
          (await panels[2].isVisible()),
        { timeout: 60000 },
      ).toBe(true);
    });
  },
});

export { expect };
