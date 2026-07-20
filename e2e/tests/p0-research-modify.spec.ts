import { test, expect, TestIds, gotoWorkspace } from '../fixtures/test';

/**
 * @p0 Research HITL: subset selection → POST .../modify (not approve).
 * LLM/agent offline — session detail + list + SSE are route-mocked.
 */

const RESEARCH_ID = 42;
const TOPIC = 'E2E Research HITL';

const PLAN_QUERIES = [
  { query: 'alpha crystalith query', engine: 'Web', priority: 1, reason: 'primary' },
  { query: 'beta crystalith query', engine: 'Web', priority: 2, reason: 'secondary' },
];

const SESSION_LIST_ITEM = {
  id: RESEARCH_ID,
  notebookId: 1,
  topic: TOPIC,
  status: 'waiting_user',
  currentIteration: 1,
  maxIterations: 4,
  aggregatedResults: null,
  finalReport: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SESSION_DETAIL = {
  ...SESSION_LIST_ITEM,
  steps: [
    {
      id: 1,
      sessionId: RESEARCH_ID,
      iteration: 1,
      type: 'plan',
      inputData: null,
      outputData: {
        queries: PLAN_QUERIES,
        reasoning: 'e2e mock plan with two queries',
      },
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

async function mockResearchHitlRoutes(page: import('@playwright/test').Page): Promise<void> {
  // Specific paths last so they win over the detail GET matcher.
  await page.route(/\/v2\/notebooks\/\d+\/research(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            ...SESSION_LIST_ITEM,
            notebookId: Number(
              route
                .request()
                .url()
                .match(/notebooks\/(\d+)/)?.[1] ?? 1,
            ),
          },
        ],
        total: 1,
        offset: 0,
        limit: 200,
      }),
    });
  });

  await page.route(/\/v2\/notebooks\/\d+\/research\/\d+$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const nid = Number(
      route
        .request()
        .url()
        .match(/notebooks\/(\d+)/)?.[1] ?? 1,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SESSION_DETAIL, notebookId: nid }),
    });
  });

  await page.route(/\/v2\/notebooks\/\d+\/research\/\d+\/stream/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: 'event: waiting\ndata: {"status":"waiting_user","iteration":1,"message":"awaiting confirmation"}\n\n',
    });
  });

  await page.route(/\/v2\/notebooks\/\d+\/research\/\d+\/modify/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: RESEARCH_ID, status: 'searching', modified: true }),
    });
  });

  // Guard: approve must not be the path under test; still answer so UI does not hang.
  await page.route(/\/v2\/notebooks\/\d+\/research\/\d+\/approve/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: RESEARCH_ID, status: 'searching' }),
    });
  });
}

test.describe('@p0 research HITL modify', () => {
  test('R01: uncheck one query then approve posts modify with filtered plan', async ({ page }) => {
    await mockResearchHitlRoutes(page);
    await gotoWorkspace(page);

    const capsule = page.getByRole('button', { name: `打开研究会话：${TOPIC}` });
    await expect(capsule).toBeVisible({ timeout: 20_000 });
    await capsule.click();

    const dialog = page.getByTestId(TestIds.researchDetailDialog);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`${TestIds.researchQueryCheckbox}-0`)).toBeVisible();
    await expect(page.getByTestId(`${TestIds.researchQueryCheckbox}-1`)).toBeVisible();

    // Default: all selected. Uncheck query index 1 → subset → modify (not approve).
    await page.getByTestId(`${TestIds.researchQueryCheckbox}-1`).click();

    const modifyPromise = page.waitForRequest((req) => {
      if (req.method() !== 'POST') return false;
      return /\/v2\/notebooks\/\d+\/research\/\d+\/modify/.test(req.url());
    });

    const approveHits: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/research\/\d+\/approve/.test(req.url())) {
        approveHits.push(req.url());
      }
    });

    await page.getByTestId(TestIds.researchApprovePlan).click();
    const modifyReq = await modifyPromise;
    const body = modifyReq.postDataJSON() as {
      plan?: { queries?: unknown[] };
    };

    expect(approveHits).toHaveLength(0);
    expect(body.plan?.queries).toHaveLength(1);
    expect((body.plan?.queries?.[0] as { query?: string })?.query).toBe(PLAN_QUERIES[0]!.query);
  });
});
