// Page Index Strategy — PDF page-level retrieval + preview generation.
//
// Indexes chunks by their page metadata (set during PDF parsing). Retrieves
// entire pages rather than individual chunks, useful for slide generation and
// document preview. Falls back to first page if no page metadata.
import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index.ts';
import { chunks, sources } from '../db/schema.ts';
import type { RAGStrategy, ChunkResult } from './types.ts';

interface PageGroup {
  page: number;
  chunkIds: number[];
  text: string;
  source_id: number;
}

export class PageIndexStrategy implements RAGStrategy {
  readonly id = 'page-index';
  readonly name = 'Page Index';
  readonly version = '1.0.0';

  async indexSource(_sourceId: number, _notebookId: number): Promise<void> {
    // Page index reuses existing chunks table — no separate index needed.
    // Retrieval groups chunks by page metadata at query time.
  }

  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    const topK = opts?.topK ?? 10;
    const minScore = opts?.minScore ?? 0;

    // Get all chunks for this notebook, grouped by source + page
    const chunkRows = db()
      .select({
        id: chunks.id,
        text: chunks.text,
        sourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
        metadata: chunks.metadata,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .where(eq(sources.notebookId, notebookId))
      .all();

    // Group by page
    const pageMap = new Map<string, PageGroup>();
    for (const row of chunkRows) {
      const meta = row.metadata as Record<string, unknown> | null;
      const page = typeof meta?.page === 'number' ? meta.page : 1;
      const key = `${row.sourceId}:${page}`;

      const existing = pageMap.get(key);
      if (existing) {
        existing.chunkIds.push(row.id);
        existing.text += '\n' + row.text;
      } else {
        pageMap.set(key, {
          page,
          chunkIds: [row.id],
          text: row.text,
          source_id: row.sourceId,
        });
      }
    }

    // Simple string matching for "relevance" (page-index relies on post-filtering)
    const results: ChunkResult[] = [];
    for (const group of pageMap.values()) {
      // Score by naive substring match count
      const lowerText = group.text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let matchCount = 0;
      let idx = 0;
      while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
        matchCount++;
        idx++;
      }
      const score = matchCount > 0 ? Math.min(1, matchCount / (group.text.length / 500)) : 0;

      if (score >= minScore) {
        results.push({
          chunk_id: group.chunkIds[0],
          text: group.text.substring(0, 500),
          distance: score,
          source_id: group.source_id,
          chunk_index: group.page,
        });
      }
    }

    return results.sort((a, b) => b.distance - a.distance).slice(0, topK);
  }

  async isIndexed(notebookId: number): Promise<boolean> {
    const row = db().get<{ c: number }>(
      sql`SELECT COUNT(*) AS c FROM ${chunks} c JOIN ${sources} s ON s.id = c.source_id WHERE s.notebook_id = ${notebookId}`,
    );
    return (row?.c ?? 0) > 0;
  }

  async deleteSource(_sourceId: number): Promise<void> {
    // No-op: page index has no separate index tables
  }
}
