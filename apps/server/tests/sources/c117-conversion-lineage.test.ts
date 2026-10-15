// c117 — conversion bare rules:
// - r276: conversation/output → source conversions keep traceable lineage metadata
// - r277: conversion follows the source lifecycle (processing → ready only after embed)
//         and epoch invalidation rules
// - r281: conversion MUST NOT mark ready when embedding fails — source becomes failed
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

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
  ToolLoopAgent: class {
    async generate() {
      return { text: 'mocked' };
    }
  },
  isStepCount: () => ({ stopWhen: 'stepCount' }),
}));

// Success-path embedder stub; r281 tests re-mock it to throw before their requests
// (convert handlers import the embedder dynamically per request).
let embedShouldFail = false;
mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async () => new Float32Array(1024),
  embedBatch: async (texts: string[]) => {
    if (embedShouldFail) throw new Error('embedding provider down');
    return texts.map(() => new Float32Array(1024));
  },
}));

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { messages, notebooks, sessions, sources } from '../../src/db/schema.ts';
import { getCached, setCached } from '../../src/rag/cache.ts';
import { createApp } from '../../src/server.ts';
import {
  captureErrorLogs,
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sessionId: number;
let messageId: number;
let readySourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'c117-convert-nb' }).returning().get().id;
  sessionId = orm
    .insert(sessions)
    .values({ notebookId, title: 'convert session' })
    .returning()
    .get().id;
  messageId = orm
    .insert(messages)
    .values({ sessionId, role: 'user', content: 'convert me into a source' })
    .returning()
    .get().id;
  readySourceId = orm
    .insert(sources)
    .values({ notebookId, filename: 'base.md', status: 'ready' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

/**
 * Epoch probe: cache a sentinel under the CURRENT epochs; after a conversion
 * bumps sources/vector epoch, the same read misses → cache invalidated.
 */
function probeEpoch(notebookId: number): () => boolean {
  setCached(notebookId, 'c117-epoch-probe', 'probe-params', [
    { chunkId: -1, text: 'sentinel', score: 1, sourceId: -1, chunkIndex: 0 },
  ]);
  return () => getCached(notebookId, 'c117-epoch-probe', 'probe-params') === undefined;
}

async function postQaToSource(sid: number): Promise<Response> {
  return app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sid}/qa-to-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'q', answer: 'a' }),
    }),
  );
}

async function postSessionConvertToSource(): Promise<Response> {
  return app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sessions/${sessionId}/convert-to-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageIds: [messageId] }),
    }),
  );
}

describe('c117 r276: conversion keeps traceable lineage metadata', () => {
  it('session convert-to-source records convertedFromSession lineage metadata', async () => {
    const res = await postSessionConvertToSource();
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sourceId: number };
    expect(body.sourceId).toBeGreaterThan(0);

    const row = db().select().from(sources).where(eq(sources.id, body.sourceId)).get();
    expect(row?.metadata).toMatchObject({
      convertedFromSession: sessionId,
      messageCount: 1,
    });
    const meta = row?.metadata as { conversionTimestamp?: string } | undefined;
    expect(typeof meta?.conversionTimestamp).toBe('string');
  });

  it('qa-to-source records qa_from_source lineage metadata', async () => {
    const res = await postQaToSource(readySourceId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sourceId: number };

    const row = db().select().from(sources).where(eq(sources.id, body.sourceId)).get();
    expect(row?.metadata).toMatchObject({
      qa_from_source: readySourceId,
      original_filename: 'base.md',
    });
  });
});

describe('c117 r277: conversion follows lifecycle and epoch rules', () => {
  it('qa-to-source lands ready and invalidates the notebook epoch caches', async () => {
    const epochInvalidated = probeEpoch(notebookId);

    const res = await postQaToSource(readySourceId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sourceId: number; chunkCount: number };
    expect(body.chunkCount).toBeGreaterThan(0);

    // Lifecycle: the created source ended on the ready state of the state machine.
    const row = db().select().from(sources).where(eq(sources.id, body.sourceId)).get();
    expect(row?.status).toBe('ready');

    // Epoch: pre-conversion cache probes must miss after the conversion.
    expect(epochInvalidated()).toBe(true);
  });

  it('session convert-to-source lands ready and invalidates the notebook epoch caches', async () => {
    const epochInvalidated = probeEpoch(notebookId);

    const res = await postSessionConvertToSource();
    expect(res.status).toBe(201);
    const body = (await res.json()) as { sourceId: number };

    const row = db().select().from(sources).where(eq(sources.id, body.sourceId)).get();
    expect(row?.status).toBe('ready');
    expect(epochInvalidated()).toBe(true);
  });
});

describe('c117 r281: conversion does not mark ready when embedding fails', () => {
  it('qa-to-source marks the source failed when embedding throws', async () => {
    embedShouldFail = true;
    try {
      // 预期失败路径：捕获降级 error 日志并断言，不作为噪音漏到测试输出。
      // onAfterResponse 的 http 访问日志在 handle 之后异步触发，flush 一个
      // macrotask 让它也落在捕获窗口内。
      const { lines } = await captureErrorLogs(async () => {
        const res = await postQaToSource(readySourceId);
        expect(res.status).toBe(500);
        await new Promise((r) => setTimeout(r, 5));

        // The most recent qa-converted source row must be failed, never ready.
        const rows = db()
          .select()
          .from(sources)
          .where(eq(sources.notebookId, notebookId))
          .all()
          .filter((s) => (s.metadata as { qa_from_source?: number } | null)?.qa_from_source != null)
          .toSorted((a, b) => b.id - a.id);
        expect(rows[0]?.status).toBe('failed');
        expect(rows[0]?.errorMessage).toContain('embedding provider down');
      });
      expect(lines.some((l) => l.includes('qa-to-source embedding failed'))).toBe(true);
    } finally {
      embedShouldFail = false;
    }
  });

  it('session convert-to-source marks the source failed when embedding throws', async () => {
    embedShouldFail = true;
    try {
      const { lines } = await captureErrorLogs(async () => {
        const res = await postSessionConvertToSource();
        expect(res.status).toBe(500);
        await new Promise((r) => setTimeout(r, 5));

        const rows = db()
          .select()
          .from(sources)
          .where(eq(sources.notebookId, notebookId))
          .all()
          .filter(
            (s) =>
              (s.metadata as { convertedFromSession?: number } | null)?.convertedFromSession !=
              null,
          )
          .toSorted((a, b) => b.id - a.id);
        expect(rows[0]?.status).toBe('failed');
        expect(rows[0]?.errorMessage).toContain('embedding provider down');
      });
      expect(lines.some((l) => l.includes('convert embedding failed'))).toBe(true);
    } finally {
      embedShouldFail = false;
    }
  });
});
