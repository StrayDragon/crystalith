import { test, expect, TestIds, gotoWorkspace } from '../fixtures/test';

/**
 * @p1 Sources flows beyond the critical @p0 smoke gate.
 * Not included in `just qa` (which greps @p0 only); run via `just e2e-all` / `just e2e-p1`.
 */

async function activeNotebookId(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get('/v2/notebooks');
  expect(res.ok()).toBeTruthy();
  const notebooks = await res.json();
  expect(notebooks.length).toBeGreaterThan(0);
  return notebooks[0].id as number;
}

test.describe('@p1 sources flows', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page);
  });

  test('S11: URL import (link mode) adds a source row', async ({ page }) => {
    // Use a public IP literal so SSRF skips DNS (hostnames can hang offline).
    const uniqueUrl = `https://1.1.1.1/e2e-p1-link-${Date.now()}`;

    await page.getByTestId(TestIds.urlImportOpen).first().click();
    await expect(page.getByTestId(TestIds.urlImportDialog)).toBeVisible();
    await page.getByTestId(TestIds.urlImportModeLink).click();
    await page.getByTestId(TestIds.urlImportInput).fill(uniqueUrl);

    const fromUrl = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/v2\/notebooks\/\d+\/sources\/from-url/.test(res.url()) &&
        res.status() < 500,
    );
    await page.getByTestId(TestIds.urlImportSubmit).click();
    const resp = await fromUrl;
    expect(resp.status()).toBeLessThan(400);

    await expect(page.getByTestId(TestIds.urlImportDialog)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId(TestIds.sourceRow).filter({ hasText: uniqueUrl })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('S12: delete seeded source via row menu', async ({ page }) => {
    const nid = await activeNotebookId(page);
    const filename = `p1-delete-${Date.now()}.md`;
    const upload = await page.request.post(`/v2/notebooks/${nid}/sources/upload`, {
      multipart: {
        file: {
          name: filename,
          mimeType: 'text/markdown',
          buffer: Buffer.from(`# P1 Delete\n\n${filename}\n`),
        },
      },
    });
    expect(upload.status()).toBeLessThan(500);

    await page.reload();
    await gotoWorkspace(page);

    const row = page.getByTestId(TestIds.sourceRow).filter({ hasText: filename });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Menu button is opacity-0 until hover; force-click is fine for gate coverage.
    await row.locator('..').getByTestId(TestIds.sourceRowMenu).click({ force: true });
    await page.getByTestId(TestIds.sourceRowDelete).click();

    const deleteResp = page.waitForResponse(
      (res) =>
        res.request().method() === 'DELETE' &&
        /\/v2\/notebooks\/\d+\/sources\/\d+/.test(res.url()) &&
        res.status() === 204,
    );
    await page.getByTestId(TestIds.confirmPopoverConfirm).click();
    await deleteResp;

    await expect(page.getByTestId(TestIds.sourceRow).filter({ hasText: filename })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
