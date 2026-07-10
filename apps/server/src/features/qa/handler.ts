import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Citation, ChatTurn } from '@crystalith/shared';
// QA handler — streamText + retrieveSources tool integration.
//
// Wraps AI SDK streamText with RAG tool calling. The agent autonomously
// decides when to call retrieveSources based on the user's question. Tool
// results are captured via the fullStream `tool-result` sink so citations
// reflect the chunks the model actually retrieved (not an empty array).
import { tool } from 'ai';
import { inArray, eq } from 'drizzle-orm';
import { z } from 'zod';

import { streamQaResponse } from '../../ai/stream.ts';
import { db } from '../../db/index.ts';
import { sources } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { computeConfidence } from './confidence.ts';

// ---------------------------------------------------------------------------
// Localized no-evidence hints (mirrors v1 service.py:28-34)
// ---------------------------------------------------------------------------

export const NO_EVIDENCE_ANSWER = '来源中未找到相关证据';
export const NO_SOURCES_ANSWER = '请先选择至少一个来源后再提问';
export const NO_VECTOR_INDEX_ANSWER =
  '未在向量库中检索到相关内容。若刚切换运行环境，请对已导入来源重新索引。';
export const SOURCES_NOT_READY_ANSWER = '所选来源尚未完成索引或内容为空，请等待来源状态变为就绪';

export type NoEvidenceReason =
  | 'no_sources'
  | 'embedding_empty'
  | 'no_vector_hits'
  | 'no_valid_chunks'
  | 'low_similarity';

/** Localized answers for each no-evidence reason (mirrors v1 service.py:62-69). */
export function noEvidenceAnswerForReason(reason: NoEvidenceReason | null): string {
  if (reason === 'no_sources') return NO_SOURCES_ANSWER;
  if (reason === 'no_vector_hits') return NO_VECTOR_INDEX_ANSWER;
  if (reason === 'no_valid_chunks') return SOURCES_NOT_READY_ANSWER;
  return NO_EVIDENCE_ANSWER;
}

/** Map NoEvidenceReason enum to a user-visible Chinese hint. */
export function noEvidenceHint(reason?: string): string {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QaHandlerOptions {
  model: LanguageModelV4;
  question: string;
  notebookId: number;
  history: ChatTurn[];
  systemPrompt: string;
  messageId?: number;
  maxSteps?: number;
  /** RAG strategy id override (defaults to the notebook's configured strategy). */
  strategyId?: string;
  /** Retrieval top-K (default 5). */
  topK?: number;
  /** Lifecycle hook for the provisional assistant message (see stream.ts). */
  onMessageSettled?: (accumulatedText: string, failed: boolean) => void;
}

// Internal shape returned by the retrieveSources tool.
interface RetrievedChunk {
  chunk_id: number;
  source_id: number;
  chunk_index: number;
  text: string;
  score: number;
}

// ---------------------------------------------------------------------------
// retrieveSources tool
// ---------------------------------------------------------------------------

/**
 * Resolve the RAG strategy for a QA request: explicit override → notebook
 * config → default 'embed'. The chosen strategy honors c16 foundations
 * (distance→similarity, multi-query, cache, diversity).
 */
function resolveStrategy(notebookId: number, strategyId?: string) {
  const id = strategyId ?? ragRegistry.getForNotebook(notebookId)[0] ?? 'embed';
  return ragRegistry.get(id);
}

const retrieveSourcesTool = (notebookId: number, strategyId?: string, topK = 5) => {
  const strategy = resolveStrategy(notebookId, strategyId);
  return tool({
    description:
      'Retrieve relevant source chunks from the notebook to answer the user question. Call this before answering.',
    inputSchema: z.object({
      query: z.string().describe('Search query to find relevant information'),
      topK: z.number().default(topK).describe('Number of chunks to retrieve'),
    }),
    execute: async ({
      query,
      topK: k,
    }: {
      query: string;
      topK: number;
    }): Promise<RetrievedChunk[]> => {
      try {
        const results = await strategy.retrieve(query, notebookId, {
          topK: k,
          multiQuery: true,
        });
        return results.map((r) => ({
          chunk_id: r.chunk_id,
          source_id: r.source_id,
          chunk_index: r.chunk_index,
          text: r.text.slice(0, 800),
          score: r.score,
        }));
      } catch {
        return [];
      }
    },
  });
};

// ---------------------------------------------------------------------------
// Citation resolution
// ---------------------------------------------------------------------------

/** Count indexed sources in a notebook (for confidence coverage ratio). */
function countNotebookSources(notebookId: number): number {
  // Count all sources in the notebook (v2 sources table has no soft-delete;
  // 'deleted' status does not exist in the enum ['processing','ready','failed']).
  return db()
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .all().length;
}

/**
 * Resolve retrieved chunks into Citation format, hydrating the real source
 * filename (not a "Source <id>" placeholder). Mirrors v1's Citation shape:
 * source_id/source_name/chunk_id/chunk_index(0-based here)/snippet/score.
 */
export async function resolveCitations(retrievedChunks: RetrievedChunk[]): Promise<Citation[]> {
  if (retrievedChunks.length === 0) return [];

  // Hydrate source names in one query.
  const sourceIds = [...new Set(retrievedChunks.map((c) => c.source_id))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  return retrievedChunks.map((c) => ({
    source_id: c.source_id,
    source_name: sourceMap.get(c.source_id) ?? 'unknown',
    chunk_id: c.chunk_id,
    chunk_index: c.chunk_index,
    snippet: c.text.slice(0, 200),
    score: c.score,
  }));
}

// ---------------------------------------------------------------------------
// Stream handler
// ---------------------------------------------------------------------------

/**
 * Run streaming QA with RAG tool integration.
 * Returns a Response with SSE event stream.
 */
export function streamQa(opts: QaHandlerOptions): Response {
  // Accumulator populated by the fullStream tool-result sink. The model
  // may call retrieveSources multiple times (multi-step); we union results.
  const retrievedChunks: RetrievedChunk[] = [];
  let retrievalCalled = false;
  const topK = opts.topK ?? 5;

  const tools = {
    retrieveSources: retrieveSourcesTool(opts.notebookId, opts.strategyId, topK),
  };

  // Pre-flight: count sources for no-evidence detection in noEvidenceResolver.
  const sourceCount = countNotebookSources(opts.notebookId);

  return streamQaResponse({
    model: opts.model,
    systemPrompt: opts.systemPrompt,
    messages: [...opts.history, { role: 'user' as const, content: opts.question }],
    tools,
    maxSteps: opts.maxSteps ?? 5,
    messageId: opts.messageId,
    // Capture each tool call's result so citations reflect real retrieval.
    onToolResult: (toolName, result) => {
      if (toolName === 'retrieveSources' && Array.isArray(result)) {
        retrievalCalled = true;
        for (const r of result) {
          if (r && typeof r === 'object' && typeof (r as RetrievedChunk).chunk_id === 'number') {
            retrievedChunks.push(r as RetrievedChunk);
          }
        }
      }
    },
    citationsResolver: async () => resolveCitations(retrievedChunks),
    confidenceResolver: async () => {
      const citations = await resolveCitations(retrievedChunks);
      return computeConfidence(citations, countNotebookSources(opts.notebookId), topK);
    },
    noEvidenceResolver: async (citations) => {
      // Pre-flight: no sources at all
      if (sourceCount === 0) return 'no_sources';
      // Model didn't call retrieveSources (no evidence attempted)
      if (citations.length === 0 && !retrievalCalled) return 'no_vector_hits';
      // retrieveSources returned nothing
      if (citations.length === 0 && retrievalCalled) return 'no_vector_hits';
      // All results have very low similarity
      const maxScore = Math.max(...citations.map((c) => c.score ?? 0));
      if (maxScore < 0.3) return 'low_similarity';
      return undefined;
    },
    onMessageSettled: opts.onMessageSettled,
  });
}
