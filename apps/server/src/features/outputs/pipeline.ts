import type { LanguageModelV4 } from '@ai-sdk/provider';
// Output pipeline — RAG retrieval → build context → generateObject → persist.
//
// Single entry point for all output generation. Orchestrates:
//  1. Retrieve chunks: explicit chunk_ids OR RAG semantic search (c27)
//  2. Build context string from retrieved chunks
//  3. Call generateObject with schema
//  4. Map citations (chunk_id → source)
//  5. Persist to outputs table
import { eq, inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, outputs, sources } from '../../db/schema.ts';
import type { ChunkResult } from '../../rag/types.ts';
import { generateOutputByType, buildOutputQuery, type ToolOutputType } from './generator.ts';

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
  /** Custom prompt override. */
  prompt?: string;
  /** Retrieval preference: quality (topK=10) or speed (topK=3). Default: quality. */
  preference?: GenerationPreference;
}

export interface PipelineResult {
  outputId: number;
  type: string;
  content: unknown;
  chunkCount: number;
  citations: Array<{
    source_id: number;
    chunk_id: number;
    snippet: string;
    score: number;
  }>;
}

/**
 * Run the full output generation pipeline.
 *
 * Two retrieval paths:
 *  - Explicit chunkIds → direct fetch (unchanged, for manual selection)
 *  - No chunkIds → RAG semantic search via embed strategy (c27, v1 parity)
 */
export async function runOutputPipeline(input: PipelineInput): Promise<PipelineResult> {
  let chunkRows: Array<{
    id: number;
    text: string;
    sourceId: number;
    chunkIndex: number;
    score: number;
  }>;

  if (input.chunkIds && input.chunkIds.length > 0) {
    // Explicit selection — direct fetch (unchanged)
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
    // Semantic search via RAG registry (c27)
    const topK = PREF_TOPK[input.preference ?? 'quality'];
    const query = buildOutputQuery(input.type, input.prompt);
    const { ragRegistry } = await import('../../rag/registry.ts');

    let searchResults: ChunkResult[];
    try {
      searchResults = await ragRegistry.retrieveWith('embed', input.notebookId, query, { topK });
    } catch {
      // Fallback: if RAG is unavailable (no vectors), get all chunks
      const rows = db()
        .select({
          id: chunks.id,
          text: chunks.text,
          sourceId: chunks.sourceId,
          chunkIndex: chunks.chunkIndex,
        })
        .from(chunks)
        .innerJoin(sources, eq(chunks.sourceId, sources.id))
        .where(eq(sources.notebookId, input.notebookId))
        .all();
      chunkRows = rows.map((r) => ({ ...r, score: 0 }));
      return finishPipeline(input, chunkRows);
    }

    if (searchResults.length === 0) {
      // No results from RAG — produce empty output
      chunkRows = [];
    } else {
      chunkRows = searchResults.map((r) => ({
        id: r.chunk_id,
        text: r.text,
        sourceId: r.source_id,
        chunkIndex: r.chunk_index,
        score: r.score,
      }));
    }
  }

  return finishPipeline(input, chunkRows);
}

async function finishPipeline(
  input: PipelineInput,
  chunkRows: Array<{
    id: number;
    text: string;
    sourceId: number;
    chunkIndex: number;
    score: number;
  }>,
): Promise<PipelineResult> {
  // Build context
  const context =
    chunkRows.length > 0
      ? chunkRows
          .map((c, i) => `[Source ${i + 1}] (score: ${c.score.toFixed(2)})\n${c.text}`)
          .join('\n\n')
      : 'No relevant context found.';

  // Generate
  const object = await generateOutputByType(input.model, input.type, context, input.prompt);

  // Build citations (hydrated with source filename)
  const citations: Array<{ source_id: number; chunk_id: number; snippet: string; score: number }> =
    [];
  if (chunkRows.length > 0) {
    for (const c of chunkRows) {
      citations.push({
        source_id: c.sourceId,
        chunk_id: c.id,
        snippet: c.text.slice(0, 200),
        score: c.score,
      });
    }
  }

  // Persist
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: chunkRows.map((c) => c.id),
      content: object as Record<string, unknown>,
    })
    .returning()
    .get();

  return {
    outputId: row.id,
    type: input.type,
    content: object,
    chunkCount: chunkRows.length,
    citations,
  };
}
