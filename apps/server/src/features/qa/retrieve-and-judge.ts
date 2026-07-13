import type { Citation, ContextStats } from '@crystalith/shared';
// Deterministic retrieval + evidence judge — ports v1 `run_qa_pipeline`
// (service.py:274-487).
//
// v1 runs a deterministic retrieval pipeline BEFORE LLM generation: embed the
// question → vector search → filter → judge evidence. If evidence is
// insufficient, it short-circuits with a localized no-evidence answer and
// never enters LLM generation. This module replicates that 12-step judgment.
//
// The v2 handler uses this as a pre-stage before streamText: if evidence is
// found, the retrieved context + citations are injected into the prompt; if
// not, the no-evidence answer is returned directly without an LLM call.
import { and, eq, inArray } from 'drizzle-orm';

import { countTokens } from '../../ai/tokenizer.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { hydrateCitations } from '../../shared/citations.ts';
import { computeConfidence } from './confidence.ts';

export const EVIDENCE_THRESHOLD_DEFAULT = 0.2;

// Localized no-evidence answers (v1 service.py:27-32, 62-69)
export const NO_EVIDENCE_ANSWER = '来源中未找到相关证据';
export const NO_SOURCES_ANSWER = '请先选择至少一个来源后再提问';
export const NO_VECTOR_INDEX_ANSWER =
  '未在向量库中检索到相关内容。若刚切换运行环境，请对已导入来源重新索引。';
export const SOURCES_NOT_READY_ANSWER = '所选来源尚未完成索引或内容为空，请等待来源状态变为就绪';

/** Localized answer for each no-evidence reason (v1 no_evidence_answer_for_reason). */
export function noEvidenceAnswerForReason(reason: NoEvidenceReason | null): string {
  switch (reason) {
    case 'no_sources':
      return NO_SOURCES_ANSWER;
    case 'no_vector_hits':
      return NO_VECTOR_INDEX_ANSWER;
    case 'no_valid_chunks':
      return SOURCES_NOT_READY_ANSWER;
    default:
      return NO_EVIDENCE_ANSWER;
  }
}

export type NoEvidenceReason =
  | 'no_sources'
  | 'embedding_empty'
  | 'no_vector_hits'
  | 'no_valid_chunks'
  | 'low_similarity';

export interface JudgeResult {
  /** True when sufficient evidence was found — proceed to LLM generation. */
  evidence: boolean;
  /** Set when evidence is false — determines the localized short-circuit answer. */
  reason?: NoEvidenceReason;
  /** Citations for the retrieved evidence (empty when no evidence). */
  citations: Citation[];
  /** Formatted context string injected into the LLM prompt. */
  context: string;
  /** Confidence score [0,1] (0 when no evidence). */
  confidence: number;
  /** Token/context stats (mirrors v1 ContextStats). */
  contextStats: ContextStats;
}

// ContextStats is imported from @crystalith/shared (c54: moved out of
// server-local to honor the Zod-SSOT rule).

export interface RetrieveAndJudgeOptions {
  notebookId: number;
  question: string;
  /** Scope retrieval to specific sources (v1 source_ids). */
  sourceIds?: number[];
  /** Retrieval top-K (default 5). */
  topK?: number;
  /** Minimum similarity score (default 0.2, v1 EVIDENCE_THRESHOLD_DEFAULT). */
  minScore?: number;
  /** RAG strategy override. */
  strategyId?: string;
  /** Max tokens for context budget stats. */
  maxTokens?: number;
  /** History token estimate for stats. */
  historyTokens?: number;
}

/**
 * Deterministic retrieval + evidence judgment — the v1 `run_qa_pipeline` port.
 *
 * 12-step pipeline (service.py:274-487):
 *  1. Normalize source_ids
 *  2. If no source_ids → no_sources
 *  3. Embed question
 *  4. If embedding empty → embedding_empty
 *  5. Vector search
 *  6. If no hits → no_vector_hits
 *  7. Filter: source.status==ready, chunk non-empty
 *  8. If no valid → no_valid_chunks
 *  9. Build context
 * 10. If similarity_avg < threshold → low_similarity
 * 11. Compute confidence
 * 12. evidence=true
 */
export async function retrieveAndJudge(opts: RetrieveAndJudgeOptions): Promise<JudgeResult> {
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? EVIDENCE_THRESHOLD_DEFAULT;
  const maxTokens = opts.maxTokens ?? 8000;
  // c48: real token counts via gpt-tokenizer (v1 TokenCounter, service.py:254-271).
  const queryTokens = countTokens(opts.question);
  const historyTokens = opts.historyTokens ?? 0;
  const emptyStats: ContextStats = {
    total_tokens: historyTokens + queryTokens,
    system_tokens: 0,
    history_tokens: historyTokens,
    retrieval_tokens: 0,
    query_tokens: queryTokens,
    max_tokens: maxTokens,
    compressed: false,
  };

  // Step 1-2: empty/missing source_ids → no_sources (v1 service.py:295-316)
  const normalizedSourceIds = opts.sourceIds?.length ? opts.sourceIds : undefined;
  if (!normalizedSourceIds) {
    return noEvidence('no_sources', emptyStats);
  }

  // Step 3-4: Retrieve via RAG strategy (embed + search happen inside)
  const strategyId = opts.strategyId ?? ragRegistry.getForNotebook(opts.notebookId)[0] ?? 'embed';
  const strategy = ragRegistry.get(strategyId);

  let rawResults;
  try {
    rawResults = await strategy.retrieve(opts.question, opts.notebookId, {
      topK,
      minScore,
      sourceIds: normalizedSourceIds,
      // c48: deterministic single-embed retrieval — do NOT enable multiQuery.
      // v1 service.py:319-327 embeds the question once and runs a single
      // cached_vector_search (no seed expansion / RRF fusion). multiQuery would
      // change the edge set and normalize scores via RRF, making the low_similarity
      // gate and confidence incomparable with v1.
      multiQuery: false,
    });
  } catch {
    // Embedding/search failure — treat as no_vector_hits
    return noEvidence('embedding_empty', emptyStats);
  }

  // Step 6: No hits
  if (rawResults.length === 0) {
    return noEvidence('no_vector_hits', emptyStats);
  }

  // Step 7: Filter — hydrate chunk metadata, check source.status==ready
  const chunkIds = rawResults.map((r) => r.chunk_id);
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
    .where(
      and(
        inArray(chunks.id, chunkIds),
        eq(sources.notebookId, opts.notebookId),
        eq(sources.status, 'ready'),
      ),
    )
    .all();

  const chunkMap = new Map(chunkRows.map((c) => [c.id, c]));

  // Build valid results: chunk exists, source ready, text non-empty
  const validResults = rawResults.filter((r) => {
    const chunk = chunkMap.get(r.chunk_id);
    return chunk && chunk.text.trim().length > 0;
  });

  // Step 8: No valid chunks
  if (validResults.length === 0) {
    return noEvidence('no_valid_chunks', emptyStats);
  }

  // Step 9: Build citations + context
  const sourceIds = [...new Set(validResults.map((r) => r.source_id))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const citations: Citation[] = validResults.map((r) => {
    const chunk = chunkMap.get(r.chunk_id)!;
    const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
    const pageNumber = typeof metadata.page === 'number' ? metadata.page : null;
    const paragraphIndex =
      typeof metadata.paragraph_index === 'number' ? metadata.paragraph_index : null;
    return {
      source_id: r.source_id,
      source_name: sourceMap.get(r.source_id) ?? 'unknown',
      chunk_id: r.chunk_id,
      chunk_index: r.chunk_index + 1, // v1 stores 1-based (chunk.chunk_index + 1)
      page_number: pageNumber,
      paragraph_index: paragraphIndex,
      snippet: chunk.text.slice(0, 200),
      score: r.score,
    };
  });

  // Step 9b: Format context (v1 format_context — [i] Source: filename (chunk N)\n<text>)
  const context = validResults
    .map((r, i) => {
      const chunk = chunkMap.get(r.chunk_id)!;
      const name = sourceMap.get(r.source_id) ?? 'unknown';
      return `[${i + 1}] Source: ${name} (chunk ${r.chunk_index + 1})\n${chunk.text}`;
    })
    .join('\n\n');

  // Step 10: Low similarity check (v1: similarity_avg < max(min_score, threshold))
  const similarityAvg = avg(validResults.map((r) => r.score));
  const evidenceThreshold = Math.max(minScore, EVIDENCE_THRESHOLD_DEFAULT);
  // c45: low_similarity MUST return empty citations (v1 service.py:455-464)
  if (similarityAvg < evidenceThreshold) {
    return noEvidence('low_similarity', emptyStats, []);
  }

  // Step 11: Confidence
  const notebookSourceCount = db()
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.notebookId, opts.notebookId))
    .all().length;
  const confidence = computeConfidence(citations, notebookSourceCount, topK);

  // Step 12: Evidence found
  // c48: real token counts (v1 TokenCounter, service.py:254-271) + compression
  // flag when history + retrieval would exceed max_tokens (v1 ContextWindow).
  const retrievalTokens = countTokens(context);
  const totalTokens = historyTokens + retrievalTokens + queryTokens;
  const compressed = totalTokens > maxTokens;
  return {
    evidence: true,
    citations,
    context,
    confidence,
    contextStats: {
      total_tokens: totalTokens,
      system_tokens: 0,
      history_tokens: historyTokens,
      retrieval_tokens: retrievalTokens,
      query_tokens: queryTokens,
      max_tokens: maxTokens,
      compressed,
    },
  };
}

function noEvidence(
  reason: NoEvidenceReason,
  stats: ContextStats,
  citations: Citation[] = [],
): JudgeResult {
  return {
    evidence: false,
    reason,
    citations,
    context: '',
    confidence: 0,
    contextStats: stats,
  };
}

/**
 * Resolve retrieved chunks into Citation format (exported for testing/reuse).
 * Delegates to the shared `hydrateCitations` helper
 * (`shared/citations.ts`); behavior is unchanged from the previously-inlined
 * version: snippet NOT trimmed, page/paragraph extracted via the strict
 * `typeof === 'number'` predicate (no string coercion). Kept `async` for
 * call-site / test-signature compatibility.
 */
export async function resolveCitations(
  retrievedChunks: Array<{
    chunk_id: number;
    source_id: number;
    chunk_index: number;
    text: string;
    score: number;
  }>,
): Promise<Citation[]> {
  return hydrateCitations(retrievedChunks);
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
