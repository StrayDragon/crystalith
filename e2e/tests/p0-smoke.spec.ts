import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { test, expect, TestIds, gotoWorkspace } from '../fixtures/test';

/**
 * @p0 Critical browser gate — no LLM / external network required.
 * Selectors: data-testid only (apps/web/src/shared/testids.ts).
 */

async function activeNotebookId(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get('/v2/notebooks');
  expect(res.ok()).toBeTruthy();
  const notebooks = await res.json();
  expect(notebooks.length).toBeGreaterThan(0);
  return notebooks[0].id as number;
}

async function seedMarkdownSource(
  page: import('@playwright/test').Page,
  notebookId: number,
): Promise<void> {
  const dir = resolve(import.meta.dirname, '../.tmp');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'p0-seed.md');
  writeFileSync(
    file,
    '# P0 Seed\n\nStable fixture for source-detail gate.\n\n- item a\n- item b\n',
  );
  const res = await page.request.post(`/v2/notebooks/${notebookId}/sources/upload`, {
    multipart: {
      file: {
        name: 'p0-seed.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(
          '# P0 Seed\n\nStable fixture for source-detail gate.\n\n- item a\n- item b\n',
        ),
      },
    },
  });
  // Embedding may fail offline; upload still returns 200 with failed status.
  expect(res.status()).toBeLessThan(500);
  await page.reload();
  await gotoWorkspace(page);
}

test.describe('@p0 workspace smoke', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page);
  });

  test('A01: workspace shell mounts', async ({ page }) => {
    await expect(page.getByTestId(TestIds.workspaceRoot)).toBeVisible();
    await expect(page.getByTestId(TestIds.workspaceHeader)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourcesPanel)).toBeVisible();
    await expect(page.getByTestId(TestIds.chatPanel)).toBeVisible();
    await expect(page.getByTestId(TestIds.studioPanel)).toBeVisible();
  });

  test('A02: API health via dev-server proxy', async ({ page }) => {
    const res = await page.request.get('/v2/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('A03: notebooks wire uses camelCase', async ({ page }) => {
    const res = await page.request.get('/v2/notebooks');
    expect(res.ok()).toBeTruthy();
    const notebooks = await res.json();
    expect(Array.isArray(notebooks)).toBeTruthy();
    if (notebooks.length > 0) {
      expect(notebooks[0]).toHaveProperty('createdAt');
      expect(notebooks[0]).not.toHaveProperty('created_at');
    }
  });

  test('A04: onboarding banner is not shown', async ({ page }) => {
    await expect(page.getByTestId(TestIds.onboardingBanner)).toHaveCount(0);
  });

  test('N01: notebook switcher opens by testid', async ({ page }) => {
    await page.getByTestId(TestIds.notebookSwitcherTrigger).click();
    await expect(page.getByTestId(TestIds.notebookSwitcherOverlay)).toBeVisible();
    await expect(page.getByTestId(TestIds.notebookList)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('N02: create notebook control is present and visible', async ({ page }) => {
    const create = page.getByTestId(TestIds.notebookCreateButton);
    await expect(create).toBeVisible();
    await expect(create).toHaveAttribute('aria-label', '新建笔记本');
    await expect(create.locator('svg')).toBeVisible();
  });

  test('N03: create notebook via API appears in switcher', async ({ page }) => {
    const created = await page.request.post('/v2/notebooks', {
      data: { name: 'E2E P0 Notebook' },
    });
    expect(created.status()).toBeLessThan(300);
    await page.reload();
    await gotoWorkspace(page);
    await page.getByTestId(TestIds.notebookSwitcherTrigger).click();
    await expect(page.getByTestId(TestIds.notebookSwitcherOverlay)).toBeVisible();
    await expect(page.getByTestId(TestIds.notebookOption).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('S01: sources panel empty or count visible', async ({ page }) => {
    const count = page.getByTestId(TestIds.sourcesCount);
    const empty = page.getByTestId(TestIds.sourcesEmpty);
    await expect(count.or(empty).first()).toBeVisible();
  });

  test('S02: connectors dialog opens', async ({ page }) => {
    await page.getByTestId(TestIds.sourcesConnectors).click();
    await expect(page.getByTestId(TestIds.sourcesConnectorsDialog)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('S03: extractor settings dialog opens', async ({ page }) => {
    await page.getByTestId(TestIds.sourcesExtractorSettings).click();
    await expect(page.getByTestId(TestIds.sourcesExtractorDialog)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('S04: URL import dialog opens with labeled input', async ({ page }) => {
    const openBtn = page.getByTestId(TestIds.urlImportOpen);
    await expect(openBtn.first()).toBeVisible({ timeout: 15_000 });
    await openBtn.first().click();
    await expect(page.getByTestId(TestIds.urlImportDialog)).toBeVisible();
    await expect(page.getByTestId(TestIds.urlImportInput)).toBeVisible();
    await expect(page.getByTestId(TestIds.urlImportModeLink)).toBeVisible();
    await expect(page.getByTestId(TestIds.urlImportModeFetch)).toBeVisible();
    await page.getByTestId(TestIds.urlImportCancel).click();
  });

  test('S05: upload controls exist', async ({ page }) => {
    await expect(page.getByTestId(TestIds.sourcesAdd)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourcesUploadInput)).toBeAttached();
  });

  test('S06: topbar search opens Fast-only panel', async ({ page }) => {
    await expect(page.getByTestId(TestIds.topbarSearchTrigger)).toBeVisible();
    await page.getByTestId(TestIds.topbarSearchTrigger).click();
    await expect(page.getByTestId(TestIds.topbarSearchPanel)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourcesSearchInput)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourcesSearchSubmit)).toBeVisible();
    await expect(page.getByTestId('topbar-search-tab-deep')).toHaveCount(0);
    await expect(page.getByTestId('deep-research-desk')).toHaveCount(0);
  });

  test('S06b: Lab flask (avatar-adjacent) opens compose via task inbox', async ({ page }) => {
    await expect(page.getByTestId(TestIds.researchTasksTrigger)).toBeVisible();
    await page.getByTestId(TestIds.researchTasksTrigger).click();
    await expect(page.getByTestId(TestIds.researchTasksDrawer)).toBeVisible();
    await page.getByTestId(TestIds.researchTasksCreate).click();
    await expect(page.getByTestId(TestIds.researchLabPage)).toBeVisible();
    await expect(page).toHaveURL(/\/research-lab\//);
    await expect(page.getByTestId(TestIds.researchLabCompose)).toBeVisible();
    await expect(page.getByTestId(TestIds.researchLabComposeTopic)).toBeVisible();
    await expect(page.getByTestId(TestIds.researchLabComposeSubmit)).toBeVisible();
  });

  test('S07: sort menu opens', async ({ page }) => {
    await page.getByTestId(TestIds.sourcesSortMenu).click();
    await expect(page.getByTestId(TestIds.sourcesSortMenuList)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('S08: seeded source opens detail dialog', async ({ page }) => {
    const nid = await activeNotebookId(page);
    await seedMarkdownSource(page, nid);
    const row = page.getByTestId(TestIds.sourceRow).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(page.getByTestId(TestIds.sourceDetailDialog)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourceDetailTabSummary)).toBeVisible();
    await expect(page.getByTestId(TestIds.sourceDetailTabRaw)).toBeVisible();
    await page.getByTestId(TestIds.sourceDetailClose).click();
    await expect(page.getByTestId(TestIds.sourceDetailDialog)).toHaveCount(0);
  });

  test('S09: source row exposes selectable checkbox', async ({ page }) => {
    await expect(page.getByTestId(TestIds.sourceRowCheckbox).first()).toBeAttached({
      timeout: 20_000,
    });
  });

  test('S10: connector bind → snapshot → unbind', async ({ page }) => {
    const dir = resolve(import.meta.dirname, '../.tmp/connector-unbind');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'note.md'), '# e2e connector\n');

    page.on('dialog', (dialog) => {
      void dialog.accept();
    });

    await page.getByTestId(TestIds.sourcesConnectors).click();
    const dialog = page.getByTestId(TestIds.sourcesConnectorsDialog);
    await expect(dialog).toBeVisible();

    await page.getByTestId(`${TestIds.sourcesConnectorsOption}-local-directory`).click();
    await page.getByTestId(TestIds.sourcesConnectorsNext).click();
    await page.getByTestId(`${TestIds.sourcesConnectorsConfigField}-directoryPath`).fill(dir);
    await page.getByTestId(TestIds.sourcesConnectorsCreateBinding).click();

    await expect(page.getByTestId(TestIds.sourcesConnectorsUnbind)).toBeVisible({
      timeout: 20_000,
    });
    // Snapshot auto-load should not crash the sources ErrorBoundary.
    await expect(page.getByTestId(TestIds.sourcesPanel)).toBeVisible();
    await expect(page.getByText('来源模块异常')).toHaveCount(0);

    const deleteResp = page.waitForResponse(
      (res) =>
        res.request().method() === 'DELETE' &&
        /\/v2\/source-connector-bindings\/\d+/.test(res.url()) &&
        res.status() === 204,
    );
    await page.getByTestId(TestIds.sourcesConnectorsUnbind).click();
    await deleteResp;

    await expect(page.getByTestId(TestIds.sourcesConnectorsUnbind)).toHaveCount(0);
    await expect(page.getByTestId(TestIds.sourcesConnectorsCreateBinding)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('C01: chat input and send controls exist', async ({ page }) => {
    await expect(page.getByTestId(TestIds.chatInput)).toBeVisible();
    await expect(page.getByTestId(TestIds.chatSend)).toBeVisible();
  });

  test('C02: session switcher opens', async ({ page }) => {
    await page.getByTestId(TestIds.sessionSwitcherTrigger).click();
    await expect(page.getByTestId(TestIds.sessionSwitcherOverlay)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('C03: chat input accepts typed draft', async ({ page }) => {
    const input = page.getByTestId(TestIds.chatInput);
    await input.fill('p0 draft — no send');
    await expect(input).toHaveValue('p0 draft — no send');
  });

  test('O01: studio generate popover opens', async ({ page }) => {
    await page.getByTestId(TestIds.studioGenerate).click();
    await expect(page.getByTestId(TestIds.studioToolsPopover)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TestIds.studioToolsPopover)).toHaveCount(0);
  });

  test('O02: add note dialog opens', async ({ page }) => {
    await page.getByTestId(TestIds.studioAddNote).click();
    await expect(page.getByTestId(TestIds.noteEditorDialog)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('L01: command palette via Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+K');
    await expect(page.getByTestId(TestIds.commandPalette)).toBeVisible();
    await expect(page.getByTestId(TestIds.commandPaletteInput)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TestIds.commandPalette)).toHaveCount(0);

    // Command palette should also open while chat input is focused.
    await page.getByTestId(TestIds.chatInput).click();
    await page.keyboard.press('Control+K');
    await expect(page.getByTestId(TestIds.commandPalette)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TestIds.commandPalette)).toHaveCount(0);
  });

  test('L02: layout lock toggle is present', async ({ page }) => {
    await expect(page.getByTestId(TestIds.layoutLockToggle)).toBeVisible();
  });

  test('L03: user menu opens diagnostics via testid', async ({ page }) => {
    await page.getByTestId(TestIds.userMenuTrigger).click();
    await page.getByTestId(TestIds.userMenuDiagnostics).click();
    await expect(page.getByTestId(TestIds.diagnosticsDialog)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('L04: user menu opens system config via testid', async ({ page }) => {
    await page.getByTestId(TestIds.userMenuTrigger).click();
    await page.getByTestId(TestIds.userMenuSystemConfig).click();
    await expect(page.getByTestId(TestIds.systemConfigDialog)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('L05: user menu opens shortcut help via testid', async ({ page }) => {
    await page.getByTestId(TestIds.userMenuTrigger).click();
    await page.getByTestId(TestIds.userMenuShortcutHelp).click();
    await expect(page.getByTestId(TestIds.shortcutHelp)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('L06: layout lock toggle flips aria-label', async ({ page }) => {
    const lock = page.getByTestId(TestIds.layoutLockToggle);
    const before = await lock.getAttribute('aria-label');
    await lock.click();
    const after = await lock.getAttribute('aria-label');
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    // restore
    await lock.click();
  });
});
