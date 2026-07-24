import {
  attachResearchDiagnostics,
  openLabCompose,
  readRidFromUrl,
  waitForRunStatus,
} from '../fixtures/researchEden';
import { test, expect, TestIds, gotoWorkspace } from '../fixtures/test';

/**
 * @p0 Eden Lab production path (c100 / r453).
 *
 * - VITE_LAB_FIXTURE must be unset (playwright webServer env).
 * - Server: CL_RESEARCH_E2E_STUB=1 + mock OpenAI gateway (L1 A+B).
 * - One long case: Compose→graph→budget+expand→report→convert note+source (L2=A, L3=C, L4=A+B).
 * - Failures attach screenshot + run JSON (L6).
 *
 * Fixture-only Lab smoke (S06b in p0-smoke) is NOT a substitute for this gate (L5=B).
 */

test.describe('@p0 Eden Lab production path', () => {
  test('R01: Compose → graph → M1 budget+expand → report → convert note+source', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);

    await gotoWorkspace(page);

    const nbRes = await page.request.get('/v2/notebooks');
    expect(nbRes.ok()).toBeTruthy();
    const notebooks = (await nbRes.json()) as Array<{ id: number }>;
    expect(notebooks.length).toBeGreaterThan(0);
    const notebookId = notebooks[0]!.id;

    let runId: number | null = null;
    try {
      // --- Pass 1: budget confirm + report converts ---
      await openLabCompose(page);
      await page.getByTestId(TestIds.researchLabComposeTopic).fill('e2e deep research parity');
      const allowWeb = page.getByTestId(TestIds.researchLabComposeAllowWeb);
      if (!(await allowWeb.isChecked())) await allowWeb.check();
      await page.getByTestId(TestIds.researchLabComposeSubmit).click();

      await expect(page).toHaveURL(/\/research-lab\/\d+\?rid=\d+/, { timeout: 30_000 });
      runId = readRidFromUrl(page);
      expect(runId).toBeTruthy();

      const awaitingBudget = await waitForRunStatus(
        page,
        notebookId,
        runId!,
        'awaiting_confirm',
        90_000,
      );
      expect(awaitingBudget.confirmKind ?? 'budget').toBe('budget');
      expect((awaitingBudget.nodes ?? []).length).toBeGreaterThanOrEqual(3);
      expect((awaitingBudget.edges ?? []).length).toBeGreaterThanOrEqual(1);

      await expect(page.getByTestId(TestIds.researchLabGraph)).toBeVisible();
      await expect(page.getByTestId(TestIds.researchLabConfirmContinue)).toBeVisible({
        timeout: 20_000,
      });
      await page.getByTestId(TestIds.researchLabConfirmContinue).click();

      await waitForRunStatus(page, notebookId, runId!, 'completed', 90_000);

      // Open report (Eden path; not fixture sessionStorage)
      const reportPath = `/research-lab/${notebookId}/report?rid=${runId}`;
      await page.goto(reportPath);
      await expect(page.getByTestId(TestIds.researchLabReportPage)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId(TestIds.researchLabReport)).toBeVisible();

      const noteResp = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          res.url().includes(`/research/${runId}/convert-to-note`) &&
          res.ok(),
      );
      await page.getByTestId(TestIds.researchLabConvertNote).click();
      await noteResp;

      const sourceResp = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          res.url().includes(`/research/${runId}/convert-to-source`) &&
          res.ok(),
      );
      await page.getByTestId(TestIds.researchLabConvertSource).click();
      await sourceResp;

      await attachResearchDiagnostics(page, testInfo, {
        notebookId,
        runId,
        label: 'pass1-budget-complete',
      });

      // --- Pass 2: expand_branch confirm (L3=C) ---
      await page.goto('/');
      await gotoWorkspace(page);
      await openLabCompose(page);
      await page.getByTestId(TestIds.researchLabComposeTopic).fill('e2e expand branch path');
      const allowWeb2 = page.getByTestId(TestIds.researchLabComposeAllowWeb);
      if (!(await allowWeb2.isChecked())) await allowWeb2.check();
      await page.getByTestId(TestIds.researchLabComposeSubmit).click();
      await expect(page).toHaveURL(/\/research-lab\/\d+\?rid=\d+/, { timeout: 30_000 });
      runId = readRidFromUrl(page);
      expect(runId).toBeTruthy();

      const atBudget = await waitForRunStatus(page, notebookId, runId!, 'awaiting_confirm', 90_000);
      expect(atBudget.confirmKind ?? 'budget').toBe('budget');
      const researchNode = (atBudget.nodes ?? []).find((n) => n.role === 'research');
      expect(researchNode?.id).toBeTruthy();

      // Interrupt budget with fork → expand_branch surface
      const forkRes = await page.request.post(
        `/v2/notebooks/${notebookId}/research/${runId}/nodes/${researchNode!.id}/fork`,
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
});
