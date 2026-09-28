// Sources upload deterministic input errors (r290) — empty or no-indexable-
// content uploads MUST return 400 and leave no source row behind.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

// Stub the 'ai' module before importing the server (worker loop starts on
// import; ingest itself doesn't call the LLM).
mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { db } from '../../src/db/index.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  stubEmbedding,
} from '../helpers/integration.ts';

let app: Elysia;

const BASE = 'http://test.local';

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  app = createApp();
});

afterAll(teardownIntegrationEnv);

async function uploadFile(
  notebookId: number,
  filename: string,
  content: string,
): Promise<{ status: number; body: unknown }> {
  const fd = new FormData();
  fd.append('file', new File([content], filename, { type: 'text/plain' }));
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/upload`, {
      method: 'POST',
      body: fd,
    }),
  );
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

function makeNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

function sourceRows(notebookId: number): number {
  return db().select().from(sources).where(eq(sources.notebookId, notebookId)).all().length;
}

// covers: r290
describe('deterministic input errors create no source rows', () => {
  it('rejects an empty file with 400 and creates no source', async () => {
    const nb = makeNotebook('r290-empty');
    const { status, body } = await uploadFile(nb, 'empty.txt', '');
    expect(status).toBe(400);
    expect((body as { errorCode?: string }).errorCode).toBe('INVALID_REQUEST');
    expect(sourceRows(nb)).toBe(0);
  });

  it('rejects a whitespace-only file with 400 and rolls back the processing row', async () => {
    const nb = makeNotebook('r290-blank');
    const { status, body } = await uploadFile(nb, 'blank.txt', '   \n\t  \n');
    expect(status).toBe(400);
    expect((body as { errorCode?: string }).errorCode).toBe('INVALID_REQUEST');
    expect(sourceRows(nb)).toBe(0);
  });
});
