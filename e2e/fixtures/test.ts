import { test as base, expect } from '@playwright/test';

import { TestIds } from '../../apps/web/src/shared/testids';

type Fixtures = {
  ids: typeof TestIds;
};

/**
 * Playwright fixtures for Crystalith P0 E2E.
 * Prefer `page.getByTestId(ids.xxx)` — never assert on Chinese copy for critical gates.
 */
export const test = base.extend<Fixtures>({
  // Playwright allows empty deps `{}`; oxlint no-empty-pattern forbids it — use unused arg.
  ids: async (_fixtures, use) => {
    await use(TestIds);
  },
});

export { expect, TestIds };

/** Wait until workspace shell is interactive (connected enough to show header). */
export async function gotoWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId(TestIds.workspaceRoot)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(TestIds.workspaceHeader)).toBeVisible();
  // Auto-create / reconnect may briefly show the banner; wait until header is stable.
  await page.waitForTimeout(500);
}
