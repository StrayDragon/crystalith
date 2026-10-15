// FTS5 keyword index over `chunks.text_tokens` (c132 r487).
//
// Tokenization is application-side (rag/cjk-tokenizer): bun:sqlite exposes no
// custom SQL function API, so the content-sync triggers stay dumb column
// copies of `text_tokens`, and every chunk write goes through the db/chunks.ts
// seam which computes the token string. unicode61 splits the space-joined
// token string exactly at token boundaries — that is all the SQL-side
// tokenization we need.
import { sql, type SQL } from 'drizzle-orm';

import { buildMatchQuery, tokenizeForIndex } from '../rag/cjk-tokenizer.ts';
import { createDbClient } from './client.ts';
import type { Orm } from './index';

const FTS_TABLE = 'chunks_fts';

/** Bare FTS5 table DDL (no triggers — see ensureFtsIndex ordering). */
function ftsTableDdl(): string {
  return `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
        text_tokens,
        content='chunks',
        content_rowid='id'
      );`;
}

/** Content-sync triggers over the token column. Created only alongside a
 * consistent index (never during migration/backfill — a trigger firing a
 * FTS5 'delete' for a row the index never saw marks the database malformed). */
function ftsTriggerStatements(): string[] {
  return [
    `CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(rowid, text_tokens) VALUES (new.id, new.text_tokens);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text_tokens) VALUES ('delete', old.id, old.text_tokens);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text_tokens) VALUES ('delete', old.id, old.text_tokens);
      INSERT INTO ${FTS_TABLE}(rowid, text_tokens) VALUES (new.id, new.text_tokens);
    END;`,
  ];
}

/** Drop the content-sync triggers (see ensureFtsIndex for the ordering why). */
function dropFtsTriggers(orm: Orm): void {
  for (const t of ['chunks_ai', 'chunks_ad', 'chunks_au']) {
    orm.run(sql.raw(`DROP TRIGGER IF EXISTS ${t}`));
  }
}

/** Backfill NULL text_tokens rows in TS batches; returns rows written. */
function backfillTextTokens(orm: Orm): number {
  let written = 0;
  for (;;) {
    const rows = orm.all<{ id: number; text: string }>(
      sql`SELECT id, text FROM chunks WHERE text_tokens IS NULL LIMIT 500`,
    );
    if (rows.length === 0) break;
    for (const r of rows) {
      orm.run(sql`UPDATE chunks SET text_tokens = ${tokenizeForIndex(r.text)} WHERE id = ${r.id}`);
    }
    written += rows.length;
  }
  return written;
}

/**
 * Boot-time ensure (sync — createDb path, like initVecChunks):
 *  1. drop the content-sync triggers FIRST — an UPDATE/DELETE on chunks while
 *     the index is mid-migration fires a FTS5 'delete' for rows the new index
 *     never saw, which SQLite reports as "database disk image is malformed";
 *  2. migrate a legacy chunks_fts (indexed raw `text`, unicode61 — useless for
 *     CJK) to the text_tokens shape: drop + recreate;
 *  3. backfill rows whose text_tokens is NULL (pre-0010 rows) in TS batches;
 *  4. rebuild the index from content when anything changed (authoritative);
 *  5. recreate the triggers last, so they only live alongside a consistent
 *     index.
 * Idempotent; no-op when the shape is current and nothing needs backfill.
 */
export function ensureFtsIndex(orm: Orm): void {
  dropFtsTriggers(orm);

  const existing = orm.all<{ sql: string | null }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='chunks_fts'`,
  )[0];

  const legacySql = existing?.sql ?? null;
  const legacy = legacySql !== null && !legacySql.includes('text_tokens');
  if (legacy) {
    orm.run(sql.raw(`DROP TABLE ${FTS_TABLE}`));
  }
  if (legacy || legacySql === null) {
    orm.run(sql.raw(ftsTableDdl()));
  }

  const backfilled = backfillTextTokens(orm);
  // Rebuild also covers a freshly created table over pre-existing rows (all
  // already tokenized — backfill wrote nothing but the index is still empty).
  const chunkCount = orm.all<{ c: number }>(sql`SELECT COUNT(*) AS c FROM chunks`)[0]?.c ?? 0;
  if (legacy || backfilled > 0 || (legacySql === null && chunkCount > 0)) {
    // External-content rebuild: repopulates every row from `chunks.text_tokens`
    // and clears any inconsistent index state left by earlier migrations.
    orm.run(sql.raw(`INSERT INTO ${FTS_TABLE}(${FTS_TABLE}) VALUES('rebuild')`));
  }

  for (const stmt of ftsTriggerStatements()) orm.run(sql.raw(stmt));
}

export interface FtsHit {
  chunkId: number;
  text: string;
  sourceId: number;
  chunkIndex: number;
  /** FTS5 bm25() score — NEGATIVE, more negative = more relevant. Correct
   * ordering comes from `ORDER BY fts.rank`; do not treat it as a position. */
  rank: number;
}

/**
 * Keyword-channel search over the token column. `notebookId` null/undefined =
 * global scope; `originTypes` empty/undefined = no origin restriction.
 * Returns [] when the query tokenizes to nothing.
 *
 * The table + triggers are ensured once at boot (createDb → ensureFtsIndex —
 * the only Orm construction path), not per request.
 */
export async function ftsSearch(
  orm: Orm,
  query: string,
  opts: { notebookId?: number | null; originTypes?: string[]; topK: number },
): Promise<FtsHit[]> {
  const match = buildMatchQuery(query);
  if (!match) return [];

  const conditions: SQL[] = [];
  const scopeNotebookId = opts.notebookId ?? null;
  if (scopeNotebookId !== null) conditions.push(sql`s.notebook_id = ${scopeNotebookId}`);
  if (opts.originTypes?.length) {
    conditions.push(
      sql`c.origin_type IN (${sql.join(
        opts.originTypes.map((t) => sql`${t}`),
        sql`, `,
      )})`,
    );
  }
  const extra = conditions.length ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``;

  return createDbClient(orm).raw<FtsHit>(sql`
    SELECT c.id AS chunkId,
           c.text AS text,
           c.source_id AS sourceId,
           c.chunk_index AS chunkIndex,
           fts.rank AS rank
      FROM ${sql.raw(FTS_TABLE)} fts
      JOIN chunks c ON c.id = fts.rowid
      JOIN sources s ON s.id = c.source_id
     WHERE ${sql.raw(FTS_TABLE)} MATCH ${match}${extra}
     ORDER BY fts.rank
     LIMIT ${opts.topK};
  `);
}
