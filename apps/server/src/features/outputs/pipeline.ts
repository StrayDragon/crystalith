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
import { hydrateCitations } from '../../shared/citations.ts';
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
        object = repaired; // accept the repaired output
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
  const finalContent = markPostprocessed(
    mappedContent,
    sanitized.changed || warnings.length > 0,
    allWarnings,
  );

  // Persist — content now has resolved citation objects (not bare integers)
  const row = db()
    .insert(outputs)
    .values({
      notebookId: input.notebookId,
      type: input.type,
      prompt: input.prompt ?? null,
      chunkIds: chunkRows.map((c) => c.id),
      content: finalContent as Record<string, unknown>,
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

  // Detect "no content found" template responses from AI and convert to fallback.
  // When the AI has no relevant context, it often generates a polite "not found"
  // message as the first item instead of failing. These should be treated as
  // generation failures so the frontend shows the error+retry UI.
  if (isNoContentTemplate(content, type)) {
    warnings.push('AI generated placeholder content instead of real output — using fallback');
    content = generateFallbackContent(type) as Record<string, unknown>;
  }

  // c42: per-type field-level backfill (v1 _ensure_minimum_content output_graph.py:290-375)
  content = ensureMinimumContentFields(content, type);

  return { content, warnings };
}

/**
 * c59: per-type nested structure backfill (v1 ensure_minimum_content,
 * output_postprocess.py:102-189). Unlike the old shallow ensureArray, this
 * backfills nested {text, citations:[1]} structures so incomplete content
 * carries a citation anchor instead of leaving bare [].
 */
export function ensureMinimumContentFields(
  content: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const ensureArray = (key: string): unknown[] => {
    if (!Array.isArray(content[key]) || (content[key] as unknown[]).length === 0) {
      content[key] = [];
    }
    return content[key] as unknown[];
  };
  const ensureString = (key: string, fallback = ''): void => {
    if (typeof content[key] !== 'string' || !content[key]) {
      content[key] = fallback;
    }
  };
  // A leaf entry that should carry a citation anchor
  const leaf = (text: string): Record<string, unknown> => ({ text, citations: [1] });

  switch (type) {
    case 'FAQ': {
      const items = ensureArray('items');
      for (const item of items) {
        if (item && typeof item === 'object' && !('citations' in item)) {
          (item as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'BULLETS': {
      const items = ensureArray('items');
      for (const item of items) {
        if (item && typeof item === 'object' && !('citations' in item)) {
          (item as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'TIMELINE': {
      const events = ensureArray('events');
      for (const ev of events) {
        if (ev && typeof ev === 'object' && !('citations' in ev)) {
          (ev as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'QUIZ': {
      const questions = ensureArray('questions');
      for (const q of questions) {
        if (q && typeof q === 'object' && !('citations' in q)) {
          (q as Record<string, unknown>).citations = [1];
        }
      }
      break;
    }
    case 'GUIDE': {
      const modules = ensureArray('modules');
      for (const mod of modules) {
        if (mod && typeof mod === 'object') {
          const m = mod as Record<string, unknown>;
          // backfill objective {text, citations:[1]}
          if (!m.objective || typeof m.objective !== 'object') {
            m.objective = leaf(String(m.title ?? ''));
          } else {
            const obj = m.objective as Record<string, unknown>;
            if (!Array.isArray(obj.citations)) obj.citations = [1];
          }
          // backfill key_points with at least one entry
          if (!Array.isArray(m.key_points) || (m.key_points as unknown[]).length === 0) {
            m.key_points = [leaf(String(m.title ?? ''))];
          }
          if (!Array.isArray(m.examples)) m.examples = [];
          if (!Array.isArray(m.exercises)) m.exercises = [];
        }
      }
      break;
    }
    case 'BRIEFING': {
      const sections = ensureArray('sections');
      for (const sec of sections) {
        if (sec && typeof sec === 'object') {
          const s = sec as Record<string, unknown>;
          if (!Array.isArray(s.points) || (s.points as unknown[]).length === 0) {
            s.points = [leaf(String(s.heading ?? ''))];
          }
        }
      }
      break;
    }
    case 'MINDMAP': {
      if (!content.root || typeof content.root !== 'object') {
        content.root = { label: '', citations: [], children: [] };
      }
      const root = content.root as Record<string, unknown>;
      if (!Array.isArray(root.citations)) root.citations = [1];
      if (!Array.isArray(root.children) || (root.children as unknown[]).length === 0) {
        root.children = [{ label: String(root.label ?? ''), citations: [1], children: [] }];
      }
      break;
    }
    case 'PARAGRAPH':
      ensureString('text');
      if (!Array.isArray(content.citations)) content.citations = [1];
      break;
    case 'STRUCTURED':
      ensureArray('bullets');
      ensureArray('terms');
      break;
  }
  return content;
}

/**
 * c50: detect whether generated output has salvageable-but-incomplete content
 * worth a second LLM pass (v1 `needs_repair`, output_postprocess.py:192-290).
 *
 * Returns false for fallback content (already errored) — no point repairing.
 * Returns true when the content is structurally present but has blank/missing
 * required fields (e.g. empty question text, missing module title).
 */
function needsRepair(type: string, content: unknown): boolean {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return true;
  const c = content as Record<string, unknown>;
  if (c._fallback === true) return false; // already a fallback — don't repair
  const isBlank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';
  const items = c.items;
  switch (type) {
    case 'FAQ':
    case 'BULLETS':
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.some(
        (it) =>
          !it ||
          typeof it !== 'object' ||
          isBlank((it as Record<string, unknown>).question) ||
          isBlank((it as Record<string, unknown>).answer) ||
          isBlank((it as Record<string, unknown>).text),
      );
    case 'TIMELINE':
      return !Array.isArray(c.events) || c.events.length === 0;
    case 'QUIZ':
      return !Array.isArray(c.questions) || c.questions.length === 0;
    case 'GUIDE':
      return !Array.isArray(c.modules) || c.modules.length === 0;
    case 'BRIEFING':
      return !Array.isArray(c.sections) || c.sections.length === 0;
    case 'MINDMAP':
      return !c.root || typeof c.root !== 'object';
    case 'PARAGRAPH':
      return isBlank(c.text);
    default:
      return false;
  }
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

/** Known prefixes that indicate AI generated a "no content found" template
 * instead of real content. Checked against the first item's text field. */
const NO_CONTENT_PREFIXES = [
  '由于您提供的上下文显示',
  '未找到相关内容',
  '未找到与',
  '无法生成',
  '以下提供标准',
];

/**
 * Detect whether AI-generated content is a "no content found" template response
 * rather than real content. The AI sometimes politely declines to generate when
 * context is insufficient, producing valid JSON with templated messages.
 * These should be treated as generation failures.
 */
function isNoContentTemplate(content: Record<string, unknown>, type: string): boolean {
  // Helper: check if a text value matches any known "not found" prefix
  const hasNoContentPrefix = (text: unknown): boolean => {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return NO_CONTENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  };

  switch (type) {
    case 'FAQ':
    case 'BULLETS': {
      const items = content.items;
      if (!Array.isArray(items) || items.length === 0) return false;
      const first = items[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return (
        hasNoContentPrefix(f.question) || hasNoContentPrefix(f.answer) || hasNoContentPrefix(f.text)
      );
    }
    case 'TIMELINE': {
      const events = content.events;
      if (!Array.isArray(events) || events.length === 0) return false;
      const first = events[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return hasNoContentPrefix(f.event) || hasNoContentPrefix(f.description);
    }
    case 'GUIDE': {
      const modules = content.modules;
      if (!Array.isArray(modules) || modules.length === 0) return false;
      const first = modules[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      // Objective could be {text: string} or raw string
      const obj = f.objective;
      const objText =
        typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>).text : obj;
      return hasNoContentPrefix(f.title) || hasNoContentPrefix(objText);
    }
    case 'BRIEFING': {
      const sections = content.sections;
      if (!Array.isArray(sections) || sections.length === 0) return false;
      const first = sections[0];
      if (!first || typeof first !== 'object') return false;
      const f = first as Record<string, unknown>;
      return hasNoContentPrefix(f.heading);
    }
    default:
      return false;
  }
}

/** Generate fallback content matching v1 output_graph.py:198-287 exactly.
 * Uses friendly error note (not raw exception), `label` for MINDMAP,
 * `citations: []` on every leaf so mapCitationsIntoContent can attach fallback.
 *
 * c59: title/question text comes from the user's `prompt` (truncated), NOT
 * error.message — v1 uses the user's prompt (output_postprocess.py:16). */
export function generateFallbackContent(
  type: string,
  prompt?: string,
  _error?: unknown,
): Record<string, unknown> {
  const errorNote = '⚠️ AI 模型生成失败，请稍后重试或使用更强大的模型。';
  const _fallback = true;
  // c59: use user prompt as visible title (v1 _fallback_output(prompt, ...))
  const title = (prompt || '').trim().slice(0, 200);

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
 *
 * Citation hydration delegates to the shared `hydrateCitations` helper
 * (`shared/citations.ts`); behavior is unchanged from the previously-inlined
 * version: snippet NOT trimmed, page/paragraph via the strict
 * `typeof === 'number'` predicate (no string coercion).
 */
function buildCitationMap(chunkRows: ChunkRow[]): {
  citations: Citation[];
  citationMap: Map<number, Citation>;
} {
  if (chunkRows.length === 0) return { citations: [], citationMap: new Map() };

  const retrieved = chunkRows.map((c) => ({
    chunk_id: c.id,
    source_id: c.sourceId,
    chunk_index: c.chunkIndex,
    text: c.text,
    score: c.score,
  }));
  const citations = hydrateCitations(retrieved);

  const citationMap = new Map<number, Citation>();
  citations.forEach((citation, i) => citationMap.set(i + 1, citation)); // 1-based index

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

// ---------------------------------------------------------------------------
// c50: citation index sanitization (v1 output_postprocess.py:293-346) +
// _postprocessed marker (v1 output_postprocess.py:377).
// ---------------------------------------------------------------------------

interface SanitizeResult {
  changed: boolean;
  warnings: string[];
}

/**
 * c50: recursively sanitize citation indices in the raw content tree BEFORE
 * mapCitationsIntoContent resolves them. Strips out-of-range, duplicate, and
 * non-integer indices (v1 sanitize_citations_indices, output_postprocess.py:293-346).
 *
 * Operates on the numeric `citations` arrays (e.g. [1, 99, 1, "x"] → [1]) so
 * downstream mapping only sees valid indices. Returns whether anything changed
 * + warnings for the consumer.
 */
function sanitizeCitationsIndices(
  payload: unknown,
  citationsCount: number,
): SanitizeResult & { sanitized: unknown } {
  const warnings: string[] = [];
  let changed = false;
  const sanitized = sanitizeRecursive(payload, citationsCount, warnings, () => {
    changed = true;
  });
  return { changed, warnings, sanitized };
}

function sanitizeRecursive(
  payload: unknown,
  maxIndex: number,
  warnings: string[],
  markChanged: () => void,
): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeRecursive(item, maxIndex, warnings, markChanged));
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (key === 'citations' && Array.isArray(value)) {
        const { clean, didChange } = sanitizeCitationList(value, maxIndex);
        if (didChange) {
          markChanged();
          warnings.push('citation indices sanitized (out-of-range/duplicate/non-integer removed)');
        }
        result[key] = clean;
      } else {
        result[key] = sanitizeRecursive(value, maxIndex, warnings, markChanged);
      }
    }
    return result;
  }
  return payload;
}

/** Sanitize a single citation index list (v1 _sanitize_citation_list). */
function sanitizeCitationList(
  value: unknown[],
  maxIndex: number,
): { clean: number[]; didChange: boolean } {
  if (maxIndex <= 0) return { clean: [], didChange: value.length > 0 };
  const seen = new Set<number>();
  const clean: number[] = [];
  let didChange = false;
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item)) {
      didChange = true;
      continue;
    }
    if (item <= 0 || item > maxIndex) {
      didChange = true; // out of range
      continue;
    }
    if (seen.has(item)) {
      didChange = true; // duplicate
      continue;
    }
    seen.add(item);
    clean.push(item);
  }
  if (!didChange && clean.length !== value.length) didChange = true;
  return { clean, didChange };
}

/**
 * c59: mark the content tree with `_postprocessed: true` unconditionally
 * (v1 output_postprocess.py:377 sets it on ALL content regardless of warnings).
 * `_warnings` carries the human-readable list (may be empty).
 */
function markPostprocessed(content: unknown, _postprocessed: boolean, warnings: string[]): unknown {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const result = { ...(content as Record<string, unknown>) };
    result._postprocessed = true;
    if (warnings.length > 0) result._warnings = warnings;
    return result;
  }
  return content;
}
