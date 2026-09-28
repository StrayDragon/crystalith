// c117 — source ingestion management bare rules:
// - r262: source list query semantics are stable (exact tag filter + stable
//   sort over date/name/size/type with asc/desc)
// - r264: chunks endpoint returns deterministic chunk_index-ascending order
// - r265: delete and re-embed keep storage and epochs consistent (vector rows
//   removed/recomputed, retrieval cache invalidated via epoch bumps)
//
// Chunks/vectors are seeded directly (deterministic embedder mock) so the
// storage assertions observe the real vec_chunks table instead of mocks.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const embedCalls: string[][] = [];

function keywordVec(text: string): Float32Array {
  const v = new Float32Array(1024); // vec_chunks default dim
  if (text.includes('alpha')) v[0] = 1;
  if (text.includes('beta')) v[1] = 1;
  if (v.every((x) => x === 0)) v[1023] = 1; // never all-zero
  return v;
}

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

mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async (text: string) => keywordVec(text),
  embedBatch: async (texts: string[]) => {
    embedCalls.push([...texts]);
    return texts.map(keywordVec);
  },
}));

import { eq, sql } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { getCached, setCached } from '../../src/rag/cache.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
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

// Three sources with distinct names / types / chunk counts / updatedAt so every
// sort key has a strict, assertable total order.
let srcAlphaId: number; // parser 'text', 2 chunks
let srcBetaId: number; // parser 'csv', 1 chunk
let srcGammaId: number; // parser 'text', 3 chunks
let r265SourceId: number; // delete + re-embed target
let foreignSourceId: number;

const vecCount = (sourceId: number): number =>
  db().all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM vec_chunks WHERE source_id = ${sourceId}`,
  )[0]?.n ?? 0;

beforeAll(async () => {
  setupIntegrationEnv();
  seedChatModel();
  app = createApp();
  const orm = getOrm();

  notebookId = orm.insert(notebooks).values({ name: 'c117-mgmt-nb' }).returning().get().id;
  otherNotebookId = orm.insert(notebooks).values({ name: 'c117-mgmt-other' }).returning().get().id;

  const insertSource = (nb: number, filename: string, parserType: string, status = 'ready') =>
    orm.insert(sources).values({ notebookId: nb, filename, parserType, status }).returning().get();
  const insertChunk = (sourceId: number, index: number, text: string) =>
    orm.insert(chunks).values({ sourceId, chunkIndex: index, text }).run();

  // Insertion order deliberately differs from every sort order below.
  srcBetaId = insertSource(notebookId, 'beta-table.csv', 'csv').id;
  insertChunk(srcBetaId, 0, 'beta csv row');
  srcAlphaId = insertSource(notebookId, 'alpha.md', 'text').id;
  insertChunk(srcAlphaId, 0, 'alpha one');
  insertChunk(srcAlphaId, 1, 'alpha two');
  srcGammaId = insertSource(notebookId, 'gamma.md', 'text').id;
  insertChunk(srcGammaId, 0, 'gamma one');
  insertChunk(srcGammaId, 1, 'gamma two');
  insertChunk(srcGammaId, 2, 'gamma three');

  // Distinct updatedAt per source (second-precision timestamps): beta < gamma < alpha.
  orm
    .update(sources)
    .set({ updatedAt: new Date('2026-01-02T00:00:00Z') })
    .where(eq(sources.id, srcBetaId))
    .run();
  orm
    .update(sources)
    .set({ updatedAt: new Date('2026-01-03T00:00:00Z') })
    .where(eq(sources.id, srcGammaId))
    .run();
  orm
    .update(sources)
    .set({ updatedAt: new Date('2026-01-04T00:00:00Z') })
    .where(eq(sources.id, srcAlphaId))
    .run();

  // r265 targets: an indexed source (delete) and a failed source with chunks
  // but no vectors yet (re-embed).
  r265SourceId = insertSource(notebookId, 'reembed-me.md', 'text', 'failed').id;
  insertChunk(r265SourceId, 0, 'alpha r265 first chunk');
  insertChunk(r265SourceId, 1, 'beta r265 second chunk');

  foreignSourceId = insertSource(otherNotebookId, 'foreign.md', 'text').id;
  insertChunk(foreignSourceId, 0, 'foreign chunk');

  // Real embed path (mocked embedder): write actual vectors into vec_chunks.
  const strategy = new EmbedStrategy();
  await strategy.indexSource(srcAlphaId, notebookId);
  await strategy.indexSource(srcBetaId, notebookId);
  await strategy.indexSource(srcGammaId, notebookId);
});

afterAll(teardownIntegrationEnv);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SourceItemWire {
  id: number;
  filename: string;
  parserType: string;
  chunkCount: number;
  tags: string[];
}

async function listSources(query: string): Promise<SourceItemWire[]> {
  const res = await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/sources${query}`));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { items: SourceItemWire[] };
  return body.items;
}

function filenames(items: SourceItemWire[]): string[] {
  return items.map((i) => i.filename);
}

async function createTag(name: string): Promise<number> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

async function assignTag(tagId: number, sourceIds: number[]): Promise<void> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/tags/${tagId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
    }),
  );
  expect(res.status).toBe(200);
}

// ---------------------------------------------------------------------------
// r262 — list query semantics: exact tag filter + stable sort
// ---------------------------------------------------------------------------

describe('c117 r262: source list query semantics are stable', () => {
  it('filters exactly by tag name and does not match similarly named tags', async () => {
    const coreTag = await createTag('core');
    const coreExtTag = await createTag('core-extra');
    await assignTag(coreTag, [srcAlphaId, srcGammaId]);
    await assignTag(coreExtTag, [srcBetaId]);

    const tagged = await listSources('?tag=core');
    // Exact match: only the sources tagged 'core', not the 'core-extra' source.
    expect(filenames(tagged).toSorted()).toEqual(['alpha.md', 'gamma.md']);
    for (const item of tagged) expect(item.tags).toContain('core');

    // Reverse direction: the other tag yields exactly its own source.
    const ext = await listSources('?tag=core-extra');
    expect(filenames(ext)).toEqual(['beta-table.csv']);
  });

  it('sorts stably by name asc/desc and repeats deterministically', async () => {
    const asc = await listSources('?sortBy=name&sortOrder=asc');
    expect(filenames(asc)).toEqual(['alpha.md', 'beta-table.csv', 'gamma.md', 'reembed-me.md']);

    const desc = await listSources('?sortBy=name&sortOrder=desc');
    expect(filenames(desc)).toEqual(['reembed-me.md', 'gamma.md', 'beta-table.csv', 'alpha.md']);

    // Stability: the same query returns the same order twice.
    const again = await listSources('?sortBy=name&sortOrder=asc');
    expect(filenames(again)).toEqual(filenames(asc));
  });

  it('sorts by size (chunk count), type (parser) and date (updatedAt)', async () => {
    // size: beta=1, alpha=2, reembed=2, gamma=3 chunks (stable ties).
    const sizeAsc = await listSources('?sortBy=size&sortOrder=asc');
    expect(filenames(sizeAsc)).toEqual(['beta-table.csv', 'alpha.md', 'reembed-me.md', 'gamma.md']);
    const sizeDesc = await listSources('?sortBy=size&sortOrder=desc');
    expect(filenames(sizeDesc)).toEqual([
      'gamma.md',
      'alpha.md',
      'reembed-me.md',
      'beta-table.csv',
    ]);

    // type: csv < text (lexicographic on parserType).
    const typeAsc = await listSources('?sortBy=type&sortOrder=asc');
    expect(filenames(typeAsc)[0]).toBe('beta-table.csv');
    expect(filenames(typeAsc).slice(1).toSorted()).toEqual([
      'alpha.md',
      'gamma.md',
      'reembed-me.md',
    ]);

    // date: seeded updatedAt beta(01-02) < gamma(01-03) < alpha(01-04);
    // reembed-me keeps its insertion-time stamp (today, 2026-09) → newest.
    const dateAsc = await listSources('?sortBy=date&sortOrder=asc');
    expect(filenames(dateAsc)).toEqual(['beta-table.csv', 'gamma.md', 'alpha.md', 'reembed-me.md']);
    const dateDesc = await listSources('?sortBy=date&sortOrder=desc');
    expect(filenames(dateDesc)).toEqual([
      'reembed-me.md',
      'alpha.md',
      'gamma.md',
      'beta-table.csv',
    ]);
  });
});

// ---------------------------------------------------------------------------
// r264 — chunks endpoint deterministic order
// ---------------------------------------------------------------------------

describe('c117 r264: chunks endpoint returns deterministic order', () => {
  it('returns chunks by chunk_index ascending regardless of insertion order', async () => {
    // srcGamma chunks were inserted 0,1,2; seed an out-of-order source to prove
    // the endpoint (not the insertion) defines the order.
    const orm = getOrm();
    const shuffled = orm
      .insert(sources)
      .values({ notebookId, filename: 'shuffled.md', parserType: 'text' })
      .returning()
      .get().id;
    orm.insert(chunks).values({ sourceId: shuffled, chunkIndex: 2, text: 'c-two' }).run();
    orm.insert(chunks).values({ sourceId: shuffled, chunkIndex: 0, text: 'c-zero' }).run();
    orm.insert(chunks).values({ sourceId: shuffled, chunkIndex: 1, text: 'c-one' }).run();

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${shuffled}/chunks`),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ chunkIndex: number; text: string }>;
    expect(rows.map((r) => r.chunkIndex)).toEqual([0, 1, 2]);
    expect(rows.map((r) => r.text)).toEqual(['c-zero', 'c-one', 'c-two']);

    // Deterministic: a second read returns the identical order.
    const res2 = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${shuffled}/chunks`),
    );
    expect(
      ((await res2.json()) as unknown[]).map((r) => (r as { chunkIndex: number }).chunkIndex),
    ).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// r265 — delete and re-embed keep storage and epochs consistent
// ---------------------------------------------------------------------------

describe('c117 r265: delete and re-embed keep storage and epochs consistent', () => {
  it('delete removes the DB row, its vectors, and invalidates the retrieval cache', async () => {
    // Fresh source with real vector rows.
    const orm = getOrm();
    const doomed = orm
      .insert(sources)
      .values({ notebookId, filename: 'doomed.md', parserType: 'text' })
      .returning()
      .get().id;
    orm.insert(chunks).values({ sourceId: doomed, chunkIndex: 0, text: 'alpha doomed' }).run();
    const strategy = new EmbedStrategy();
    await strategy.indexSource(doomed, notebookId);
    expect(vecCount(doomed)).toBe(1);

    // Cache entry written under the current epoch.
    const params = 'k:5:0.1:false:src=';
    setCached(notebookId, 'doomed-query', params, [
      { chunkId: doomed, text: 'alpha doomed', score: 1, sourceId: doomed, chunkIndex: 0 },
    ]);
    expect(getCached(notebookId, 'doomed-query', params)).toBeDefined();

    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${doomed}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(204);

    // DB record and vector store record are gone together (no ghost retrieval).
    expect(orm.select().from(sources).where(eq(sources.id, doomed)).get()).toBeUndefined();
    expect(vecCount(doomed)).toBe(0);
    // sources_epoch bump invalidated the pre-delete cached entry.
    expect(getCached(notebookId, 'doomed-query', params)).toBeUndefined();
  });

  it('re-embed recomputes vectors from the existing chunks and keeps epochs consistent', async () => {
    expect(vecCount(r265SourceId)).toBe(0); // failed source: no vectors yet
    const orm = getOrm();
    const chunksBefore = orm
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, r265SourceId))
      .orderBy(chunks.chunkIndex)
      .all();

    // Cache entry written before re-embed; the re-embed must invalidate it.
    const params = 'k:5:0.1:false:src=';
    setCached(notebookId, 'reembed-query', params, [
      { chunkId: r265SourceId, text: 'x', score: 1, sourceId: r265SourceId, chunkIndex: 0 },
    ]);

    embedCalls.length = 0;
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${r265SourceId}/re-embed`, {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sourceId: r265SourceId, reEmbedded: true });

    // Existing chunks were reused — no chunk rows added, no re-chunking.
    const chunksAfter = orm
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, r265SourceId))
      .orderBy(chunks.chunkIndex)
      .all();
    expect(chunksAfter.map((c) => ({ index: c.chunkIndex, text: c.text }))).toEqual(
      chunksBefore.map((c) => ({ index: c.chunkIndex, text: c.text })),
    );

    // Vectors recomputed for exactly those chunks.
    expect(vecCount(r265SourceId)).toBe(chunksAfter.length);
    expect(embedCalls.at(-1)).toEqual(chunksAfter.map((c) => c.text));

    // Source is ready again and the epoch bump invalidated the stale cache.
    expect(orm.select().from(sources).where(eq(sources.id, r265SourceId)).get()?.status).toBe(
      'ready',
    );
    expect(getCached(notebookId, 'reembed-query', params)).toBeUndefined();

    // Cross-notebook safety net: the foreign source is untouched.
    expect(vecCount(foreignSourceId)).toBe(0);
  });
});
