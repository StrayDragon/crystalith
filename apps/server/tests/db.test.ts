// Integration test: schema migration + sqlite-vec virtual table + vector CRUD.
//
// Uses a temp DB file under data/ so it never touches the real crystalith.db.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { rmSync } from 'node:fs';

import { eq, sql } from 'drizzle-orm';

import { createDb, type Orm } from '../src/db/index.ts';
import { chunks, notebooks, sources } from '../src/db/schema.ts';
import {
  countVectors,
  deleteChunkVector,
  initVecChunks,
  insertChunkVector,
  searchVectors,
} from '../src/db/vectors.ts';

const TMP_DB = 'data/test-vector.db';

let orm: Orm;

beforeAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
});

afterAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
});

describe('db: schema migration', () => {
  it('creates all relational tables incl. strategy_configs + vec_chunks', () => {
    const rows = orm.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const names = rows.map((r) => r.name);
    for (const expected of ['notebooks', 'chunks', 'strategy_configs', 'vec_chunks']) {
      expect(names).toContain(expected);
    }
    // 16 relational tables + vec_chunks + __drizzle_migrations
    expect(names.length).toBeGreaterThanOrEqual(18);
  });
});

describe('db: sqlite-vec virtual table', () => {
  it('inserts a notebook → source → chunk → vector and runs KNN search', () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Test Notebook' }).returning().all();
    const notebookId = nb.id;

    const [src] = orm
      .insert(sources)
      .values({
        notebookId,
        filename: 'test.txt',
        parserType: 'text',
        status: 'ready',
      })
      .returning()
      .all();
    const sourceId = src.id;

    const [chk] = orm
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: 0,
        text: 'Crystalith is a RAG-powered knowledge notebook.',
      })
      .returning()
      .all();
    const chunkId = chk.id;

    // 1024-dim vector (default embedding dimension): one-hot at index 0.
    const vec = new Float32Array(1024);
    vec[0] = 1.0;
    insertChunkVector(orm, chunkId, notebookId, sourceId, vec);

    expect(countVectors(orm, notebookId)).toBe(1);

    // Second chunk with a different (orthogonal-ish) vector.
    const [chk2] = orm
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: 1,
        text: 'Another chunk about embeddings.',
      })
      .returning()
      .all();
    const vec2 = new Float32Array(1024);
    vec2[1] = 1.0;
    insertChunkVector(orm, chk2.id, notebookId, sourceId, vec2);

    // KNN: query vector close to `vec` → chunkId should rank first.
    const query = new Float32Array(1024);
    query[0] = 1.0;
    const hits = searchVectors(orm, query, notebookId, 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].rowid).toBe(chunkId);
    expect(hits[0].text).toContain('Crystalith');
    expect(hits[0].distance).toBeLessThan(hits[1].distance);

    // Cleanup: delete vector then verify the chunk row survives.
    deleteChunkVector(orm, chunkId);
    expect(countVectors(orm, notebookId)).toBe(1);

    const [row] = orm.select().from(chunks).where(eq(chunks.id, chunkId)).all();
    expect(row).toBeDefined();
    expect(row.text).toContain('Crystalith');
  });

  it('sourceIds filter finds a small source even when others dominate KNN', () => {
    // Populate many vectors for source A so notebook-wide top-K would miss source B
    // under the old over-fetch+post-filter approach.
    const [nb] = orm.insert(notebooks).values({ name: 'Filter NB' }).returning().all();
    const notebookId = nb.id;
    const [srcA] = orm
      .insert(sources)
      .values({ notebookId, filename: 'big.txt', status: 'ready' })
      .returning()
      .all();
    const [srcB] = orm
      .insert(sources)
      .values({ notebookId, filename: 'small.txt', status: 'ready' })
      .returning()
      .all();

    for (let i = 0; i < 20; i++) {
      const [chk] = orm
        .insert(chunks)
        .values({ sourceId: srcA.id, chunkIndex: i, text: `big chunk ${i}` })
        .returning()
        .all();
      const vec = new Float32Array(1024);
      vec[0] = 1.0;
      insertChunkVector(orm, chk.id, notebookId, srcA.id, vec);
    }

    const [smallChk] = orm
      .insert(chunks)
      .values({ sourceId: srcB.id, chunkIndex: 0, text: 'needle in small source' })
      .returning()
      .all();
    const smallVec = new Float32Array(1024);
    smallVec[1] = 1.0; // orthogonal to source A → ranks last notebook-wide
    insertChunkVector(orm, smallChk.id, notebookId, srcB.id, smallVec);

    const query = new Float32Array(1024);
    query[0] = 1.0; // closer to source A

    // Notebook-wide: source B should not appear in tiny top-K
    const unscoped = searchVectors(orm, query, notebookId, 5);
    expect(unscoped.every((h) => h.source_id === srcA.id)).toBe(true);

    // Scoped to B: must still return the needle via partition equality
    const scoped = searchVectors(orm, query, notebookId, 5, [srcB.id]);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].rowid).toBe(smallChk.id);
    expect(scoped[0].text).toContain('needle');
  });

  it('ranks by cosine, not L2 — normalized-vector regression', async () => {
    // B points in the query direction but is LONGER ([1.5, 0, …]); C is a
    // shorter 0.9-cosine neighbor. L2 ranks C first (0.447 < 0.5) while
    // cosine ranks B first (0 < 0.1) — guards the distance_metric=cosine
    // declaration (default L2 mis-converts to `score = 1 - distance` and
    // pushed real bge-m3 hits below the evidence threshold).
    const [nb] = orm.insert(notebooks).values({ name: 'Cosine NB' }).returning().all();
    const notebookId = nb.id;
    const [src] = orm
      .insert(sources)
      .values({ notebookId, filename: 'cos.txt', status: 'ready' })
      .returning()
      .all();

    const mk = (dims: [number, number]) => {
      const v = new Float32Array(1024);
      v[0] = dims[0];
      v[1] = dims[1];
      return v;
    };

    let nextChunkIndex = 0;
    const insert = async (text: string, vec: Float32Array) => {
      const [chk] = orm
        .insert(chunks)
        .values({ sourceId: src.id, chunkIndex: nextChunkIndex++, text })
        .returning()
        .all();
      insertChunkVector(orm, chk.id, notebookId, src.id, vec);
      return chk.id;
    };
    const bId = await insert('same direction, longer', mk([1.5, 0]));
    const cId = await insert('0.9 cosine neighbor', mk([0.9, Math.sqrt(1 - 0.81)]));

    const hits = searchVectors(orm, mk([1, 0]), notebookId, 2);
    expect(hits.map((h) => h.rowid)).toEqual([bId, cId]);
    // cosine distance ≈ 1 − cos similarity
    expect(hits[0].distance).toBeCloseTo(0, 3);
    expect(hits[1].distance).toBeCloseTo(0.1, 3);
  });

  it('initVecChunks rebuilds a legacy L2 table in place (cosine migration)', () => {
    // Simulate a pre-cosine DB: create the old declaration, insert a vector,
    // then run initVecChunks — the table must come back with cosine semantics
    // and all rows preserved (no re-embed required).
    orm.run(sql`DROP TABLE vec_chunks`);
    orm.run(
      sql.raw(`CREATE VIRTUAL TABLE vec_chunks USING vec0(
        embedding float[1024],
        notebook_id integer partition by,
        source_id integer partition by
      );`),
    );
    const [nb] = orm.insert(notebooks).values({ name: 'Legacy NB' }).returning().all();
    const notebookId = nb.id;
    const [src] = orm
      .insert(sources)
      .values({ notebookId, filename: 'legacy.txt', status: 'ready' })
      .returning()
      .all();
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'legacy vector' })
      .returning()
      .all();
    const v0 = new Float32Array(1024);
    v0[0] = 1;
    insertChunkVector(orm, chk.id, notebookId, src.id, v0);

    initVecChunks(orm);

    const ddl = orm.all<{ sql: string }>(
      sql`SELECT sql FROM sqlite_master WHERE name='vec_chunks'`,
    )[0].sql;
    expect(ddl).toContain('distance_metric=cosine');
    expect(countVectors(orm, notebookId)).toBe(1);

    // Identical query vector → cosine distance ≈ 0 (L2 would also give 0, so
    // also assert the orthogonal case: distance must be exactly 1, not √1).
    const ortho = new Float32Array(1024);
    ortho[1] = 1;
    const [hit] = searchVectors(orm, ortho, notebookId, 1);
    expect(hit.distance).toBeCloseTo(1, 5);
  });
});
