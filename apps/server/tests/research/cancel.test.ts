// Research cancel — AbortSignal true interruption test.
//
// Verifies that cancelling a research session via POST /cancel genuinely
// aborts the agent loop and transitions status to 'cancelled'.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// AI mock MUST be installed before importing server modules.
const MOCK_AI_OBJECT = {
  queries: [{ query: 'cancel test', engine: 'Web', priority: 1, reason: 'test' }],
  reasoning: 'cancel test',
  summary: 'Cancel summary',
  coverageEstimate: 0.3,
  needMore: true, // would loop but we cancel
  suggestedQueries: ['q2'],
};
mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateText: async ({ output }: { output?: unknown }) =>
    output ? { output: MOCK_AI_OBJECT } : { text: 'cancel report' },
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {
      yield 'cancel content.';
    })(),
  }),
  tool: (def: unknown) => def,
}));

import { eq } from 'drizzle-orm';
import type { Elysia } from 'elysia';

import { notebooks, researchSessions } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  seedChatModel,
} from '../helpers/integration.ts';
import { nestResearchPath } from '../helpers/nest-research-path.ts';

const BASE = 'http://test.local';
let app: Elysia;
let notebookId: number;
let _origFetch: typeof globalThis.fetch;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();

  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'cancel-nb' }).returning().get();
  notebookId = nb.id;

  _origFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
    if (String(url).includes('/search?q=')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [{ title: 'R', url: 'https://x.com/r', content: 'C', engine: 'google' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
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

function withNotebookScope(path: string): string {
  return nestResearchPath(path, notebookId);
}

async function post(path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await app.handle(
    new Request(`${BASE}${withNotebookScope(path)}`, {
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

describe('research cancel', () => {
  it('cancel during waiting_user transitions to cancelled', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Cancel during waiting',
      notebookId: notebookId,
      maxIterations: 3,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');

    const cancelRes = await post(`/v2/research/${sessionId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');

    const row = getOrm()
      .select({ status: researchSessions.status })
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row?.status).toBe('cancelled');
  });

  it('cancel before approval prevents completion', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Cancel before approve',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/cancel`);

    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row?.status).toBe('cancelled');
    expect(row!.finalReport).toBeNull();
  });

  it('cancel returns 404 for nonexistent session', async () => {
    const res = await post('/v2/research/99999/cancel');
    expect(res.status).toBe(404);
  });

  it('cancel on a multi-iteration session stops early', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Multi-iteration early stop',
      notebookId: notebookId,
      maxIterations: 5,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);

    // Give agent a moment to start searching, then cancel.
    await new Promise((r) => setTimeout(r, 300));
    await post(`/v2/research/${sessionId}/cancel`);

    const reachedCancelled = await waitForStatus(sessionId, 'cancelled');
    expect(reachedCancelled).toBe(true);

    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row!.currentIteration).toBeLessThan(5);
  });

  it('idempotent cancel on already cancelled session', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Double cancel',
      notebookId: notebookId,
      maxIterations: 1,
    });
    await waitForStatus(body.id, 'waiting_user');

    await post(`/v2/research/${body.id}/cancel`);

    const secondCancel = await post(`/v2/research/${body.id}/cancel`);
    expect(secondCancel.status).toBe(200);

    const row = getOrm()
      .select({ status: researchSessions.status })
      .from(researchSessions)
      .where(eq(researchSessions.id, body.id))
      .get();
    expect(row?.status).toBe('cancelled');
  });
});
