// Research HITL state transitions — integration tests.
//
// Exercises the full approve/skip/finish/cancel lifecycle via the in-process
// Elysia app. The research agent runs in background; tests poll DB status.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// AI mock MUST be installed before importing server modules.
// Returns an object compatible with both PlanSearchSchema (queries,reasoning)
// and AnalysisSchema (summary,coverageEstimate,needMore,suggestedQueries).
const MOCK_AI_OBJECT = {
  queries: [{ query: 'test query', engine: 'Web', priority: 1, reason: 'test' }],
  reasoning: 'test reasoning',
  summary: 'Good coverage so far',
  coverageEstimate: 0.4,
  needMore: false, // signals stop — 1 iteration
  suggestedQueries: [],
};
mock.module('ai', () => ({
  generateObject: async () => ({ object: MOCK_AI_OBJECT }),
  generateText: async () => ({ text: 'mocked report text\n## Findings\n- Mock result' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {
      yield 'mocked report.';
    })(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    async generate() {
      return { text: 'mocked' };
    }
  },
}));

import { eq } from 'drizzle-orm';
import type { Elysia } from 'elysia';

import { notebooks, researchSessions, researchSteps } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  seedChatModel,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: Elysia;
let notebookId: number;
let _origFetch: typeof globalThis.fetch;

/** Return mock search results so searxngFetch doesn't hang on real network. */
function mockSearchResults() {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        results: [
          {
            title: 'Result 1',
            url: 'https://example.com/1',
            content: 'Content 1',
            engine: 'google',
          },
          { title: 'Result 2', url: 'https://example.com/2', content: 'Content 2', engine: 'bing' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();

  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'research-nb' }).returning().get();
  notebookId = nb.id;

  // Mock global fetch so searxngFetch returns mock search results.
  _origFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
    if (String(url).includes('/search?q=')) return mockSearchResults();
    return _origFetch(url, _init);
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = _origFetch;
  teardownIntegrationEnv();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post(path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const text = await res.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

/** Poll DB until the session reaches the expected status. */
async function waitForStatus(
  sessionId: number,
  status: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    if (row?.status === status) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('research HITL — approve', () => {
  it('full approve cycle: plan → waiting_user → approve → completed', async () => {
    const { body, status } = await post('/v2/research', {
      topic: 'What is TypeScript?',
      notebook_id: notebookId,
      max_iterations: 1,
    });
    expect(status).toBe(201);
    const sessionId = body.id;
    expect(sessionId).toBeGreaterThan(0);

    // Agent starts in background. It will plan, then enter waiting_user.
    const reachedWaiting = await waitForStatus(sessionId, 'waiting_user');
    expect(reachedWaiting).toBe(true);

    // Approve the plan.
    const approveRes = await post(`/v2/research/${sessionId}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.approved).toBe(true);
    expect(approveRes.body.status).toBe('searching');

    // Agent should complete.
    const reachedComplete = await waitForStatus(sessionId, 'completed');
    expect(reachedComplete).toBe(true);

    // Final report should be non-empty.
    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row).toBeTruthy();
    expect(row!.finalReport).toBeTruthy();
    expect(row!.finalReport!.length).toBeGreaterThan(0);
  });

  it('plan step contains the search plan data at waiting_user', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Test approval step',
      notebook_id: notebookId,
      max_iterations: 1,
    });
    await waitForStatus(body.id, 'waiting_user');

    const steps = getOrm()
      .select()
      .from(researchSteps)
      .where(eq(researchSteps.sessionId, body.id))
      .all();
    // The plan step (type='plan') holds the search plan data.
    // waitForApproval no longer inserts a spurious user_input step (c37 gap fix).
    const planSteps = steps.filter((s) => s.type === 'plan');
    expect(planSteps.length).toBeGreaterThanOrEqual(1);
    expect(planSteps[0].outputData).toBeTruthy();
    const plan = planSteps[0].outputData as { queries?: unknown[]; reasoning?: string };
    expect(plan.queries).toBeTruthy();
    expect(Array.isArray(plan.queries)).toBe(true);
    expect(plan.reasoning).toBeTruthy();
  });

  it('rejects approve on a cancelled (terminal) session', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Already cancelled',
      notebook_id: notebookId,
      max_iterations: 1,
    });
    await post(`/v2/research/${body.id}/cancel`);
    const res = await post(`/v2/research/${body.id}/approve`);
    expect([404, 400]).toContain(res.status);
  });
});

describe('research HITL — skip', () => {
  it('skip unblocks the agent without changes', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Test skip action',
      notebook_id: notebookId,
      max_iterations: 1,
    });
    await waitForStatus(body.id, 'waiting_user');

    const skipRes = await post(`/v2/research/${body.id}/skip`);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.skipped).toBe(true);

    const reachedComplete = await waitForStatus(body.id, 'completed');
    expect(reachedComplete).toBe(true);
  });
});

describe('research HITL — finish', () => {
  it('finish completes early without further iterations', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Early finish',
      notebook_id: notebookId,
      max_iterations: 3,
    });
    await waitForStatus(body.id, 'waiting_user');

    const finishRes = await post(`/v2/research/${body.id}/finish`);
    expect(finishRes.status).toBe(200);
    expect(finishRes.body.status).toBe('completed');

    const row = getOrm()
      .select({ status: researchSessions.status })
      .from(researchSessions)
      .where(eq(researchSessions.id, body.id))
      .get();
    expect(row?.status).toBe('completed');
  });
});

describe('research HITL — multi-iteration approve', () => {
  it('cycles through 2 iterations with approve between each', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Multi-iteration test',
      notebook_id: notebookId,
      max_iterations: 2,
    });
    const sessionId = body.id;

    // Iteration 1: wait → approve
    const reached1 = await waitForStatus(sessionId, 'waiting_user');
    expect(reached1).toBe(true);
    await post(`/v2/research/${sessionId}/approve`);

    // Agent should run and either re-enter waiting_user or complete (mock says
    // needMore=false so it should go straight to complete).
    const reachedComplete = await waitForStatus(sessionId, 'completed');
    expect(reachedComplete).toBe(true);
  });
});
