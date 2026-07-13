// Refine retrieval — embed prompt, vector-search, post-filter by source_ids,
// build citations + context. Port of v1 `_execute_refine` retrieval section
// (worker.py:189-246) + `_build_messages` context (api.py:255-303).
//
// Shared by single-format refine (via worker) and batch refine (via router).
import type { Citation } from '@crystalith/shared';
import { inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { hydrateCitations } from '../../shared/citations.ts';
import type { StageLimiters } from '../tasks/worker.ts';

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

  // ③ Hydrate citations via the shared helper. Refine's behavior: snippet is
  //    trimmed before slicing (`.trim().slice(0,200)`, v1 api.py:289 /
  //    worker.py:234) and page/paragraph use the coercive extractPageNumber
  //    predicate (Number() + isFinite), so pass both options.
  const citations: Citation[] = hydrateCitations(filtered, {
    trimSnippet: true,
    coercePageNumber: true,
  });

  // ④ context: full unstripped text, [N] Source: <filename> (chunk <idx>)\n<text>
  //    (v1 utils/context.py:13-24). Source names are needed here independently
  //    of the citation hydration above.
  const uniqueSourceIds = [...new Set(filtered.map((r) => r.source_id))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, uniqueSourceIds))
    .all();
  const sourceNameMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const context = filtered
    .map((r, i) => {
      const name = sourceNameMap.get(r.source_id) ?? 'unknown';
      return `[${i + 1}] Source: ${name} (chunk ${r.chunk_index + 1})\n${r.text}`;
    })
    .join('\n\n');

  return { citations, context, evidence: true };
}
