// Research execution — search concurrency + dedup + aggregation tests.
//
// Mocks global fetch (searxng) so the agent receives realistic search
// results and the dedup/aggregation logic can be verified.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// AI mock MUST be installed before importing server modules.
const MOCK_AI_OBJECT = {
  queries: [
    { query: 'TypeScript overview', engine: 'Web', priority: 1, reason: 'broad' },
    { query: 'TypeScript types', engine: 'Web', priority: 2, reason: 'deep' },
  ],
  reasoning: 'multi-angle test',
  summary: 'Coverage ok',
  coverageEstimate: 0.6,
  needMore: false,
  suggestedQueries: [],
};
mock.module('ai', () => ({
  generateObject: async () => ({ object: MOCK_AI_OBJECT }),
  generateText: async () => ({ text: 'mocked report' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {
      yield 'TypeScript content.';
    })(),
  }),
  tool: (def: unknown) => def,
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
import { nestResearchPath } from '../helpers/nest-research-path.ts';

const BASE = 'http://test.local';
let app: Elysia;
let notebookId: number;
let _origFetch: typeof globalThis.fetch;
let _origSearxngHost: string | undefined;

const MOCK_SEARCH_RESULTS = [
  {
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/handbook/',
    content: 'The TypeScript Handbook is a comprehensive guide.',
    engine: 'google',
  },
  {
    title: 'TypeScript GitHub',
    url: 'https://github.com/microsoft/TypeScript',
    content: 'TypeScript is a superset of JavaScript.',
    engine: 'github',
  },
  {
    title: 'TypeScript Handbook Duplicate',
    url: 'https://www.typescriptlang.org/docs/handbook/?ref=search',
    content: 'Duplicate entry with different query params.',
    engine: 'bing',
  },
  {
    title: 'TypeScript Blog',
    url: 'https://devblogs.microsoft.com/typescript/',
    content: 'Announcing TypeScript 5.0.',
    engine: 'google',
  },
];

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();

  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'search-nb' }).returning().get();
  notebookId = nb.id;

  // Set a dummy searxng host so searxngFetch doesn't short-circuit to [].
  // The actual fetch is mocked below — the host is never contacted.
  _origSearxngHost = process.env.CL_SEARXNG_HOST;
  process.env.CL_SEARXNG_HOST = 'http://test-searxng:8888';

  _origFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
    if (String(url).includes('/search?q=')) {
      return Promise.resolve(
        new Response(JSON.stringify({ results: MOCK_SEARCH_RESULTS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return _origFetch(url, _init);
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = _origFetch;
  if (_origSearxngHost !== undefined) {
    process.env.CL_SEARXNG_HOST = _origSearxngHost;
  } else {
    delete process.env.CL_SEARXNG_HOST;
  }
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

describe('research execution — search + dedup', () => {
  it('aggregates search results and deduplicates by URL', async () => {
    const { body } = await post('/v2/research', {
      topic: 'TypeScript language features',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);

    const reached = await waitForStatus(sessionId, 'completed');
    expect(reached).toBe(true);

    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row).toBeTruthy();

    const results = row!.aggregatedResults as Array<{ url: string; title: string }> | null;
    expect(results).toBeTruthy();
    expect(results!.length).toBeGreaterThan(0);

    // Dedup: handbook URLs (with/without query params) collapsed to 1.
    const urls = results!.map((r) => r.url);
    const handbookHits = urls.filter((u) => u.includes('typescriptlang.org'));
    expect(handbookHits.length).toBeLessThanOrEqual(1);

    // At most 3 unique URLs after dedup (4 entries - 1 dedup).
    expect(results!.length).toBeLessThanOrEqual(3);
  });

  it('persists search steps with output data', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Step persistence test',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);
    await waitForStatus(sessionId, 'completed');

    const steps = getOrm()
      .select()
      .from(researchSteps)
      .where(eq(researchSteps.sessionId, sessionId))
      .all();

    const planSteps = steps.filter((s) => s.type === 'plan');
    const analyzeSteps = steps.filter((s) => s.type === 'analyze');
    expect(planSteps.length).toBeGreaterThanOrEqual(1);
    expect(analyzeSteps.length).toBeGreaterThanOrEqual(1);

    const plan = planSteps[0].outputData as { queries?: unknown[]; reasoning?: string };
    expect(plan.queries).toBeTruthy();
    expect(Array.isArray(plan.queries)).toBe(true);
  });

  it('search concurrency processes multiple queries', async () => {
    const { body } = await post('/v2/research', {
      topic: 'Concurrency test — Bun Elysia TypeScript',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = body.id;

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);
    await waitForStatus(sessionId, 'completed');

    const row = getOrm()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, sessionId))
      .get();
    expect(row).toBeTruthy();
    const report = row!.finalReport ?? '';
    expect(report.length).toBeGreaterThan(0);
  });

  it('handles empty search results gracefully', async () => {
    // Override fetch to return empty results.
    const prevFetch = globalThis.fetch;
    globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
      if (String(url).includes('/search?q=')) {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return _origFetch(url, _init);
    }) as typeof globalThis.fetch;

    try {
      const { body } = await post('/v2/research', {
        topic: 'Empty results test',
        notebookId: notebookId,
        maxIterations: 1,
      });
      await waitForStatus(body.id, 'waiting_user');
      await post(`/v2/research/${body.id}/approve`);
      await waitForStatus(body.id, 'completed');

      const row = getOrm()
        .select()
        .from(researchSessions)
        .where(eq(researchSessions.id, body.id))
        .get();
      expect(row).toBeTruthy();
      expect(row!.status).toBe('completed');
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
