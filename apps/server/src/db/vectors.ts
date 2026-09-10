// sqlite-vec virtual table helpers.
//
// `vec_chunks` is a vec0 virtual table keyed by chunk rowid, partitioned by
// notebook_id + source_id so KNN searches can be scoped to a notebook without
// scanning the whole index. Drizzle does not manage virtual tables, so we use
// raw SQL via `sql` templates with bound parameters (no string interpolation
// of user-supplied values).
import { sql } from 'drizzle-orm';

import type { Orm } from './index';

/** Default embedding dimension (bge-m3 = 1024). Overridable per index. */
export const DEFAULT_EMBEDDING_DIM = 1024;

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
  const createDdl = `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding float[${dim}] distance_metric=cosine,
        notebook_id integer partition by,
        source_id integer partition by
      );`;

  const existing = orm.all<{ sql: string | null }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_chunks'`,
  )[0];
  if (!existing?.sql) {
    orm.run(sql.raw(createDdl));
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
export function insertChunkVector(
  orm: Orm,
  rowid: number,
  notebookId: number,
  sourceId: number,
  embedding: Float32Array | number[],
): void {
  orm.run(
    sql`INSERT INTO vec_chunks(rowid, embedding, notebook_id, source_id)
        VALUES (${rowid}, ${toBytes(embedding)}, ${notebookId}, ${sourceId});`,
  );
}

/** Delete a chunk's vector (call before deleting the `chunks` row). */
export function deleteChunkVector(orm: Orm, rowid: number): void {
  orm.run(sql`DELETE FROM vec_chunks WHERE rowid = ${rowid};`);
}

/** Delete all vectors for a source. */
export function deleteSourceVectors(orm: Orm, sourceId: number): void {
  orm.run(sql`DELETE FROM vec_chunks WHERE source_id = ${sourceId};`);
}

/**
 * KNN search scoped to a notebook. Returns the top-K chunk rowids + distance,
 * joined with the `chunks` table for text. The query vector and integer
 * filters are bound as parameters (no injection surface).
 *
 * When `sourceIds` is provided (c40 — v1 source-scoping), run one KNN per
 * source using the `source_id` partition equality predicate, then merge by
 * distance. sqlite-vec vec0 partitions do not support `source_id IN (...)`,
 * and an over-fetch+post-filter approach misses small sources when the
 * notebook has many other indexed chunks.
 */
export function searchVectors(
  orm: Orm,
  queryVec: Float32Array | number[],
  notebookId: number,
  topK = 10,
  sourceIds?: number[],
): VectorHit[] {
  const queryBytes = toBytes(queryVec);

  if (!sourceIds?.length) {
    return orm.all<VectorHit>(sql`
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
       ORDER BY v.distance;
    `);
  }

  // Unique positive ids only — avoid duplicate partition queries.
  const uniqueSourceIds = [...new Set(sourceIds.filter((id) => Number.isFinite(id) && id > 0))];
  const merged: VectorHit[] = [];
  for (const sourceId of uniqueSourceIds) {
    const hits = orm.all<VectorHit>(sql`
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
         AND v.source_id = ${sourceId}
       ORDER BY v.distance;
    `);
    merged.push(...hits);
  }
  merged.sort((a, b) => a.distance - b.distance);
  return merged.slice(0, topK);
}

/** Count indexed vectors for a notebook (used to check `isIndexed`). */
export function countVectors(orm: Orm, notebookId: number): number {
  const rows = orm.all<{ c: number }>(
    sql`SELECT COUNT(*) AS c FROM vec_chunks WHERE notebook_id = ${notebookId};`,
  );
  return rows[0]?.c ?? 0;
}

/** Fetch all vectors for a notebook (used by analysis clustering). */
export function getAllVectors(orm: Orm, notebookId: number): VectorHit[] {
  return orm.all<VectorHit>(sql`
    SELECT v.rowid AS rowid,
           v.source_id AS source_id,
           v.notebook_id AS notebook_id,
           v.distance AS distance,
           c.text AS text,
           c.chunk_index AS chunk_index
      FROM vec_chunks v
      JOIN chunks c ON c.id = v.rowid
     WHERE v.notebook_id = ${notebookId}
     ORDER BY c.chunk_index;
  `);
}
