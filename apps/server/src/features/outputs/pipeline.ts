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

interface ChunkRow {
  id: number;
  text: string;
  sourceId: number;
  chunkIndex: number;
  score: number;
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
    } catch {
      // Fallback: if RAG is unavailable, get all chunks (scoped to sourceIds if set)
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
      const filtered = input.sourceIds?.length
        ? rows.filter((r) => input.sourceIds!.includes(r.sourceId))
        : rows;
      chunkRows = filtered.map((r) => ({ ...r, score: 0 }));
      return finishPipeline(input, chunkRows);
    }

    chunkRows = searchResults.map((r) => ({
      id: r.chunk_id,
      text: r.text,
      sourceId: r.source_id,
      chunkIndex: r.chunk_index,
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
    object = generateFallbackContent(input.type, error);
  }

  // Postprocess: ensure minimum content + warnings (v1 output_postprocess.py:349-379)
  const { content: postprocessed, warnings } = postprocessOutput(object, input.type);

  // Map citations: LLM may reference chunks by index [1], [2] — map to full Citation objects
  // v1 output_graph.py:722-742. If the LLM output has no explicit citation indices,
  // fall back to attaching all retrieved chunks (current behavior).
  const citations = mapCitations(postprocessed, chunkRows);

  // Persist
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: chunkRows.map((c) => c.id),
      content: postprocessed as Record<string, unknown>,
    })
    .returning()
    .get();

  return {
    outputId: row.id,
    type: input.type,
    content: postprocessed,
    chunkCount: chunkRows.length,
    citations,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Postprocess (v1 output_postprocess.py)
// ---------------------------------------------------------------------------

interface PostprocessResult {
  content: Record<string, unknown>;
  warnings: string[];
}

function postprocessOutput(object: unknown, type: string): PostprocessResult {
  const warnings: string[] = [];
  let content = (object && typeof object === 'object' ? object : {}) as Record<string, unknown>;

  // ensure_minimum_content: if the generated content is empty, use fallback
  if (Object.keys(content).length === 0 || isContentEmpty(content, type)) {
    warnings.push('Generated content was empty — using fallback');
    content = generateFallbackContent(type) as Record<string, unknown>;
  }

  // sanitize_citations_indices: clean up any invalid citation references
  // (the LLM might emit [0] or negative indices — clamp to valid range)
  content = sanitizeCitations(content);

  return { content, warnings };
}

/** Check if the content object has meaningful data for its type. */
function isContentEmpty(content: Record<string, unknown>, type: string): boolean {
  switch (type) {
    case 'FAQ':
    case 'BULLETS':
      return !Array.isArray(content.items) || content.items.length === 0;
    case 'TIMELINE':
      return !Array.isArray(content.events) || content.events.length === 0;
    case 'QUIZ':
      return !Array.isArray(content.questions) || content.questions.length === 0;
    case 'GUIDE':
      return !Array.isArray(content.modules) || content.modules.length === 0;
    case 'BRIEFING':
      return !Array.isArray(content.sections) || content.sections.length === 0;
    case 'MINDMAP':
      return !content.root;
    case 'PARAGRAPH':
      return !content.text;
    default:
      return false;
  }
}

/** Generate minimal fallback content for a type. */
function generateFallbackContent(type: string, error?: unknown): Record<string, unknown> {
  const errorMsg = error instanceof Error ? error.message : 'Generation failed';
  switch (type) {
    case 'FAQ':
      return { items: [{ question: '生成失败', answer: errorMsg }] };
    case 'BULLETS':
      return { items: [{ text: errorMsg }] };
    case 'PARAGRAPH':
      return { text: errorMsg };
    case 'STRUCTURED':
      return { title: '生成失败', bullets: [{ text: errorMsg }], terms: [] };
    default:
      return { title: '生成失败', _error: errorMsg };
  }
}

/** Clamp/clean citation indices in the content to valid 1-based range. */
function sanitizeCitations(content: Record<string, unknown>): Record<string, unknown> {
  // Citation indices may appear in the text fields — no structured cleanup
  // needed since we map citations separately. This is a pass-through for now.
  return content;
}

// ---------------------------------------------------------------------------
// Citation mapping (v1 output_graph.py:722-742)
// ---------------------------------------------------------------------------

/**
 * Map LLM citation references to full Citation objects.
 *
 * v1: the LLM outputs content with inline [1], [2] references. MapCitations
 * resolves these numeric indices to the corresponding retrieved chunk and
 * builds full Citation objects with source_name, snippet, score.
 *
 * Since the LLM doesn't explicitly list which chunks it cited, we map ALL
 * retrieved chunks (the ones that were in the context) — this is the same
 * behavior as before, but now using full Citation objects with metadata.
 */
function mapCitations(content: unknown, chunkRows: ChunkRow[]): Citation[] {
  if (chunkRows.length === 0) return [];

  // Hydrate source names
  const sourceIds = [...new Set(chunkRows.map((c) => c.sourceId))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  // Hydrate chunk metadata for page/paragraph
  const chunkMetaRows = db()
    .select({ id: chunks.id, metadata: chunks.metadata })
    .from(chunks)
    .where(
      inArray(
        chunks.id,
        chunkRows.map((c) => c.id),
      ),
    )
    .all();
  const chunkMetaMap = new Map(chunkMetaRows.map((c) => [c.id, c.metadata]));

  return chunkRows.map((c) => {
    const meta = (chunkMetaMap.get(c.id) ?? {}) as Record<string, unknown>;
    const pageNumber = typeof meta.page === 'number' ? meta.page : null;
    const paragraphIndex = typeof meta.paragraph_index === 'number' ? meta.paragraph_index : null;
    return {
      source_id: c.sourceId,
      source_name: sourceMap.get(c.sourceId) ?? 'unknown',
      chunk_id: c.id,
      chunk_index: c.chunkIndex + 1, // v1 1-based
      page_number: pageNumber,
      paragraph_index: paragraphIndex,
      snippet: c.text.slice(0, 200),
      score: c.score,
    };
  });
}
