// sqlite-vec virtual table helpers.
//
// `vec_chunks` is a vec0 virtual table keyed by chunk rowid, partitioned by
// notebook_id + source_id so KNN searches can be scoped to a notebook without
// scanning the whole index. Drizzle does not manage virtual tables, so we use
// raw SQL via `sql` templates with bound parameters (no string interpolation
// of user-supplied values).
import { sql } from 'drizzle-orm';

import { AppHttpError, ErrorCode } from '../shared/errors.ts';
import { createDbClient } from './client.ts';
import type { Orm } from './index';

/** Default embedding dimension fallback (bge-m3 = 1024). Overridable per index. */
export const DEFAULT_EMBEDDING_DIM = 1024;

/** vec0 CREATE DDL for a dimension (cosine metric — see initVecChunks). */
function vecChunksDdl(dim: number): string {
  return `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding float[${dim}] distance_metric=cosine,
        notebook_id integer partition by,
        source_id integer partition by
      );`;
}

/**
 * Recreate vec_chunks wholesale at `dim` (c131 r480 global rebuild mode).
 * Destructive: every stored vector is dropped — callers re-embed all ready
 * sources afterwards. No in-place migration by policy (greenfield rebuild).
 */
export function recreateVecChunks(orm: Orm, dim: number): void {
  orm.run(sql`DROP TABLE IF EXISTS vec_chunks`);
  orm.run(sql.raw(vecChunksDdl(dim)));
}

/**
 * Parse the declared embedding dimension (`embedding float[N]`) out of a
 * vec_chunks CREATE statement. Returns null when the declaration is absent
 * or unparseable (never built by us → no guard basis).
 */
function parseVecDim(ddl: string): number | null {
  const m = /embedding\s+float\[(\d+)\]/iu.exec(ddl);
  return m ? Number(m[1]) : null;
}

/**
 * Read the dimension the existing vec_chunks table declares, or null when the
 * table does not exist / has no parseable declaration. Async (DbClient port)
 * because the callers — searchVectors / insertChunkVector — are runtime
 * paths; boot-time initVecChunks reads sqlite_master synchronously instead.
 */
export async function readVecTableDim(orm: Orm): Promise<number | null> {
  const rows = await createDbClient(orm).raw<{ sql: string | null }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_chunks'`,
  );
  const ddl = rows[0]?.sql;
  return ddl ? parseVecDim(ddl) : null;
}

/**
 * Guard: refuse vectors whose length disagrees with the table's declared
 * dimension (c130 r478) — sqlite-vec's native error for this is opaque and
 * surfaces as a raw SQLiteError deep in KNN/insert. Point at the re-embed
 * entry instead of letting retrieval silently degrade.
 */
async function assertVecDimMatchesTable(orm: Orm, vec: Float32Array | number[]): Promise<void> {
  const tableDim = await readVecTableDim(orm);
  if (tableDim !== null && vec.length !== tableDim) {
    throw new AppHttpError(
      ErrorCode.EMBEDDING_DIM_MISMATCH,
      `维度不匹配：vec_chunks 表为 ${tableDim} 维 / 向量为 ${vec.length} 维，请重嵌/重建索引（sources/batch/re-embed，见 docs）`,
      { tableDim, vecDim: vec.length },
    );
  }
}

export interface VectorHit {
  rowid: number;
  source_id: number;
  notebook_id: number;
  distance: number;
  text: string;
  chunk_index: number;
}

/**
 * Create the vec_chunks virtual table if it does not already exist.
 *
 * The embedding column MUST declare `distance_metric=cosine`: sqlite-vec's
 * default is L2, which mis-scores normalized embedding-model vectors (bge-m3,
 * OpenAI, …) — an exact-content match lands around 0.85 L2, so the strategy's
 * `score = 1 - distance` conversion pushed every hit below the evidence
 * threshold and grounded QA silently degraded to ungrounded. With cosine,
 * `distance` IS cosine distance ∈ [0,2] and `score = 1 - distance` is cosine
 * similarity, matching the retrieval spec's formula semantics.
 *
 * Tables created before the cosine declaration are rebuilt in place from
 * their own rows (vectors are preserved — no re-embed needed).
 */
export function initVecChunks(orm: Orm, dim = DEFAULT_EMBEDDING_DIM): void {
  const createDdl = vecChunksDdl(dim);

  const existing = orm.all<{ sql: string | null }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_chunks'`,
  )[0];
  if (!existing?.sql) {
    orm.run(sql.raw(createDdl));
    return;
  }

  // c130 r478: declared dim vs existing table dim. Warn but never block boot
  // (BM25/keyword retrieval keeps working); the runtime guards in
  // searchVectors/insertChunkVector turn mismatches into explicit errors.
  // Also skip the cosine rebuild below — a cross-dim rebuild is doomed (the
  // old rows cannot be re-inserted at the new width), so keep the old table
  // and let the re-embed entry rebuild it wholesale.
  const tableDim = parseVecDim(existing.sql);
  if (tableDim !== null && tableDim !== dim) {
    console.warn(
      `[db] vec_chunks 维度不匹配：现表 ${tableDim} 维 / 配置声明 ${dim} 维；` +
        '语义检索与向量写入将报错，keyword 检索不受影响；请重嵌/重建索引（sources/batch/re-embed，见 docs）',
    );
    return;
  }

  if (existing.sql.includes('distance_metric=cosine')) return;

  // Legacy L2 table — rebuild from its own rows inside a transaction so the
  // metric switch keeps every stored vector. On failure keep the old table
  // (retrieval stays legacy-correct-but-low-scored) instead of blocking boot.
  try {
    const rows = orm.all<{
      rowid: number;
      embedding: Uint8Array;
      notebook_id: number;
      source_id: number;
    }>(sql`SELECT rowid, embedding, notebook_id, source_id FROM vec_chunks`);
    orm.run(sql`BEGIN IMMEDIATE`);
    orm.run(sql`DROP TABLE vec_chunks`);
    orm.run(sql.raw(createDdl));
    for (const r of rows) {
      orm.run(
        sql`INSERT INTO vec_chunks(rowid, embedding, notebook_id, source_id)
            VALUES (${r.rowid}, ${r.embedding}, ${r.notebook_id}, ${r.source_id});`,
      );
    }
    orm.run(sql`COMMIT`);
    console.warn(
      `[db] vec_chunks rebuilt with distance_metric=cosine (${rows.length} vectors migrated)`,
    );
  } catch (error) {
    try {
      orm.run(sql`ROLLBACK`);
    } catch {
      // no active transaction — BEGIN itself failed; nothing to unwind
    }
    console.warn('[db] vec_chunks cosine rebuild failed; keeping legacy table:', error);
  }
}

/** Encode a vector as the little-endian f32 byte buffer sqlite-vec expects. */
function toBytes(vec: Float32Array | number[]): Uint8Array {
  const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** Insert a chunk embedding. Call after the `chunks` row exists (rowid match). */
export async function insertChunkVector(
  orm: Orm,
  rowid: number,
  notebookId: number,
  sourceId: number,
  embedding: Float32Array | number[],
): Promise<void> {
  await assertVecDimMatchesTable(orm, embedding);
  await createDbClient(orm).rawRun(
    sql`INSERT INTO vec_chunks(rowid, embedding, notebook_id, source_id)
        VALUES (${rowid}, ${toBytes(embedding)}, ${notebookId}, ${sourceId});`,
  );
}

/** Delete a chunk's vector (call before deleting the `chunks` row). */
export async function deleteChunkVector(orm: Orm, rowid: number): Promise<void> {
  await createDbClient(orm).rawRun(sql`DELETE FROM vec_chunks WHERE rowid = ${rowid};`);
}

/** Delete all vectors for a source. */
export async function deleteSourceVectors(orm: Orm, sourceId: number): Promise<void> {
  await createDbClient(orm).rawRun(sql`DELETE FROM vec_chunks WHERE source_id = ${sourceId};`);
}

/** Origin types existing retrieval callers see by default (c132 r486):
 * everything except source-origin chunks (e.g. indexed outputs) is excluded
 * from QA/outputs/studio/research evidence paths unless explicitly requested
 * by the global SearchService. */
const DEFAULT_ORIGIN_TYPES: string[] = ['source'];

/**
 * KNN search scoped to a notebook. Returns the top-K chunk rowids + distance,
 * joined with the `chunks` table for text. The query vector and integer
 * filters are bound as parameters (no injection surface).
 *
 * `originTypes` defaults to source-only chunks (r486 — existing retrieval
 * callers' citation semantics are unchanged by output indexing); pass an
 * explicit wider set (e.g. ['source', 'output']) for global search.
 *
 * When `sourceIds` is provided (c40 — v1 source-scoping), run one KNN per
 * source using the `source_id` partition equality predicate, then merge by
 * distance. sqlite-vec vec0 partitions do not support `source_id IN (...)`,
 * and an over-fetch+post-filter approach misses small sources when the
 * notebook has many other indexed chunks.
 */
export async function searchVectors(
  orm: Orm,
  queryVec: Float32Array | number[],
  notebookId: number | null,
  topK = 10,
  sourceIds?: number[],
  originTypes?: string[],
): Promise<VectorHit[]> {
  await assertVecDimMatchesTable(orm, queryVec);
  const queryBytes = toBytes(queryVec);
  const c = createDbClient(orm);
  const origins = originTypes ?? DEFAULT_ORIGIN_TYPES;
  const originFilter = sql` AND c.origin_type IN (${sql.join(
    origins.map((t) => sql`${t}`),
    sql`, `,
  )})`;
  // notebookId null = global scope (c132 global search): drop the partition
  // predicate and scan every notebook's partitions.
  const notebookFilter = notebookId !== null ? sql` AND v.notebook_id = ${notebookId}` : sql``;

  if (!sourceIds?.length) {
    return c.raw<VectorHit>(sql`
      SELECT v.rowid AS rowid,
             v.source_id AS source_id,
             v.notebook_id AS notebook_id,
             v.distance AS distance,
             c.text AS text,
             c.chunk_index AS chunk_index
        FROM vec_chunks v
        JOIN chunks c ON c.id = v.rowid
       WHERE v.embedding MATCH ${queryBytes}
         AND v.k = ${topK}${notebookFilter}${originFilter}
       ORDER BY v.distance;
    `);
  }

  // Unique positive ids only — avoid duplicate partition queries.
  const uniqueSourceIds = [...new Set(sourceIds.filter((id) => Number.isFinite(id) && id > 0))];
  const perSource: VectorHit[][] = [];
  for (const sourceId of uniqueSourceIds) {
    perSource.push(
      await c.raw<VectorHit>(sql`
      SELECT v.rowid AS rowid,
             v.source_id AS source_id,
             v.notebook_id AS notebook_id,
             v.distance AS distance,
             c.text AS text,
             c.chunk_index AS chunk_index
        FROM vec_chunks v
        JOIN chunks c ON c.id = v.rowid
       WHERE v.embedding MATCH ${queryBytes}
         AND v.k = ${topK}
         AND v.notebook_id = ${notebookId}
         AND v.source_id = ${sourceId}${originFilter}
       ORDER BY v.distance;
    `),
    );
  }

  // Merge round-robin by per-source rank so every explicitly selected source
  // keeps representation in the top-K: merging purely by distance lets a large
  // source crowd a small one out entirely (2026-10-13 real-world regression —
  // a 1-chunk source's only hit lost its slot to a 5-chunk source's 5th
  // chunk, and the later diversity cap trimmed the winner further). Each
  // per-source list is already distance-ordered; taking rank r from each
  // source in turn guarantees a slot for every source while the final global
  // sort keeps the r229 score-descending contract.
  const merged: VectorHit[] = [];
  for (let rank = 0; merged.length < topK; rank++) {
    let added = false;
    for (const hits of perSource) {
      if (merged.length >= topK) break;
      const hit = hits[rank];
      if (hit) {
        merged.push(hit);
        added = true;
      }
    }
    if (!added) break;
  }
  merged.sort((a, b) => a.distance - b.distance);
  return merged;
}

/** Count indexed vectors for a notebook (used to check `isIndexed`). */
export async function countVectors(orm: Orm, notebookId: number): Promise<number> {
  const rows = await createDbClient(orm).raw<{ c: number }>(
    sql`SELECT COUNT(*) AS c FROM vec_chunks WHERE notebook_id = ${notebookId};`,
  );
  return rows[0]?.c ?? 0;
}
