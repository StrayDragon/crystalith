// Research SSE streaming — event dispatch + terminal event detection.
//
// Connects to the /v2/research/:id/stream SSE endpoint and verifies the
// expected event types are emitted, including the terminal 'done' event.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// AI mock MUST be installed before importing server modules.
const MOCK_AI_OBJECT = {
  queries: [{ query: 'SSE test', engine: 'Web', priority: 1, reason: 'test' }],
  reasoning: 'SSE test',
  summary: 'SSE test summary',
  coverageEstimate: 0.7,
  needMore: false,
  suggestedQueries: [],
};
mock.module('ai', () => ({
  generateObject: async () => ({ object: MOCK_AI_OBJECT }),
  generateText: async () => ({ text: 'SSE report' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {
      yield 'streamed content.';
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

const BASE = 'http://test.local';
let app: Elysia;
let notebookId: number;
let _origFetch: typeof globalThis.fetch;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();

  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'sse-nb' }).returning().get();
  notebookId = nb.id;

  _origFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
    if (String(url).includes('/search?q=')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [{ title: 'R1', url: 'https://ex.com/1', content: 'C1', engine: 'google' }],
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
  // Create session: notebookId is in body, not query
  if (path === '/v2/research' || path.startsWith('/v2/research?')) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}notebookId=${notebookId}`;
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

/** Read SSE events from a ReadableStream until the 'done' event or timeout. */
async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  timeoutMs = 20_000,
): Promise<Array<{ type: string; [key: string]: unknown }>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const lines = frame.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            events.push(parsed);
            if (parsed.type === 'done') {
              reader.cancel();
              return events;
            }
          } catch {
            // Skip malformed frames.
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  reader.cancel();
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('research SSE stream', () => {
  it('emits approval_request and done events during a full cycle', async () => {
    const { body: startRes } = await post('/v2/research', {
      topic: 'SSE event test',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = startRes.id;

    // Connect to SSE before approval.
    const sseRes = await app.handle(
      new Request(`${BASE}/v2/research/${sessionId}/stream?notebookId=${notebookId}`),
    );
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');

    const eventsPromise = readSseStream(sseRes.body!);

    // Give agent a moment, then approve.
    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);
    await waitForStatus(sessionId, 'completed');

    const events = await eventsPromise;
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_ready');
    expect(eventTypes).toContain('approval_request');
    expect(eventTypes).toContain('done');

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.status).toBe('completed');
  });

  it('emits done event with cancelled status when cancelled', async () => {
    const { body: startRes } = await post('/v2/research', {
      topic: 'SSE cancel test',
      notebookId: notebookId,
      maxIterations: 3,
    });
    const sessionId = startRes.id;

    const sseRes = await app.handle(
      new Request(`${BASE}/v2/research/${sessionId}/stream?notebookId=${notebookId}`),
    );
    expect(sseRes.status).toBe(200);

    const eventsPromise = readSseStream(sseRes.body!);

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/cancel`);

    const events = await eventsPromise;
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.status).toBe('cancelled');
  });

  it('plan_ready contains the search plan data', async () => {
    const { body: startRes } = await post('/v2/research', {
      topic: 'Plan data in SSE',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = startRes.id;

    const sseRes = await app.handle(
      new Request(`${BASE}/v2/research/${sessionId}/stream?notebookId=${notebookId}`),
    );
    const eventsPromise = readSseStream(sseRes.body!);

    await waitForStatus(sessionId, 'waiting_user');
    await post(`/v2/research/${sessionId}/approve`);
    await waitForStatus(sessionId, 'completed');

    const events = await eventsPromise;
    // The plan data is in the plan_ready event (from the plan step).
    // The approval_request event (from the user_input step) carries the action.
    const planEvent = events.find((e) => e.type === 'plan_ready');
    expect(planEvent).toBeTruthy();

    const data = planEvent!.data as { queries?: unknown[]; reasoning?: string } | undefined;
    expect(data).toBeTruthy();
    expect(data!.queries).toBeTruthy();
    expect(Array.isArray(data!.queries)).toBe(true);
  });

  it('emits status events on transitions and rich thinking messages', async () => {
    const { body: startRes } = await post('/v2/research', {
      topic: 'SSE status+thinking',
      notebookId: notebookId,
      maxIterations: 1,
    });
    const sessionId = startRes.id;

    const sseRes = await app.handle(
      new Request(`${BASE}/v2/research/${sessionId}/stream?notebookId=${notebookId}`),
    );
    expect(sseRes.status).toBe(200);
    const eventsPromise = readSseStream(sseRes.body!);

    await waitForStatus(sessionId, 'waiting_user');
    // Hold at waiting_user long enough for the SSE poll (250ms) to observe it
    // before approve races past searching → completed.
    await Bun.sleep(400);
    await post(`/v2/research/${sessionId}/approve`);
    await waitForStatus(sessionId, 'completed');

    const events = await eventsPromise;
    const statusEvents = events.filter((e) => e.type === 'status');
    expect(statusEvents.length).toBeGreaterThan(0);
    const statuses = statusEvents.map((e) => e.status as string);
    expect(statuses).toContain('waiting_user');
    // searching/analyzing may be skipped if they complete within one poll tick;
    // completed must always appear as the terminal transition before done.
    expect(statuses).toContain('completed');
    for (const ev of statusEvents) {
      expect(typeof ev.message).toBe('string');
      expect(String(ev.message).length).toBeGreaterThan(0);
    }

    const thinking = events.filter((e) => e.type === 'thinking');
    // May be empty if all steps map to named events; when present must carry message.
    for (const ev of thinking) {
      expect(typeof ev.message).toBe('string');
      expect(String(ev.message).length).toBeGreaterThan(0);
    }
  });

  it('returns 404 for nonexistent session', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/research/99999/stream?notebookId=${notebookId}`),
    );
    expect(res.status).toBe(404);
  });
});
