import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Citation } from '@crystalith/shared';
// Output pipeline — RAG retrieval → build context → generateObject →
// postprocess → map citations → persist.
//
// c38: aligned with v1 output_graph.py 5-node pipeline:
//  ResolveContext → GenerateOutput → PostprocessOutput → MapCitations → Persist
//
// source_ids filtering is now wired through (c27 was incomplete — it called
// RAG but never passed source_ids to the retrieval layer).
import { eq, inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, outputs, sources } from '../../db/schema.ts';
import type { ChunkResult } from '../../rag/types.ts';
import {
  buildCitationMap,
  mapCitationsIntoContent,
  markPostprocessed,
  sanitizeCitationsIndices,
  type ChunkRow,
} from './citations.ts';
import { generateOutputByType, buildOutputQuery, type ToolOutputType } from './generator.ts';
import { generateFallbackContent, needsRepair, postprocessOutput } from './postprocess.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type GenerationPreference = 'quality' | 'speed';

/** Maps preference to topK for RAG retrieval. */
const PREF_TOPK: Record<GenerationPreference, number> = {
  quality: 10,
  speed: 3,
};

export interface PipelineInput {
  model: LanguageModelV4;
  notebookId: number;
  type: ToolOutputType;
  /** Optional specific chunk IDs. When set, skips RAG retrieval. */
  chunkIds?: number[];
  /** Scope retrieval to specific sources (v1 source_ids — c38). */
  sourceIds?: number[];
  /** Custom prompt override. */
  prompt?: string;
  /** Retrieval preference: quality (topK=10) or speed (topK=3). Default: quality. */
  preference?: GenerationPreference;
  /** Retrieval top-K override (v1 top_k). */
  topK?: number;
  /** Minimum similarity score (v1 min_score, default 0.2). */
  minScore?: number;
  /** Model override (v1 model_id). */
  modelId?: string;
  /** Abort when the client cancels / disconnects. */
  abortSignal?: AbortSignal;
}

export interface PipelineResult {
  outputId: number;
  type: string;
  content: unknown;
  chunkCount: number;
  citations: Citation[];
  /** Postprocess warnings (empty content fallback, etc.). */
  warnings: string[];
}

/**
 * Run the full output generation pipeline.
 *
 * Three retrieval paths:
 *  - Explicit chunkIds → direct fetch (manual selection)
 *  - No chunkIds + sourceIds → RAG scoped to those sources (c38)
 *  - No chunkIds, no sourceIds → RAG across whole notebook (c27)
 */
export async function runOutputPipeline(input: PipelineInput): Promise<PipelineResult> {
  // c50: validate source_id ownership before retrieval (v1 _validate_source_ids,
  // output_graph.py:151-176 — unknown/foreign source_id → ValueError → 400).
  // Done here (not the router) so the typed 400 path in router.ts catches the
  // "retrieval" keyword in the thrown message.
  if (input.sourceIds && input.sourceIds.length > 0) {
    const owned = db()
      .select({ id: sources.id })
      .from(sources)
      .where(inArray(sources.id, input.sourceIds))
      .all()
      .filter((s) => {
        // sources table has notebookId; we filtered by id, now check notebook
        const row = db()
          .select({ notebookId: sources.notebookId })
          .from(sources)
          .where(eq(sources.id, s.id))
          .get();
        return row?.notebookId === input.notebookId;
      });
    if (owned.length !== input.sourceIds.length) {
      throw new Error(
        'Output retrieval failed: Unknown source_id in source_ids (not in this notebook)',
      );
    }
  }

  let chunkRows: ChunkRow[];

  if (input.chunkIds && input.chunkIds.length > 0) {
    // Explicit selection — direct fetch
    const rows = db()
      .select({
        id: chunks.id,
        text: chunks.text,
        sourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
      })
      .from(chunks)
      .where(inArray(chunks.id, input.chunkIds))
      .all();
    chunkRows = rows.map((r) => ({ ...r, score: 1 }));
  } else {
    // Semantic search via RAG registry (c27 + c38 source_ids scoping)
    const topK = input.topK ?? PREF_TOPK[input.preference ?? 'quality'];
    const minScore = input.minScore ?? 0.2;
    const query = buildOutputQuery(input.type, input.prompt);
    const { ragRegistry } = await import('../../rag/registry.ts');

    let searchResults: ChunkResult[];
    try {
      searchResults = await ragRegistry.retrieveWith('embed', input.notebookId, query, {
        topK,
        minScore,
        sourceIds: input.sourceIds,
      });
    } catch (error) {
      // c42: RAG failure MUST propagate — do NOT dump all chunks (v1 has no such fallback)
      throw new Error(
        `Output retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    chunkRows = searchResults.map((r) => ({
      id: r.chunkId,
      text: r.text,
      sourceId: r.sourceId,
      chunkIndex: r.chunkIndex,
      score: r.score,
    }));
  }

  return finishPipeline(input, chunkRows);
}

async function finishPipeline(
  input: PipelineInput,
  chunkRows: ChunkRow[],
): Promise<PipelineResult> {
  // Build context
  const context =
    chunkRows.length > 0
      ? chunkRows
          .map((c, i) => `[Source ${i + 1}] (score: ${c.score.toFixed(2)})\n${c.text}`)
          .join('\n\n')
      : 'No relevant context found.';

  // Generate
  let object: unknown;
  try {
    object = await generateOutputByType(input.model, input.type, context, input.prompt);
  } catch (error) {
    // Fallback content on generation failure (v1 output_postprocess.py:15-99)
    object = generateFallbackContent(input.type, input.prompt, error);
  }

  // c50: LLM repair loop (v1 output_graph.py:595-719 PostprocessOutput node).
  // When preference=quality AND needs_repair detects salvageable-but-incomplete
  // output, run a second generateObject pass to try to fix it before falling
  // back. Falls back gracefully if the repair pass also fails.
  if (input.preference === 'quality' && needsRepair(input.type, object)) {
    try {
      const repaired = await generateOutputByType(input.model, input.type, context, input.prompt);
      if (!needsRepair(input.type, repaired)) {
        // accept the repaired output
        object = repaired;
      }
    } catch {
      // repair pass failed — keep the original object (will fallback in postprocess)
    }
  }

  // Postprocess: ensure minimum content + warnings (v1 output_postprocess.py:349-379)
  const { content: postprocessed, warnings } = postprocessOutput(object, input.type);

  // Map citations: LLM may reference chunks by index [1], [2] — map to full Citation objects
  // v1 output_graph.py:722-742. Build a citation map (1-based index → Citation).
  const { citations, citationMap } = buildCitationMap(chunkRows);

  // c50: sanitize citation indices BEFORE mapping (v1 sanitize_citations_indices,
  // output_postprocess.py:293-346). Strips out-of-range/duplicate/non-integer
  // indices from the raw `citations` arrays so mapping only resolves valid ones.
  const sanitized = sanitizeCitationsIndices(postprocessed, citations.length);
  const allWarnings = [...warnings, ...sanitized.warnings];

  // c42: recursively map citations INTO the content tree (v1 _map_citations).
  // Replaces numeric [1,3] arrays with full Citation dicts, then persists the mapped content.
  const mappedContent = mapCitationsIntoContent(sanitized.sanitized, citationMap, citations);

  // c50: mark _postprocessed when sanitization or fallback occurred
  // (v1 output_postprocess.py:377 sets _postprocessed:true on all content).
  let finalContent = markPostprocessed(
    mappedContent,
    sanitized.changed || warnings.length > 0,
    allWarnings,
  );
  if (sanitized.changed && isRecord(finalContent)) {
    finalContent = {
      ...finalContent,
      citations_sanitized: true,
    };
  }

  if (input.abortSignal?.aborted) {
    const err = new Error('Output generation aborted');
    err.name = 'AbortError';
    throw err;
  }

  // Persist — content now has resolved citation objects (not bare integers)
  const content = isRecord(finalContent) ? finalContent : {};
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: chunkRows.map((c) => c.id),
      content,
    })
    .returning()
    .get();

  return {
    outputId: row.id,
    type: input.type,
    content: finalContent,
    chunkCount: chunkRows.length,
    citations,
    warnings: allWarnings,
  };
}
