// Refine retrieval — embed prompt, vector-search, post-filter by source_ids,
// build citations + context. Port of v1 `_execute_refine` retrieval section
// (worker.py:189-246) + `_build_messages` context (api.py:255-303).
//
// Shared by single-format refine (via worker) and batch refine (via router).
import type { Citation } from '@crystalith/shared';
import { inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import type { StageLimiters } from '../tasks/worker.ts';
import { extractPageNumber, extractParagraphIndex } from './format.ts';

export interface RetrieveResult {
  citations: Citation[];
  context: string;
  evidence: boolean;
}

/**
 * Retrieve relevant chunks for a refine prompt, filtered to source_ids.
 *
 * v1 filters at the vector-store level (source_ids=...); v2 RAG does not
 * support source_ids in RetrieveOptions, so we over-fetch (topK × N sources)
 * then post-filter — acceptable since refine source sets are small.
 */
export async function retrieveForRefine(
  notebookId: number,
  prompt: string,
  sourceIds: number[] | undefined,
  topK: number,
  minScore: number,
  signal: AbortSignal,
  limiters: StageLimiters,
): Promise<RetrieveResult> {
  if (!sourceIds?.length) return { citations: [], context: '', evidence: false };

  // ① embed + retrieve (embedding stage limiter)
  const releaseEmbed = await limiters.embedding.acquire();
  let results;
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    // Over-fetch to compensate for post-filtering: topK per requested source.
    const fetchK = topK * sourceIds.length;
    results = await ragRegistry
      .get('embed')
      .retrieve(prompt, notebookId, { topK: fetchK, minScore });
  } finally {
    releaseEmbed();
  }

  // ② post-filter by source_ids, cap at topK
  const idSet = new Set(sourceIds);
  const filtered = results.filter((r) => idSet.has(r.source_id)).slice(0, topK);

  if (filtered.length === 0) return { citations: [], context: '', evidence: false };

  // ③ ChunkResult already carries text/source_id/chunk_index (sqlite-vec JOIN).
  //    Hydrate source filename + chunk metadata for citation enrichment.
  const uniqueSourceIds = [...new Set(filtered.map((r) => r.source_id))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, uniqueSourceIds))
    .all();
  const sourceNameMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const chunkIds = filtered.map((r) => r.chunk_id);
  const chunkRows = db()
    .select({ id: chunks.id, metadata: chunks.metadata })
    .from(chunks)
    .where(inArray(chunks.id, chunkIds))
    .all();
  const chunkMetaMap = new Map(chunkRows.map((c) => [c.id, c.metadata]));

  // ④ citations: strip THEN slice(0,200) (v1 api.py:289 / worker.py:234).
  const citations: Citation[] = filtered.map((r) => ({
    source_id: r.source_id,
    source_name: sourceNameMap.get(r.source_id) ?? 'unknown',
    chunk_id: r.chunk_id,
    chunk_index: r.chunk_index + 1, // 1-based (v1 refine/api.py:295)
    snippet: r.text.trim().slice(0, 200),
    page_number: extractPageNumber(chunkMetaMap.get(r.chunk_id)),
    paragraph_index: extractParagraphIndex(chunkMetaMap.get(r.chunk_id)),
    score: r.score,
  }));

  // ⑤ context: full unstripped text, [N] Source: <filename> (chunk <idx>)\n<text>
  //    (v1 utils/context.py:13-24)
  const context = filtered
    .map((r, i) => {
      const name = sourceNameMap.get(r.source_id) ?? 'unknown';
      return `[${i + 1}] Source: ${name} (chunk ${r.chunk_index + 1})\n${r.text}`;
    })
    .join('\n\n');

  return { citations, context, evidence: true };
}
