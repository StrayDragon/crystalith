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
    } catch (error) {
      // c42: RAG failure MUST propagate — do NOT dump all chunks (v1 has no such fallback)
      throw new Error(
        `Output retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      );
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
  // v1 output_graph.py:722-742. Build a citation map (1-based index → Citation).
  const { citations, citationMap } = buildCitationMap(chunkRows);

  // c42: recursively map citations INTO the content tree (v1 _map_citations).
  // Replaces numeric [1,3] arrays with full Citation dicts, then persists the mapped content.
  const mappedContent = mapCitationsIntoContent(postprocessed, citationMap, citations);

  // Persist — content now has resolved citation objects (not bare integers)
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: chunkRows.map((c) => c.id),
      content: mappedContent as Record<string, unknown>,
    })
    .returning()
    .get();

  return {
    outputId: row.id,
    type: input.type,
    content: mappedContent,
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

  // c42: per-type field-level backfill (v1 _ensure_minimum_content output_graph.py:290-375)
  content = ensureMinimumContentFields(content, type);

  return { content, warnings };
}

/**
 * c42: per-type field-level backfill (v1 output_graph.py:290-375).
 * Ensures required arrays/objects exist for each type instead of whole-object replacement.
 */
function ensureMinimumContentFields(
  content: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const ensureArray = (key: string): void => {
    if (!Array.isArray(content[key]) || (content[key] as unknown[]).length === 0) {
      content[key] = [];
    }
  };
  const ensureString = (key: string, fallback = ''): void => {
    if (typeof content[key] !== 'string' || !content[key]) {
      content[key] = fallback;
    }
  };

  switch (type) {
    case 'FAQ':
    case 'BULLETS':
      ensureArray('items');
      break;
    case 'TIMELINE':
      ensureArray('events');
      break;
    case 'QUIZ':
      ensureArray('questions');
      break;
    case 'GUIDE':
      ensureArray('modules');
      ensureArray('examples');
      ensureArray('exercises');
      break;
    case 'BRIEFING':
      ensureArray('sections');
      ensureArray('points');
      break;
    case 'MINDMAP':
      if (!content.root || typeof content.root !== 'object') {
        content.root = { title: '', children: [] };
      }
      break;
    case 'PARAGRAPH':
      ensureString('text');
      break;
    case 'STRUCTURED':
      ensureArray('bullets');
      ensureArray('terms');
      break;
  }
  return content;
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

/** Generate fallback content matching v1 output_graph.py:198-287 exactly.
 * Uses friendly error note (not raw exception), `label` for MINDMAP,
 * `citations: []` on every leaf so mapCitationsIntoContent can attach fallback. */
function generateFallbackContent(type: string, error?: unknown): Record<string, unknown> {
  const errorNote = '⚠️ AI 模型生成失败，请稍后重试或使用更强大的模型。';
  const _fallback = true;
  // Use prompt as title when available (v1 uses the user's prompt)
  const title = error instanceof Error ? error.message.slice(0, 80) : '';

  switch (type) {
    case 'FAQ':
      return {
        items: [{ question: title || errorNote, answer: errorNote, citations: [] }],
        _fallback,
      };
    case 'GUIDE':
      return {
        modules: [
          {
            title: title || errorNote,
            objective: { text: errorNote, citations: [] },
            key_points: [],
            examples: [],
            exercises: [],
          },
        ],
        _fallback,
      };
    case 'TIMELINE':
      return {
        events: [{ date: '—', event: title || errorNote, description: errorNote, citations: [] }],
        _fallback,
      };
    case 'MINDMAP':
      return {
        root: { label: title || errorNote, citations: [], children: [] },
        _fallback,
      };
    case 'QUIZ':
      return {
        questions: [
          {
            type: 'short_answer',
            question: title || errorNote,
            options: [],
            answer: errorNote,
            explanation: '',
            citations: [],
          },
        ],
        _fallback,
      };
    case 'BRIEFING':
      return {
        sections: [{ heading: title || '生成失败', points: [{ text: errorNote, citations: [] }] }],
        _fallback,
      };
    case 'PARAGRAPH':
      return { text: errorNote, citations: [], _fallback };
    case 'BULLETS':
      return { items: [{ text: errorNote, citations: [] }], _fallback };
    case 'STRUCTURED':
      return {
        title: title || '生成失败',
        bullets: [{ text: errorNote, citations: [] }],
        terms: [],
        _fallback,
      };
    default:
      return { _fallback };
  }
}

// ---------------------------------------------------------------------------
// Citation mapping (v1 output_graph.py:108-195, 722-742)
// ---------------------------------------------------------------------------

/**
 * Build a 1-based citation map from retrieved chunks (v1 _build_citation).
 * Returns { citations: flat array, citationMap: index → Citation }.
 */
function buildCitationMap(chunkRows: ChunkRow[]): {
  citations: Citation[];
  citationMap: Map<number, Citation>;
} {
  if (chunkRows.length === 0) return { citations: [], citationMap: new Map() };

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

  const citationMap = new Map<number, Citation>();
  const citations: Citation[] = chunkRows.map((c, i) => {
    const meta = (chunkMetaMap.get(c.id) ?? {}) as Record<string, unknown>;
    const pageNumber = typeof meta.page === 'number' ? meta.page : null;
    const paragraphIndex = typeof meta.paragraph_index === 'number' ? meta.paragraph_index : null;
    const citation: Citation = {
      source_id: c.sourceId,
      source_name: sourceMap.get(c.sourceId) ?? 'unknown',
      chunk_id: c.id,
      chunk_index: c.chunkIndex + 1, // v1 1-based
      page_number: pageNumber,
      paragraph_index: paragraphIndex,
      snippet: c.text.slice(0, 200),
      score: c.score,
    };
    citationMap.set(i + 1, citation); // 1-based index
    return citation;
  });

  return { citations, citationMap };
}

/**
 * Recursively map citation indices INTO the content tree (v1 _map_citations).
 *
 * Walks the content object; wherever a `citations` key holds a numeric array
 * like [1, 3], replaces it with the full Citation dicts from citationMap.
 * If indices don't resolve, falls back to the first citation (v1 behavior).
 */
function mapCitationsIntoContent(
  content: unknown,
  citationMap: Map<number, Citation>,
  fallback: Citation[],
): unknown {
  if (Array.isArray(content)) {
    return content.map((item) => mapCitationsIntoContent(item, citationMap, fallback));
  }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
      if (key === 'citations' && Array.isArray(value)) {
        // Resolve numeric indices to full Citation objects (v1 _resolve_citations)
        const indices = value
          .map((v) => (typeof v === 'number' && v > 0 ? v : null))
          .filter((v): v is number => v !== null);
        const resolved = indices
          .map((idx) => citationMap.get(idx))
          .filter((c): c is Citation => c !== undefined);
        // Fallback: if no indices resolved but we have citations, use the first (v1)
        result[key] = resolved.length > 0 ? resolved : fallback.length > 0 ? [fallback[0]!] : [];
      } else {
        result[key] = mapCitationsIntoContent(value, citationMap, fallback);
      }
    }
    return result;
  }
  return content;
}
