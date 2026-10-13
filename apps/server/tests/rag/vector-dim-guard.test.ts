import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
// c130 r478 — vec_chunks dimension-mismatch behavior:
//   boot: initVecChunks warns (both values + rebuild guidance) but never blocks;
//   runtime: searchVectors / insertChunkVector throw EMBEDDING_DIM_MISMATCH;
//   keyword/BM25: unaffected (never touches vectors).
// Also the KeywordStrategy.retrieve regression (fixed snake_case columns).
import { rmSync } from 'node:fs';

import { sql } from 'drizzle-orm';

import { createDb, resetDb, type Orm } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import {
  countVectors,
  initVecChunks,
  insertChunkVector,
  searchVectors,
} from '../../src/db/vectors.ts';
import { KeywordStrategy } from '../../src/rag/keyword-strategy.ts';
import { AppHttpError, ErrorCode } from '../../src/shared/errors.ts';

const TMP_DB = 'data/test-vector-dim-guard.db';

let orm: Orm;

/**
 * Recreate vec_chunks at an exact dimension — deterministic regardless of the
 * environment's config (createDb provisions it from the default embedding
 * model's declared dims, which this file must not depend on).
 */
function recreateVecTable(dim: number): void {
  orm.run(sql`DROP TABLE IF EXISTS vec_chunks`);
  orm.run(
    sql.raw(`CREATE VIRTUAL TABLE vec_chunks USING vec0(
      embedding float[${dim}] distance_metric=cosine,
      notebook_id integer partition by,
      source_id integer partition by
    );`),
  );
}

/** Assert the promise rejects with the dim-mismatch AppHttpError (1024 vs 768). */
async function expectDimMismatch(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch (error) {
    expect(error).toBeInstanceOf(AppHttpError);
    const err = error as AppHttpError;
    expect(err.code).toBe(ErrorCode.EMBEDDING_DIM_MISMATCH);
    expect(err.message).toContain('1024');
    expect(err.message).toContain('768');
    expect(err.details).toEqual({ tableDim: 1024, vecDim: 768 });
    return;
  }
  throw new Error('expected EMBEDDING_DIM_MISMATCH but the call resolved');
}

beforeAll(() => {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
  // KeywordStrategy goes through the client() singleton — point it at this
  // file's temp DB so the BM25 regression never touches a real DB.
  resetDb(orm);
  recreateVecTable(1024);
});

afterAll(() => {
  resetDb(null);
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
});

describe('vec dim guard (r478): runtime mismatch errors', () => {
  it('searchVectors and insertChunkVector throw EMBEDDING_DIM_MISMATCH (768-dim vec vs 1024-dim table)', async () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Dim Guard NB' }).returning().all();
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'dim-guard.txt', status: 'ready' })
      .returning()
      .all();
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'dim guard chunk' })
      .returning()
      .all();

    await expectDimMismatch(insertChunkVector(orm, chk.id, nb.id, src.id, new Float32Array(768)));
    await expectDimMismatch(searchVectors(orm, new Float32Array(768), nb.id, 5));
    // sourceIds-scoped branch shares the same guard
    await expectDimMismatch(searchVectors(orm, new Float32Array(768), nb.id, 5, [src.id]));

    // Metadata query is unaffected by the mismatch — no vector was written.
    expect(await countVectors(orm, nb.id)).toBe(0);
  });

  it('matching dims (1024/1024) pass the guard and search executes normally', async () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Dim Match NB' }).returning().all();
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'dim-match.txt', status: 'ready' })
      .returning()
      .all();
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 0, text: 'matching dims chunk' })
      .returning()
      .all();

    const vec = new Float32Array(1024);
    vec[0] = 1;
    await insertChunkVector(orm, chk.id, nb.id, src.id, vec);
    const hits = await searchVectors(orm, vec, nb.id, 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].rowid).toBe(chk.id);
    expect(hits[0].text).toContain('matching dims');
  });
});

describe('vec dim guard (r478): boot warns but never blocks', () => {
  it('initVecChunks(768) on a 1024-dim table warns with both values and leaves the table intact', () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    try {
      expect(() => initVecChunks(orm, 768)).not.toThrow();
    } finally {
      console.warn = origWarn;
    }

    const warn = warnings.find((w) => w.includes('vec_chunks'));
    expect(warn).toBeDefined();
    expect(warn).toContain('1024');
    expect(warn).toContain('768');

    // No doomed cross-dim rebuild: the old table survives untouched.
    const ddl = orm.all<{ sql: string }>(
      sql`SELECT sql FROM sqlite_master WHERE name='vec_chunks'`,
    )[0].sql;
    expect(ddl).toContain('float[1024]');
    expect(ddl).toContain('distance_metric=cosine');
  });
});

describe('keyword regression: BM25 alive under dim mismatch (r478 + T7b fix)', () => {
  it('KeywordStrategy.retrieve returns properly-shaped chunks while the vec table is 1024-dim', async () => {
    const [nb] = orm.insert(notebooks).values({ name: 'Keyword NB' }).returning().all();
    const [src] = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'kw.txt', status: 'ready' })
      .returning()
      .all();

    const strategy = new KeywordStrategy();
    // ensureFts() must run before the insert so the AFTER INSERT trigger fires.
    await strategy.indexSource(src.id, nb.id);

    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: 2, text: 'zirconium lantern quay orchestrion' })
      .returning()
      .all();

    const hits = await strategy.retrieve('zirconium', nb.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunkId).toBe(chk.id);
    // The alias fix: rows used to come back with `source_id`/`chunk_index`
    // keys, leaving sourceId/chunkIndex undefined in the mapped ChunkResult.
    expect(hits[0].sourceId).toBe(src.id);
    expect(hits[0].chunkIndex).toBe(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(0);

    // isIndexed shares the fixed chunks/sources JOIN.
    expect(await strategy.isIndexed(nb.id)).toBe(true);
  });
});
