import {
  attachResearchDiagnostics,
  openLabCompose,
  readNotebookIdFromLabUrl,
  readRidFromUrl,
  waitForLiveResearchNode,
  waitForRunStatus,
} from '../fixtures/researchEden';
import { test, expect, TestIds, gotoWorkspace } from '../fixtures/test';

/**
 * @p0 Eden Lab production path (c100 / r453; c108 budget commitment).
 *
 * - VITE_LAB_FIXTURE must be unset (playwright webServer env).
 * - Server: CL_RESEARCH_E2E_STUB=1 + mock OpenAI gateway (L1 A+B).
 * - c108: mid-wave budget confirm removed — happy path runs to completed;
 *   expand/reexpand catch a live running window instead of awaiting budget.
 *
 * Fixture-only Lab smoke (S06b in p0-smoke) is NOT a substitute for this gate (L5=B).
 */

test.describe('@p0 Eden Lab production path', () => {
  test('R01: Compose → graph → completed → report → convert; expand_branch while live', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);

    await gotoWorkspace(page);

    const nbRes = await page.request.get('/v2/notebooks');
    expect(nbRes.ok()).toBeTruthy();
    const notebooks = (await nbRes.json()) as Array<{ id: number }>;
    expect(notebooks.length).toBeGreaterThan(0);
    let notebookId = notebooks[0]!.id;

    let runId: number | null = null;
    try {
      // --- Pass 1: commitment run completes without mid-wave budget pause (c108) ---
      await openLabCompose(page);
      await page.getByTestId(TestIds.researchLabComposeTopic).fill('e2e deep research parity');
      const allowWeb = page.getByTestId(TestIds.researchLabComposeAllowWeb);
      if (!(await allowWeb.isChecked())) await allowWeb.check();
      await page.getByTestId(TestIds.researchLabComposeSubmit).click();

      await expect(page).toHaveURL(/\/research-lab\/\d+\?rid=\d+/, { timeout: 30_000 });
      notebookId = readNotebookIdFromLabUrl(page) ?? notebookId;
      runId = readRidFromUrl(page);
      expect(runId).toBeTruthy();

      await expect(page.getByTestId(TestIds.researchLabGraph)).toBeVisible();

      const completed = await waitForRunStatus(page, notebookId, runId!, 'completed', 90_000);
      expect((completed.nodes ?? []).length).toBeGreaterThanOrEqual(3);
      expect((completed.edges ?? []).length).toBeGreaterThanOrEqual(1);
      expect(completed.maxSearches).toBeGreaterThanOrEqual(20);

      const reportPath = `/research-lab/${notebookId}/report?rid=${runId}`;
      await page.goto(reportPath);
      await expect(page.getByTestId(TestIds.researchLabReportPage)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId(TestIds.researchLabReport)).toBeVisible();
      await expect(page.getByTestId(TestIds.researchLabConvertNote)).toBeVisible();

      await page.getByTestId(TestIds.researchLabConvertNote).click();
      // Convert feedback is toast text (no dedicated Ok testids; see edenConvertActions).
      await expect(page.getByText(/已转为笔记 #\d+/)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId(TestIds.researchLabConvertSource).click();
      await expect(page.getByText(/已转为来源 #\d+/)).toBeVisible({ timeout: 60_000 });

      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'pass1-complete',
      });

      // --- Pass 2: expand_branch while Run is still live (c108) ---
      await page.goto('/');
      await gotoWorkspace(page);
      await openLabCompose(page);
      await page.getByTestId(TestIds.researchLabComposeTopic).fill('e2e expand branch path');
      const allowWeb2 = page.getByTestId(TestIds.researchLabComposeAllowWeb);
      if (!(await allowWeb2.isChecked())) await allowWeb2.check();
      await page.getByTestId(TestIds.researchLabComposeSubmit).click();
      await expect(page).toHaveURL(/\/research-lab\/\d+\?rid=\d+/, { timeout: 30_000 });
      notebookId = readNotebookIdFromLabUrl(page) ?? notebookId;
      runId = readRidFromUrl(page);
      expect(runId).toBeTruthy();

      const live = await waitForLiveResearchNode(page, notebookId, runId!, 90_000);

      const forkRes = await page.request.post(
        `/v2/notebooks/${notebookId}/research/${runId}/nodes/${live.researchNodeId}/fork`,
        { data: { hint: 'e2e expand' } },
      );
      expect(forkRes.ok()).toBeTruthy();
      const forked = (await forkRes.json()) as {
        status: string;
        confirmKind?: string;
        confirmBranchNodeId?: string;
      };
      expect(forked.status).toBe('awaiting_confirm');
      expect(forked.confirmKind).toBe('expand_branch');

      await page.reload();
      await expect(page.getByTestId(TestIds.researchLabConfirmApprove)).toBeVisible({
        timeout: 20_000,
      });
      await page.getByTestId(TestIds.researchLabConfirmApprove).click();
      await waitForRunStatus(page, notebookId, runId!, 'completed', 90_000);

      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'pass2-expand-complete',
      });
    } catch (error) {
      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'failure',
      });
      const msg = error instanceof Error ? error.message : String(error);
      const rid = runId ?? 'null';
      throw new Error(`Eden Lab e2e failed (notebook=${notebookId} rid=${rid}): ${msg}`);
    }
  });

  test('R02: live → request-reexpand → skip → completed (c104 / r459 / c108)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await gotoWorkspace(page);

    const nbRes = await page.request.get('/v2/notebooks');
    expect(nbRes.ok()).toBeTruthy();
    const notebooks = (await nbRes.json()) as Array<{ id: number }>;
    expect(notebooks.length).toBeGreaterThan(0);
    let notebookId = notebooks[0]!.id;

    let runId: number | null = null;
    try {
      await openLabCompose(page);
      await page.getByTestId(TestIds.researchLabComposeTopic).fill('e2e reexpand skip path');
      const allowWeb = page.getByTestId(TestIds.researchLabComposeAllowWeb);
      if (!(await allowWeb.isChecked())) await allowWeb.check();
      await page.getByTestId(TestIds.researchLabComposeSubmit).click();

      await expect(page).toHaveURL(/\/research-lab\/\d+\?rid=\d+/, { timeout: 30_000 });
      notebookId = readNotebookIdFromLabUrl(page) ?? notebookId;
      runId = readRidFromUrl(page);
      expect(runId).toBeTruthy();

      await waitForLiveResearchNode(page, notebookId, runId!, 90_000);

      await expect(page.getByTestId(TestIds.researchLabRequestReexpand)).toBeVisible({
        timeout: 20_000,
      });
      await page.getByTestId(TestIds.researchLabRequestReexpand).click();

      const reexpandDeadline = Date.now() + 30_000;
      let atReexpand: Awaited<ReturnType<typeof waitForRunStatus>> | null = null;
      while (Date.now() < reexpandDeadline) {
        const res = await page.request.get(`/v2/notebooks/${notebookId}/research/${runId}`);
        expect(res.ok()).toBeTruthy();
        const body = (await res.json()) as {
          status: string;
          confirmKind?: string | null;
        };
        if (body.status === 'awaiting_confirm' && body.confirmKind === 'reexpand') {
          atReexpand = body as Awaited<ReturnType<typeof waitForRunStatus>>;
          break;
        }
        await page.waitForTimeout(250);
      }
      expect(atReexpand?.confirmKind).toBe('reexpand');

      await expect(page.getByTestId(TestIds.researchLabConfirmApproveReexpand)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId(TestIds.researchLabConfirmSkipReexpand)).toBeVisible();
      await page.getByTestId(TestIds.researchLabConfirmSkipReexpand).click();

      await waitForRunStatus(page, notebookId, runId!, 'completed', 90_000);

      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'r02-reexpand-skip-complete',
      });
    } catch (error) {
      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'r02-failure',
      });
      const msg = error instanceof Error ? error.message : String(error);
      const rid = runId ?? 'null';
      throw new Error(`Eden Lab R02 failed (notebook=${notebookId} rid=${rid}): ${msg}`);
    }
  });
});
