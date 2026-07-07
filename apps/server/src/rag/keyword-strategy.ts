// BM25 Keyword Strategy — full-text search via sqlite FTS5.
//
// Uses a `chunks_fts` virtual table for BM25-ranked retrieval. Creates the
// FTS index on first use. The FTS content table syncs with the `chunks` table
// via content-sync triggers.
import { sql } from 'drizzle-orm';

import { db } from '../db/index.ts';
import type { RAGStrategy, ChunkResult } from './types.ts';

const FTS_TABLE = 'chunks_fts';

/** Create the FTS5 virtual table if it doesn't exist + sync triggers. */
function ensureFts(orm = db()) {
  orm.run(
    sql.raw(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
        text,
        content='chunks',
        content_rowid='id'
      );`,
    ),
  );

  // Triggers to keep FTS in sync with chunks table
  orm.run(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(rowid, text) VALUES (new.id, new.text);
    END;
  `),
  );
  orm.run(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text) VALUES ('delete', old.id, old.text);
    END;
  `),
  );
  orm.run(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text) VALUES ('delete', old.id, old.text);
      INSERT INTO ${FTS_TABLE}(rowid, text) VALUES (new.id, new.text);
    END;
  `),
  );
}

function bm25Score(
  row: { text: string; source_id: number; chunk_index: number; rank: number },
  totalResults: number,
): number {
  // Normalize BM25 rank to 0–1 range (lower rank = better)
  if (totalResults <= 1) return 1;
  return 1 - (row.rank - 1) / totalResults;
}

export class KeywordStrategy implements RAGStrategy {
  readonly id = 'keyword';
  readonly name = 'BM25 Keyword';
  readonly version = '1.0.0';
  private ftsReady = false;

  private init() {
    if (!this.ftsReady) {
      ensureFts();
      this.ftsReady = true;
    }
  }

  async indexSource(_sourceId: number, _notebookId: number): Promise<void> {
    // FTS5 content-sync triggers handle automatic indexing.
    // No-op: chunks insert automatically populates FTS.
    this.init();
  }

  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    this.init();
    const topK = opts?.topK ?? 10;
    const minScore = opts?.minScore ?? 0;

    // scope to notebook via JOIN
    const rows = db().all<{
      text: string;
      source_id: number;
      chunk_index: number;
      chunk_id: number;
      rank: number;
    }>(sql`
      SELECT c.text AS text,
             c.source_id AS source_id,
             c.chunk_index AS chunk_index,
             c.id AS chunk_id,
             fts.rank AS rank
        FROM ${sql.raw(FTS_TABLE)} fts
        JOIN chunks c ON c.id = fts.rowid
        JOIN sources s ON s.id = c.source_id
       WHERE ${FTS_TABLE} MATCH ${query}
         AND s.notebook_id = ${notebookId}
       ORDER BY fts.rank
       LIMIT ${topK};
    `);

    const total = rows.length;
    return rows
      .map((r) => ({
        chunk_id: r.chunk_id,
        text: r.text,
        distance: bm25Score(r, total),
        source_id: r.source_id,
        chunk_index: r.chunk_index,
      }))
      .filter((r) => r.distance >= minScore);
  }

  async isIndexed(notebookId: number): Promise<boolean> {
    this.init();
    // FTS is always synced; check if notebook has any chunks
    const row = db().get<{ c: number }>(sql`
      SELECT COUNT(*) AS c FROM chunks c
      JOIN sources s ON s.id = c.source_id
      WHERE s.notebook_id = ${notebookId};
    `);
    return (row?.c ?? 0) > 0;
  }

  async deleteSource(_sourceId: number): Promise<void> {
    // FTS5 triggers handle cascade automatically
    this.init();
  }
}
