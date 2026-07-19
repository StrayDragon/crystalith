// Refine single-format via task queue — v1-aligned shape (c29).
//
// POST /v2/refine now takes { notebook_id, prompt, format, source_ids } and
// returns { format, paragraph?, citations, evidence, created_at }. This test
// verifies the task-queue path produces the v1 response shape with AI mocked.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const REFINE_PARAGRAPH = 'This is a summarized paragraph.';

// Mock 'ai' so handleRefine's generateText returns deterministic text.
mock.module('ai', () => ({
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: REFINE_PARAGRAPH }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { notebooks, tasks } from '../../src/db/schema.ts';
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

function makeNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

describe('refine single-format via task queue (c29 v1-aligned)', () => {
  it('returns v1 response shape (evidence=false, no source_ids)', async () => {
    const nb = makeNotebook('refine-single');
    const { status, body } = await postRefine({
      notebookId: nb,
      prompt: 'Summarize the topic',
      format: 'paragraph',
    });

    expect(status).toBe(200);
    const result = body as {
      format: string;
      paragraph: string;
      citations: unknown[];
      evidence: boolean;
    };
    expect(result.format).toBe('paragraph');
    expect(result.paragraph).toBe(REFINE_PARAGRAPH);
    expect(result.citations).toEqual([]);
    expect(result.evidence).toBe(false);
  });

  it('persists a completed task row', async () => {
    const nb = makeNotebook('refine-taskrow');
    await postRefine({ notebookId: nb, prompt: 'test', format: 'bullets' });

    const rows = getOrm().select().from(tasks).all();
    const last = rows.at(-1)!;
    expect(last.type).toBe('refine');
    expect(last.status).toBe('completed');
  });

  it('returns 422 for unsupported format', async () => {
    const nb = makeNotebook('refine-badformat');
    const { status, body } = await postRefine({
      notebookId: nb,
      prompt: 'test',
      format: 'expand',
    });
    // Shared RefineRequestSchema rejects unknown format before handler.
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/format|validation/i);
  });

  it('returns 404 when notebook does not exist', async () => {
    const { status } = await postRefine({
      notebookId: 99999,
      prompt: 'test',
      format: 'paragraph',
    });
    expect(status).toBe(404);
  });
});
