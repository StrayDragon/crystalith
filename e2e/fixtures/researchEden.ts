import type { Page, TestInfo } from '@playwright/test';

import { expect, TestIds } from '../fixtures/test';

type ResearchRunBody = {
  id: number;
  status: string;
  confirmKind?: string | null;
  confirmBranchNodeId?: string | null;
  nodes?: Array<{ id: string; role?: string; title?: string }>;
  edges?: Array<{ id: string; source: string; target: string; kind?: string }>;
  report?: { title?: string } | null;
  searchesUsed?: number;
  maxSearches?: number;
  errorMessage?: string | null;
};

/** c100 L6: attach run JSON + URL + screenshot for agent/human triage. */
export async function attachResearchDiagnostics(
  page: Page,
  testInfo: TestInfo,
  opts: { notebookId: number; runId: number | null; label: string },
): Promise<ResearchRunBody | null> {
  const url = page.url();
  await testInfo.attach(`${opts.label}-page-url`, {
    body: url,
    contentType: 'text/plain',
  });
  try {
    const shot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${opts.label}-screenshot`, {
      body: shot,
      contentType: 'image/png',
    });
  } catch {
    /* page may already be closed */
  }
  if (!opts.runId) {
    await testInfo.attach(`${opts.label}-run`, {
      body: JSON.stringify({ notebookId: opts.notebookId, runId: null }, null, 2),
      contentType: 'application/json',
    });
    return null;
  }
  const res = await page.request.get(`/v2/notebooks/${opts.notebookId}/research/${opts.runId}`);
  const body = (await res.json()) as ResearchRunBody;
  await testInfo.attach(`${opts.label}-run.json`, {
    body: JSON.stringify(
      {
        httpStatus: res.status(),
        status: body.status,
        confirmKind: body.confirmKind ?? null,
        confirmBranchNodeId: body.confirmBranchNodeId ?? null,
        nodeCount: body.nodes?.length ?? 0,
        edgeCount: body.edges?.length ?? 0,
        searchesUsed: body.searchesUsed,
        maxSearches: body.maxSearches,
        errorMessage: body.errorMessage ?? null,
        reportTitle: body.report?.title ?? null,
        nodes: body.nodes?.map((n) => ({ id: n.id, role: n.role, title: n.title })),
        edges: body.edges?.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          kind: e.kind,
        })),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  return body;
}

export async function openLabCompose(page: Page): Promise<void> {
  await page.getByTestId(TestIds.researchTasksTrigger).click();
  await expect(page.getByTestId(TestIds.researchTasksDrawer)).toBeVisible();
  await page.getByTestId(TestIds.researchTasksCreate).click();
  await expect(page.getByTestId(TestIds.researchLabPage)).toBeVisible();
  await expect(page.getByTestId(TestIds.researchLabCompose)).toBeVisible();
}

export async function waitForRunStatus(
  page: Page,
  notebookId: number,
  runId: number,
  wanted: string | string[],
  timeoutMs = 60_000,
): Promise<ResearchRunBody> {
  const targets = Array.isArray(wanted) ? wanted : [wanted];
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const res = await page.request.get(`/v2/notebooks/${notebookId}/research/${runId}`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as ResearchRunBody;
    last = body.status;
    if (targets.includes(body.status)) return body;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for status ${targets.join('|')}; last=${last}`);
}

/**
 * c108: runs no longer pause on mid-wave budget confirm. Catch a live window
 * (running / awaiting_confirm) with at least one research node for fork/reexpand.
 */
export async function waitForLiveResearchNode(
  page: Page,
  notebookId: number,
  runId: number,
  timeoutMs = 90_000,
): Promise<ResearchRunBody & { researchNodeId: string }> {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const res = await page.request.get(`/v2/notebooks/${notebookId}/research/${runId}`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as ResearchRunBody;
    last = `${body.status};nodes=${body.nodes?.length ?? 0}`;
    const research = (body.nodes ?? []).find((n) => n.role === 'research');
    if (research?.id && (body.status === 'running' || body.status === 'awaiting_confirm')) {
      return { ...body, researchNodeId: research.id };
    }
    if (body.status === 'completed' || body.status === 'failed' || body.status === 'cancelled') {
      throw new Error(`Run reached ${body.status} before live research node window; last=${last}`);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for live research node; last=${last}`);
}

export function readRidFromUrl(page: Page): number | null {
  const rid = Number(new URL(page.url()).searchParams.get('rid'));
  return Number.isFinite(rid) && rid > 0 ? rid : null;
}
