// Refine batch endpoint test (c29) — multi-format concurrent, shared retrieval.
//
// POST /v2/refine/batch generates all formats sharing one retrieval pass.
// With no source_ids, evidence=false and citations=[]; each format gets its
// own applyFormat on the mocked LLM output.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Mock generateText to return format-specific text (distinguishable per call).
mock.module('ai', () => ({
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked batch output' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { notebooks } from '../../src/db/schema.ts';
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

function makeNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

async function postBatch(body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/refine/batch`, {
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

describe('refine batch (c29 v1-aligned)', () => {
  it('generates all 3 formats by default (formats=null)', async () => {
    const nb = makeNotebook('batch-default');
    const { status, body } = await postBatch({
      notebook_id: nb,
      prompt: 'Summarize everything',
    });

    expect(status).toBe(200);
    const result = body as {
      outputs: Record<string, unknown>;
      citations: unknown[];
      evidence: boolean;
    };
    expect(Object.keys(result.outputs).sort()).toEqual(['bullets', 'paragraph', 'structured']);
    expect(result.evidence).toBe(false);
    expect(result.citations).toEqual([]);
  });

  it('generates only requested formats', async () => {
    const nb = makeNotebook('batch-subset');
    const { status, body } = await postBatch({
      notebook_id: nb,
      prompt: 'Summarize',
      formats: ['paragraph'],
    });

    expect(status).toBe(200);
    const result = body as { outputs: Record<string, unknown> };
    expect(Object.keys(result.outputs)).toEqual(['paragraph']);
  });

  it('shares citations across all formats (no source_ids → empty)', async () => {
    const nb = makeNotebook('batch-shared');
    const { body } = await postBatch({
      notebook_id: nb,
      prompt: 'test',
      formats: ['paragraph', 'bullets'],
    });
    const result = body as { citations: unknown[]; evidence: boolean };
    // No source_ids → evidence=false, citations=[]
    expect(result.evidence).toBe(false);
    expect(result.citations).toEqual([]);
  });

  it('returns 400 for unsupported format in batch', async () => {
    const nb = makeNotebook('batch-badformat');
    const { status } = await postBatch({
      notebook_id: nb,
      prompt: 'test',
      formats: ['expand'],
    });
    expect(status).toBe(400);
  });
});
