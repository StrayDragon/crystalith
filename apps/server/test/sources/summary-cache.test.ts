// c74 — source summary cache: GET side-effect free, POST persists metadata.autoSummary
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let generateTextCalls = 0;

mock.module('ai', () => ({
  generateText: async () => {
    generateTextCalls += 1;
    return {
      text: '摘要：缓存摘要正文\n要点：\n- 要点甲\n- 要点乙\n- 要点丙\n- 要点丁\n主题：主题一、主题二、主题三',
    };
  },
  generateObject: async () => ({ object: {} }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

mock.module('../../src/rag/embedder.ts', () => ({
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'c74-summary-nb' }).returning().get().id;
  sourceId = orm
    .insert(sources)
    .values({ notebookId, filename: 'doc.md', status: 'ready', metadata: { parser: 'text' } })
    .returning()
    .get().id;
  orm
    .insert(chunks)
    .values({
      sourceId,
      chunkIndex: 0,
      text: 'Hello world summary fixture content',
    })
    .run();
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('c74 source summary cache', () => {
  it('GET without cache returns empty state and does not call LLM', async () => {
    generateTextCalls = 0;
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sourceId}/summary`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      summary: string;
      keyPoints: string[];
      topics: string[];
      generatedAt: string | null;
      wordCount: number;
    };
    expect(body.summary).toBe('');
    expect(body.keyPoints).toEqual([]);
    expect(body.topics).toEqual([]);
    expect(body.generatedAt).toBeNull();
    expect(body.wordCount).toBeGreaterThan(0);
    expect(generateTextCalls).toBe(0);
  });

  it('POST generates, persists autoSummary, and subsequent GET hits cache', async () => {
    generateTextCalls = 0;
    const postRes = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sourceId}/summary`, {
        method: 'POST',
      }),
    );
    expect(postRes.status).toBe(200);
    const posted = (await postRes.json()) as {
      summary: string;
      keyPoints: string[];
      topics: string[];
      generatedAt: string | null;
    };
    expect(posted.summary).toBe('缓存摘要正文');
    expect(posted.keyPoints).toEqual(['要点甲', '要点乙', '要点丙', '要点丁']);
    expect(posted.topics).toEqual(['主题一', '主题二', '主题三']);
    expect(posted.generatedAt).toBeTruthy();
    expect(generateTextCalls).toBe(1);

    const all = getOrm().select().from(sources).all();
    const src = all.find((s) => s.id === sourceId);
    expect(src?.metadata).toMatchObject({
      parser: 'text',
      autoSummary: {
        summary: '缓存摘要正文',
      },
    });

    generateTextCalls = 0;
    const getRes = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sourceId}/summary`),
    );
    expect(getRes.status).toBe(200);
    const cached = (await getRes.json()) as { summary: string; generatedAt: string | null };
    expect(cached.summary).toBe('缓存摘要正文');
    expect(cached.generatedAt).toBe(posted.generatedAt);
    expect(generateTextCalls).toBe(0);
  });
});
