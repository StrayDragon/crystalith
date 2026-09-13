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
import { truncateToTokenBudget } from '../../rag/context-window.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { hydrateCitations } from '../../shared/citations.ts';
import { getContextWindowSettings } from '../../shared/config.ts';
import { logger } from '../../shared/logger.ts';
import { computeConfidence } from './confidence.ts';

export const EVIDENCE_THRESHOLD_DEFAULT = 0.2;

// Low-similarity pass-through (allow-low-similarity-qa): retrieved chunks
// below the evidence threshold no longer short-circuit the QA — the answer is
// generated ungrounded and this localized notice is appended after it.
export const WEAK_GROUNDING_TIP =
  '\n\n---\n*提示：未在勾选来源中找到与问题高度相关的内容，以上回答主要基于模型通用知识，未引用来源。*';

// Localized no-evidence answers (v1 service.py:27-32, 62-69)
export const NO_EVIDENCE_ANSWER = '来源中未找到相关证据';
export const NO_SOURCES_ANSWER = '当前笔记本还没有来源，请先导入后再提问';
export const NO_VECTOR_INDEX_ANSWER =
  '未在向量库中检索到相关内容。若刚切换运行环境，请对已导入来源重新索引。';
export const SOURCES_NOT_READY_ANSWER = '所选来源尚未完成索引或内容为空，请等待来源状态变为就绪';
export const LOW_SIMILARITY_ANSWER =
  '检索到了片段，但与问题的相似度偏低，不足以作为可靠证据。请换个问法，或确认已勾选正确来源。';
export const EMBEDDING_EMPTY_ANSWER = '问题向量化失败，请检查 Embedding 模型配置后重试。';

/** Localized answer for each no-evidence reason (v1 no_evidence_answer_for_reason). */
export function noEvidenceAnswerForReason(reason: NoEvidenceReason | null): string {
  switch (reason) {
    case 'no_sources':
      return NO_SOURCES_ANSWER;
    case 'no_vector_hits':
      return NO_VECTOR_INDEX_ANSWER;
    case 'no_valid_chunks':
      return SOURCES_NOT_READY_ANSWER;
    case 'low_similarity':
      return LOW_SIMILARITY_ANSWER;
    case 'embedding_empty':
      return EMBEDDING_EMPTY_ANSWER;
    case null:
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
  /** True when generation should proceed (grounded, ungrounded, or weak-grounded). */
  evidence: boolean;
  /**
   * Set only when `evidence` is false — determines the localized
   * short-circuit answer. Weak-grounding pass-through keeps this undefined.
   */
  reason?: NoEvidenceReason;
  /** Citations for the retrieved evidence (empty when no/unreliable evidence). */
  citations: Citation[];
  /** Formatted context string injected into the LLM prompt. */
  context: string;
  /** Confidence score [0,1] (0 when no/unreliable evidence). */
  confidence: number;
  /**
   * Set on low-similarity pass-through: generation proceeds ungrounded and
   * this localized tip is appended after the answer.
   */
  groundingNotice?: string;
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
  /** c60: system prompt for real system_tokens counting (v1 ContextWindow.build). */
  systemPrompt?: string;
}

/**
 * Deterministic retrieval + evidence judgment — the v1 `run_qa_pipeline` port,
 * with c63 empty-scope ungrounded chat.
 *
 * Pipeline:
 *  1. Normalize source_ids
 *  2. Empty/missing source_ids → ungrounded (skip retrieval, evidence=true, citations=[])
 *  3. Embed question
 *  4. If embedding empty → embedding_empty
 *  5. Vector search
 *  6. If no hits → no_vector_hits
 *  7. Filter: source.status==ready, chunk non-empty
 *  8. If no valid → no_valid_chunks
 *  9. Build context
 * 10. If similarity_avg < threshold → weak-grounding pass-through
 *     (evidence=true, empty context/citations, groundingNotice set)
 * 11. Compute confidence
 * 12. evidence=true
 */
export async function retrieveAndJudge(opts: RetrieveAndJudgeOptions): Promise<JudgeResult> {
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? EVIDENCE_THRESHOLD_DEFAULT;
  // c60: read max_tokens from config (v1 service.py:265 reads settings.context_window)
  const maxTokens = opts.maxTokens ?? getContextWindowSettings().max_tokens;
  // c60: real system_tokens via gpt-tokenizer (v1 ContextWindow.build + TokenCounter)
  const systemTokens = opts.systemPrompt ? countTokens(opts.systemPrompt) : 0;
  // c48: real token counts via gpt-tokenizer (v1 TokenCounter, service.py:254-271).
  const queryTokens = countTokens(opts.question);
  const historyTokens = opts.historyTokens ?? 0;
  const emptyStats: ContextStats = {
    totalTokens: systemTokens + historyTokens + queryTokens,
    systemTokens: systemTokens,
    historyTokens: historyTokens,
    retrievalTokens: 0,
    queryTokens: queryTokens,
    maxTokens: maxTokens,
    compressed: false,
  };

  // Step 1-2: empty/missing source_ids → ungrounded chat (skip RAG, citations=[]).
  const normalizedSourceIds = opts.sourceIds?.length ? opts.sourceIds : undefined;
  if (!normalizedSourceIds) {
    return {
      evidence: true,
      citations: [],
      context: '',
      confidence: 0,
      contextStats: emptyStats,
    };
  }

  // Step 3-4: Retrieve via RAG strategy (embed + search happen inside).
  // Pass minScore: 0 so strategy does not pre-drop weak hits — Step 10 applies
  // the evidence threshold and can distinguish low_similarity from empty index.
  const strategyId = opts.strategyId ?? ragRegistry.getForNotebook(opts.notebookId)[0] ?? 'embed';
  const strategy = ragRegistry.get(strategyId);

  let rawResults;
  try {
    rawResults = await strategy.retrieve(opts.question, opts.notebookId, {
      topK,
      minScore: 0,
      sourceIds: normalizedSourceIds,
      // c48: deterministic single-embed retrieval — do NOT enable multiQuery.
      // v1 service.py:319-327 embeds the question once and runs a single
      // cached_vector_search (no seed expansion / RRF fusion). multiQuery would
      // change the edge set and normalize scores via RRF, making the low_similarity
      // gate and confidence incomparable with v1.
      multiQuery: false,
    });
  } catch (error) {
    // Embedding/search failure — log underlying cause for diagnostics.
    logger.error(
      '[qa] retrieve failed (embedding_empty):',
      error instanceof Error ? error.message : error,
    );
    return noEvidence('embedding_empty', emptyStats);
  }

  // Step 6: No hits (empty vector index / scoped miss — not low similarity)
  if (rawResults.length === 0) {
    return noEvidence('no_vector_hits', emptyStats);
  }

  // Step 7: Filter — hydrate chunk metadata, check source.status==ready
  const chunkIds = rawResults.map((r) => r.chunkId);
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
    const chunk = chunkMap.get(r.chunkId);
    return chunk && chunk.text.trim().length > 0;
  });

  // Step 8: No valid chunks
  if (validResults.length === 0) {
    return noEvidence('no_valid_chunks', emptyStats);
  }

  // Step 9: Build citations + context
  const sourceIds = [...new Set(validResults.map((r) => r.sourceId))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const citations: Citation[] = validResults.map((r) => {
    const chunk = chunkMap.get(r.chunkId)!;
    const metadata = chunk.metadata ?? {};
    const pageNumber = typeof metadata.page === 'number' ? metadata.page : null;
    const paragraphIndex =
      typeof metadata.paragraph_index === 'number' ? metadata.paragraph_index : null;
    return {
      sourceId: r.sourceId,
      sourceName: sourceMap.get(r.sourceId) ?? 'unknown',
      chunkId: r.chunkId,
      // v1 stores 1-based (chunk.chunkIndex + 1)
      chunkIndex: r.chunkIndex + 1,
      pageNumber: pageNumber,
      paragraphIndex: paragraphIndex,
      snippet: chunk.text.slice(0, 200),
      score: r.score,
    };
  });

  // Step 9b: Format context (v1 format_context — [i] Source: filename (chunk N)\n<text>)
  // Keep the blocks so Step 12 can truncate block-by-block when over budget.
  const contextBlocks = validResults.map((r, i) => {
    const chunk = chunkMap.get(r.chunkId)!;
    const name = sourceMap.get(r.sourceId) ?? 'unknown';
    return `[${i + 1}] Source: ${name} (chunk ${r.chunkIndex + 1})\n${chunk.text}`;
  });

  // Step 10: Low similarity (v1: similarity_avg < max(min_score, threshold)).
  // allow-low-similarity-qa: no longer a short-circuit — proceed UNGROUNDED
  // (no low-quality context, no citations) and surface a weak-grounding tip.
  const similarityAvg = avg(validResults.map((r) => r.score));
  const evidenceThreshold = Math.max(minScore, EVIDENCE_THRESHOLD_DEFAULT);
  if (similarityAvg < evidenceThreshold) {
    return {
      evidence: true,
      citations: [],
      context: '',
      confidence: 0,
      groundingNotice: WEAK_GROUNDING_TIP,
      contextStats: emptyStats,
    };
  }

  // Step 11: Confidence
  const notebookSourceCount = db()
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.notebookId, opts.notebookId))
    .all().length;
  const confidence = computeConfidence(citations, notebookSourceCount, topK);

  // Step 12: Evidence found.
  // c48 computed real token counts + a `compressed` flag; c55 actually enforces
  // the budget: when history + retrieval + query would exceed max_tokens, the
  // retrieval blocks are truncated (v1 _truncate_blocks) so the text passed to
  // the LLM fits. query + history are always preserved (budget reserved for
  // them); retrieval fills the remainder.
  const fullContext = contextBlocks.join('\n\n');
  const retrievalBudget = Math.max(0, maxTokens - systemTokens - historyTokens - queryTokens);
  let context = fullContext;
  let retrievalTokens = countTokens(fullContext);
  let compressed = false;
  if (countTokens(fullContext) > retrievalBudget) {
    const { text, truncated, usedTokens } = truncateToTokenBudget(contextBlocks, retrievalBudget);
    context = text;
    compressed = truncated;
    retrievalTokens = usedTokens;
  }
  const totalTokens = systemTokens + historyTokens + retrievalTokens + queryTokens;
  return {
    evidence: true,
    citations,
    context,
    confidence,
    contextStats: {
      totalTokens: totalTokens,
      systemTokens: systemTokens,
      historyTokens: historyTokens,
      retrievalTokens: retrievalTokens,
      queryTokens: queryTokens,
      maxTokens: maxTokens,
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
    chunkId: number;
    sourceId: number;
    chunkIndex: number;
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
