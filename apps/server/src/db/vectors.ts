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

/** Create the vec_chunks virtual table if it does not already exist. */
export function initVecChunks(orm: Orm, dim = DEFAULT_EMBEDDING_DIM): void {
  // `dim` is an internal constant, never user input — safe in a raw string.
  orm.run(
    sql.raw(
      `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding float[${dim}],
        notebook_id integer partition by,
        source_id integer partition by
      );`,
    ),
  );
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
 */
export function searchVectors(
  orm: Orm,
  queryVec: Float32Array | number[],
  notebookId: number,
  topK = 10,
): VectorHit[] {
  return orm.all<VectorHit>(sql`
    SELECT v.rowid AS rowid,
           v.source_id AS source_id,
           v.notebook_id AS notebook_id,
           v.distance AS distance,
           c.text AS text,
           c.chunk_index AS chunk_index
      FROM vec_chunks v
      JOIN chunks c ON c.id = v.rowid
     WHERE v.embedding MATCH ${toBytes(queryVec)}
       AND v.k = ${topK}
       AND v.notebook_id = ${notebookId}
     ORDER BY v.distance;
  `);
}

/** Count indexed vectors for a notebook (used to check `isIndexed`). */
export function countVectors(orm: Orm, notebookId: number): number {
  const rows = orm.all<{ c: number }>(
    sql`SELECT COUNT(*) AS c FROM vec_chunks WHERE notebook_id = ${notebookId};`,
  );
  return rows[0]?.c ?? 0;
}
