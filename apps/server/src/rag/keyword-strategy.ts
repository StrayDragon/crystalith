// BM25 Keyword Strategy — full-text search via sqlite FTS5.
//
// Uses a `chunks_fts` virtual table for BM25-ranked retrieval. Creates the
// FTS index on first use. The FTS content table syncs with the `chunks` table
// via content-sync triggers.
import { sql } from 'drizzle-orm';

import { client } from '../db/index.ts';
import type { RAGStrategy, ChunkResult } from './types.ts';

const FTS_TABLE = 'chunks_fts';

/** Create the FTS5 virtual table if it doesn't exist + sync triggers. */
async function ensureFts() {
  const c = client();
  await c.rawRun(
    sql.raw(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
        text,
        content='chunks',
        content_rowid='id'
      );`,
    ),
  );

  // Triggers to keep FTS in sync with chunks table
  await c.rawRun(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(rowid, text) VALUES (new.id, new.text);
    END;
  `),
  );
  await c.rawRun(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text) VALUES ('delete', old.id, old.text);
    END;
  `),
  );
  await c.rawRun(
    sql.raw(`
    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, rowid, text) VALUES ('delete', old.id, old.text);
      INSERT INTO ${FTS_TABLE}(rowid, text) VALUES (new.id, new.text);
    END;
  `),
  );
}

function bm25Score(
  row: { text: string; sourceId: number; chunkIndex: number; rank: number },
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

  private async init() {
    if (!this.ftsReady) {
      await ensureFts();
      this.ftsReady = true;
    }
  }

  async indexSource(_sourceId: number, _notebookId: number): Promise<void> {
    // FTS5 content-sync triggers handle automatic indexing.
    // No-op: chunks insert automatically populates FTS.
    await this.init();
  }

  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    await this.init();
    const topK = opts?.topK ?? 8;
    const minScore = opts?.minScore ?? 0;

    // scope to notebook via JOIN
    const rows = await client().raw<{
      text: string;
      sourceId: number;
      chunkIndex: number;
      chunkId: number;
      rank: number;
    }>(sql`
      SELECT c.text AS text,
             c.sourceId AS source_id,
             c.chunkIndex AS chunk_index,
             c.id AS chunk_id,
             fts.rank AS rank
        FROM ${sql.raw(FTS_TABLE)} fts
        JOIN chunks c ON c.id = fts.rowid
        JOIN sources s ON s.id = c.sourceId
       WHERE ${FTS_TABLE} MATCH ${query}
         AND s.notebook_id = ${notebookId}
       ORDER BY fts.rank
       LIMIT ${topK};
    `);

    const total = rows.length;
    return rows
      .map((r) => ({
        chunkId: r.chunkId,
        text: r.text,
        // normalized BM25 rank (0-1, higher = better)
        score: bm25Score(r, total),
        sourceId: r.sourceId,
        chunkIndex: r.chunkIndex,
      }))
      .filter((r) => r.score >= minScore);
  }

  async isIndexed(notebookId: number): Promise<boolean> {
    await this.init();
    // FTS is always synced; check if notebook has any chunks
    const row = await client().rawOne<{ c: number }>(sql`
      SELECT COUNT(*) AS c FROM chunks c
      JOIN sources s ON s.id = c.sourceId
      WHERE s.notebook_id = ${notebookId};
    `);
    return (row?.c ?? 0) > 0;
  }

  async deleteSource(_sourceId: number): Promise<void> {
    // FTS5 triggers handle cascade automatically
    await this.init();
  }
}
