// c117 — per-source QA bare rules:
// - r274: source-scoped QA is hard-bounded by sourceId (retrieval never leaks other sources)
// - r282: per-source QA uses embed question + scoped vector search, ordered by relevance
// - r278: summary + per-source QA return 400 (not 404) for not-ready sources and verify
//         notebook ownership
//
// Uses the REAL embed strategy + sqlite-vec with a keyword-vector embedder stub, so
// scoping/relevance are asserted through actual vector search instead of mocks of the
// retrieval layer itself.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const capturedPrompts: string[] = [];

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async ({ prompt }: { prompt?: string }) => {
    if (prompt) capturedPrompts.push(prompt);
    return { text: 'mocked qa answer' };
  },
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

// Deterministic keyword vectors: dim0=alpha, dim1=beta, dim2=gamma. Cosine
// similarity between question and chunk follows shared keyword weight, so
// relevance ordering is observable through the real sqlite-vec KNN path.
function keywordVec(text: string): Float32Array {
  const v = new Float32Array(1024); // vec_chunks default dim
  if (text.includes('alpha')) v[0] = 1;
  if (text.includes('beta')) v[1] = 1;
  if (text.includes('gamma')) v[2] = 1;
  if (v.every((x) => x === 0)) v[1023] = 1; // never all-zero
  return v;
}

mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async (text: string) => keywordVec(text),
  embedBatch: async (texts: string[]) => texts.map(keywordVec),
}));

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import type { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import { createApp } from '../../src/server.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let otherNotebookId: number;
// Source A: two alpha chunks — the "weak" one has a LOWER chunkIndex so a
// fixed first-N truncation would return it first instead of relevance order.
let sourceAId: number;
let sourceBId: number; // beta-only source
let processingSourceId: number;
let foreignSourceId: number; // ready but lives in otherNotebookId

// A prior same-process file may leave EmbedStrategy.prototype stubbed
// (helpers/integration.ts stubEmbedding monkey-patches retrieve/indexSource).
// The qa gate runs `bun test --parallel` (per-file isolation) so this cannot
// happen there, but keep the file self-sufficient under plain multi-file
// `bun test`: re-import the module pristine and register an unstubbed
// instance as the registry's embed strategy.
const pristineEmbed =
  (await import('../../src/rag/embed-strategy.ts?pristine')) as typeof import('../../src/rag/embed-strategy.ts');
const embedStrategy = new pristineEmbed.EmbedStrategy();
ragRegistry.register(embedStrategy);

const A1_TEXT = 'alpha alpha alpha — strongest alpha evidence chunk';
const A2_TEXT = 'alpha mixed with beta — weaker alpha evidence chunk';
const B_TEXT = 'beta beta — evidence that lives only in the other source';

beforeAll(async () => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
  const orm = getOrm();

  notebookId = orm.insert(notebooks).values({ name: 'c117-qa-nb' }).returning().get().id;
  otherNotebookId = orm.insert(notebooks).values({ name: 'c117-qa-other-nb' }).returning().get().id;

  const insertSource = (nb: number, filename: string, status = 'ready') =>
    orm.insert(sources).values({ notebookId: nb, filename, status }).returning().get().id;
  const insertChunk = (sourceId: number, index: number, text: string) =>
    orm.insert(chunks).values({ sourceId, chunkIndex: index, text }).run();

  sourceAId = insertSource(notebookId, 'alpha.md');
  // A2 (weak) gets chunkIndex 0; A1 (strong) chunkIndex 1 — relevance must invert this.
  insertChunk(sourceAId, 0, A2_TEXT);
  insertChunk(sourceAId, 1, A1_TEXT);

  sourceBId = insertSource(notebookId, 'beta.md');
  insertChunk(sourceBId, 0, B_TEXT);

  processingSourceId = insertSource(notebookId, 'wip.md', 'processing');

  foreignSourceId = insertSource(otherNotebookId, 'foreign.md');
  insertChunk(foreignSourceId, 0, 'alpha content in the other notebook');

  // Real embed path: stubbed embedder writes real vectors into vec_chunks.
  await embedStrategy.indexSource(sourceAId, notebookId);
  await embedStrategy.indexSource(sourceBId, notebookId);
  await embedStrategy.indexSource(foreignSourceId, otherNotebookId);
});

afterAll(teardownIntegrationEnv);

async function postQa(nid: number, sid: number, question: string): Promise<Response> {
  return app.handle(
    new Request(`${BASE}/v2/notebooks/${nid}/sources/${sid}/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
  );
}

function lastQaPrompt(): string {
  const prompt = capturedPrompts.findLast((p) => p.includes('Question:'));
  expect(prompt).toBeDefined();
  return prompt ?? '';
}

describe('c117 r282: per-source QA uses relevance-ordered vector retrieval', () => {
  it('retrieves via scoped vector search and ranks by relevance, not insertion order', async () => {
    capturedPrompts.length = 0;
    const res = await postQa(notebookId, sourceAId, 'alpha');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sourceId: number; answer: string };
    expect(body.sourceId).toBe(sourceAId);

    const prompt = lastQaPrompt();
    const strongPos = prompt.indexOf(A1_TEXT);
    const weakPos = prompt.indexOf(A2_TEXT);
    // Both retrieved through the embed strategy…
    expect(strongPos).toBeGreaterThanOrEqual(0);
    expect(weakPos).toBeGreaterThanOrEqual(0);
    // …and relevance ordering beats chunk insertion order (A2 has chunkIndex 0).
    expect(strongPos).toBeLessThan(weakPos);
  });
});

describe('c117 r274: per-source QA hard-bounded by sourceId', () => {
  it('never leaks other-source chunks into the QA context, even when they rank higher', async () => {
    capturedPrompts.length = 0;
    // 'beta' is the best global match (source B), but QA is scoped to source A.
    const res = await postQa(notebookId, sourceAId, 'beta');
    expect(res.status).toBe(200);

    const prompt = lastQaPrompt();
    expect(prompt).toContain(A2_TEXT); // the in-scope alpha+beta chunk
    expect(prompt).not.toContain(B_TEXT); // out-of-scope source chunk never enters
  });

  it('falls back to the same source only when scoped retrieval has no hits', async () => {
    capturedPrompts.length = 0;
    const res = await postQa(notebookId, sourceAId, 'gamma');
    expect(res.status).toBe(200);

    const prompt = lastQaPrompt();
    // Fallback reads chunks of THIS source, never another source.
    expect(prompt).toContain(A2_TEXT);
    expect(prompt).not.toContain(B_TEXT);
  });
});

describe('c117 r278: summary/QA 400 for not-ready + notebook ownership', () => {
  it('returns 400 (not 404) for a not-ready source on summary and per-source QA', async () => {
    const sumRes = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${processingSourceId}/summary`),
    );
    expect(sumRes.status).toBe(400);
    const sumBody = (await sumRes.json()) as { errorCode: string };
    expect(sumBody.errorCode).toBe('INVALID_REQUEST');

    const qaRes = await postQa(notebookId, processingSourceId, 'anything');
    expect(qaRes.status).toBe(400);
    const qaBody = (await qaRes.json()) as { errorCode: string };
    expect(qaBody.errorCode).toBe('INVALID_REQUEST');
  });

  it('rejects sources that belong to a different notebook (ownership check)', async () => {
    const sumRes = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${foreignSourceId}/summary`),
    );
    expect(sumRes.status).toBe(404);

    const qaRes = await postQa(notebookId, foreignSourceId, 'anything');
    expect(qaRes.status).toBe(404);

    // The foreign source itself is untouched and still ready in its own notebook.
    const row = db().select().from(sources).where(eq(sources.id, foreignSourceId)).get();
    expect(row?.status).toBe('ready');
  });
});
