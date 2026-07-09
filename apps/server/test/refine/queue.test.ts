// Refine-via-task-queue integration test.
//
// Drives the full path: POST /v2/refine → TaskQueue.enqueue → module-level
// worker dispatch → runTask → handleRefine → generateText (mocked) → result
// persisted to tasks row → waitForCompletion unblocks → HTTP response.
//
// The worker loop is started once when server.ts is imported (module scope)
// and re-reads the task row via db() on each dispatch, so it picks up the
// reset temp DB correctly.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const REFINE_RESULT = 'refined: a concise summary';

// Mock the 'ai' module so handleRefine's generateText returns deterministic
// text. Must run before importing the server.
mock.module('ai', () => ({
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: REFINE_RESULT }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { tasks } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  seedChatModel,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: Elysia;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
});

afterAll(() => {
  teardownIntegrationEnv();
});

async function postRefine(body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/refine`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

describe('refine via task queue', () => {
  it('returns the refined text from the (mocked) LLM', async () => {
    const { status, body } = await postRefine({ text: 'some long input text', mode: 'summarize' });
    expect(status).toBe(200);
    const result = body as {
      mode: string;
      text: string;
      original_length: number;
      refined_length: number;
    };
    expect(result.mode).toBe('summarize');
    expect(result.text).toBe(REFINE_RESULT);
    expect(result.original_length).toBeGreaterThan(0);
    expect(result.refined_length).toBe(REFINE_RESULT.length);
  });

  it('persists a completed task row with progress=100', async () => {
    await postRefine({ text: 'input for task-row check', mode: 'rewrite' });

    const rows = getOrm().select().from(tasks).all();
    expect(rows.length).toBeGreaterThan(0);
    // The most recent task should be completed.
    const last = rows.at(-1)!;
    expect(last.type).toBe('refine');
    expect(last.status).toBe('completed');
    expect(last.progress).toBe(100);

    const result = last.result as { text: string; mode: string } | null;
    expect(result?.text).toBe(REFINE_RESULT);
    expect(result?.mode).toBe('rewrite');
  });

  it('defaults to rewrite mode when mode is omitted', async () => {
    const { body } = await postRefine({ text: 'no mode specified' });
    expect((body as { mode: string }).mode).toBe('rewrite');
  });

  it('returns 404 when no text is provided', async () => {
    const { status } = await postRefine({ mode: 'expand' });
    // NotFoundError → Elysia maps to 404.
    expect(status).toBe(404);
  });
});
