// BM25 Keyword Strategy — full-text search via sqlite FTS5.
//
// The FTS index lives over `chunks.text_tokens` (db/fts.ts, c132 r487):
// application-side CJK-bigram tokenization, since bun:sqlite exposes no
// custom SQL function API. Retrieval delegates to `ftsSearch`; scores keep the
// legacy rank-normalization semantics (1 = best, mapped to 0–1 by position).
import { sql } from 'drizzle-orm';

import { ftsSearch } from '../db/fts.ts';
import type { Orm } from '../db/index';
import { client, db } from '../db/index.ts';
import type { RAGStrategy, ChunkResult } from './types.ts';

function bm25Score(rank: number, totalResults: number): number {
  // Normalize BM25 rank to 0–1 range (lower rank = better)
  if (totalResults <= 1) return 1;
  return 1 - (rank - 1) / totalResults;
}

export class KeywordStrategy implements RAGStrategy {
  readonly id = 'keyword';
  readonly name = 'BM25 Keyword';
  readonly version = '2.0.0';

  async indexSource(_sourceId: number, _notebookId: number): Promise<void> {
    // FTS5 content-sync triggers handle automatic indexing (db/fts.ts).
    // No-op: chunk writes via db/chunks.ts automatically populate the index.
  }

  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    const topK = opts?.topK ?? 8;
    const minScore = opts?.minScore ?? 0;

    const orm: Orm = db();
    // r486: existing retrieval callers see source-origin chunks only — output
    // chunks enter the index but never the QA/outputs/studio evidence paths.
    const rows = await ftsSearch(orm, query, { notebookId, originTypes: ['source'], topK });
    const total = rows.length;
    return rows
      .map((r) => ({
        chunkId: r.chunkId,
        text: r.text,
        // normalized BM25 rank (0-1, higher = better)
        score: bm25Score(r.rank, total),
        sourceId: r.sourceId,
        chunkIndex: r.chunkIndex,
      }))
      .filter((r) => r.score >= minScore);
  }

  async isIndexed(notebookId: number): Promise<boolean> {
    // FTS is always synced; check if notebook has any chunks. `raw` + [0]
    // (not rawOne): bun:sqlite's raw-SQL `.get()` returns array-shaped rows,
    // which made the former rawOne read `.c` off an array — always undefined.
    const row = (
      await client().raw<{ c: number }>(sql`
      SELECT COUNT(*) AS c FROM chunks c
      JOIN sources s ON s.id = c.source_id
      WHERE s.notebook_id = ${notebookId};
    `)
    )[0];
    return (row?.c ?? 0) > 0;
  }

  async deleteSource(_sourceId: number): Promise<void> {
    // FTS5 triggers handle cascade automatically
  }
}
