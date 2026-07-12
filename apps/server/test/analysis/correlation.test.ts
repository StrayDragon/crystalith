// Tests for embedding-vector relation detection (c47 — per-entry KNN, v1 parity).
//
// Integration test: uses a temp DB with a real vec_chunks index so the KNN
// path exercised is the same one RAG/research use (not a pure in-memory mock).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { rmSync } from 'node:fs';

import { createDb, type Orm } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { insertChunkVector } from '../../src/db/vectors.ts';
import { detectRelations } from '../../src/features/analysis/correlation.ts';

const TMP_DB = 'data/test-analysis-correlation.db';
const DIM = 1024;

let orm: Orm;
let notebookId: number;

beforeAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
  const [nb] = orm.insert(notebooks).values({ name: 'Analysis Test' }).returning().all();
  notebookId = nb.id;
});

afterAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
});

/** Build a DIM-dim unit vector with mass concentrated at the given indices. */
function vec(...onesAt: number[]): Float32Array {
  const v = new Float32Array(DIM);
  for (const i of onesAt) v[i] = 1;
  return v;
}

/** Insert a chunk + its vector under the given source. Returns the chunk id. */
function insertChunk(sourceId: number, embedding: Float32Array, chunkIndex: number): number {
  const [chk] = orm
    .insert(chunks)
    .values({ sourceId, chunkIndex, text: `chunk ${chunkIndex}` })
    .returning()
    .all();
  insertChunkVector(orm, chk.id, notebookId, sourceId, embedding);
  return chk.id;
}

function mkSource(name: string): number {
  const [src] = orm
    .insert(sources)
    .values({ notebookId, filename: name, parserType: 'text', status: 'ready' })
    .returning()
    .all();
  return src.id;
}

describe('detectRelations (per-entry KNN, c47 v1 parity)', () => {
  it('returns empty for empty entries', async () => {
    const relations = await detectRelations([], notebookId, orm);
    expect(relations).toEqual([]);
  });

  it('returns empty for a single entry', async () => {
    const src = mkSource('solo');
    const chunkId = insertChunk(src, vec(0), 0);
    const entries = [{ chunkId, sourceId: src, vector: vec(0) }];
    const relations = await detectRelations(entries, notebookId, orm);
    expect(relations).toEqual([]);
  });

  it('detects similar pairs from high-cosine vectors', async () => {
    // Two ML-ish chunks (both mass at index 0 + 1) in different sources;
    // a third physics chunk (mass at index 100) should not match the ML pair.
    const srcA = mkSource('ml-a');
    const srcB = mkSource('ml-b');
    const srcC = mkSource('physics');
    const idA = insertChunk(srcA, vec(0, 1), 0);
    const idB = insertChunk(srcB, vec(0, 1), 0);
    const idC = insertChunk(srcC, vec(100), 0);

    const entries = [
      { chunkId: idA, sourceId: srcA, vector: vec(0, 1) },
      { chunkId: idB, sourceId: srcB, vector: vec(0, 1) },
      { chunkId: idC, sourceId: srcC, vector: vec(100) },
    ];

    const relations = await detectRelations(entries, notebookId, orm, { minScore: 0.3 });

    const mlPair = relations.find(
      (r) =>
        (r.sourceChunkId === idA && r.targetChunkId === idB) ||
        (r.sourceChunkId === idB && r.targetChunkId === idA),
    );
    expect(mlPair).toBeDefined();
    expect(mlPair!.relationType).toBe('similar');
    expect(mlPair!.score).toBeGreaterThan(0.3);
  });

  it('excludes same-source pairs', async () => {
    const src = mkSource('same');
    const idA = insertChunk(src, vec(2), 0);
    const idB = insertChunk(src, vec(2), 1);

    const entries = [
      { chunkId: idA, sourceId: src, vector: vec(2) },
      { chunkId: idB, sourceId: src, vector: vec(2) },
    ];
    const relations = await detectRelations(entries, notebookId, orm, { minScore: 0.1 });
    expect(relations).toEqual([]);
  });

  it('respects maxRelations cap', async () => {
    // 6 distinct sources all pointing the same way → many cross-source pairs.
    const entries: Array<{ chunkId: number; sourceId: number; vector: Float32Array }> = [];
    for (let i = 0; i < 6; i++) {
      const src = mkSource(`cap-${i}`);
      const id = insertChunk(src, vec(3), i);
      entries.push({ chunkId: id, sourceId: src, vector: vec(3) });
    }
    const relations = await detectRelations(entries, notebookId, orm, {
      minScore: 0.1,
      maxRelations: 3,
    });
    expect(relations.length).toBeLessThanOrEqual(3);
  });

  it('returns relations sorted by score descending', async () => {
    const srcA = mkSource('sort-a');
    const srcB = mkSource('sort-b');
    const srcC = mkSource('sort-c');
    // A,B nearly identical; A,C slightly less similar.
    const idA = insertChunk(srcA, vec(4, 5), 0);
    const idB = insertChunk(srcB, vec(4, 5), 0);
    const idC = insertChunk(srcC, vec(4, 6), 0);

    const entries = [
      { chunkId: idA, sourceId: srcA, vector: vec(4, 5) },
      { chunkId: idB, sourceId: srcB, vector: vec(4, 5) },
      { chunkId: idC, sourceId: srcC, vector: vec(4, 6) },
    ];
    const relations = await detectRelations(entries, notebookId, orm, { minScore: 0.1 });
    for (let i = 1; i < relations.length; i++) {
      expect(relations[i].score).toBeLessThanOrEqual(relations[i - 1].score);
    }
  });
});
