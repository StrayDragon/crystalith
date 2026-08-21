// Shared citation hydration helper.
//
// qa/refine/outputs each previously inlined near-identical logic to turn
// retrieved chunks into Citation objects: fetch source filenames, fetch chunk
// metadata, assemble 1-based chunk_index + page_number/paragraph_index +
// snippet. This module collapses those duplicates into one helper while
// preserving each call-site's exact behavior (snippet trimming and the page
// extraction predicate differ slightly — see `HydrateOptions`).
import type { Citation } from '@crystalith/shared';
import { inArray } from 'drizzle-orm';

import { db } from '../db/index.ts';
import { chunks, sources } from '../db/schema.ts';

/**
 * Input chunk — the minimal fields every retrieval path already carries.
 * `chunk_index` is the stored 0-based index; the emitted Citation uses the
 * v1 1-based form (`chunk_index + 1`).
 */
export interface RetrievedChunk {
  chunkId: number;
  sourceId: number;
  chunkIndex: number;
  text: string;
  score: number;
}

/**
 * Per-call-site behavior switches.
 *
 * - `trimSnippet`: refine trims before slicing (`.trim().slice(0, 200)`);
 *   qa/outputs slice without trimming. Default `false` matches qa/outputs.
 * - `coercePageNumber`: refine's `extractPageNumber` uses `Number(...)` +
 *   `Number.isFinite` (accepts numeric strings); qa/outputs use the stricter
 *   `typeof === 'number'` predicate. Default `false` matches qa/outputs.
 */
export interface HydrateOptions {
  trimSnippet?: boolean;
  coercePageNumber?: boolean;
}

function extractNumber(value: unknown, coerce: boolean): number | null {
  if (coerce) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return typeof value === 'number' ? value : null;
}

/**
 * Resolve retrieved chunks into Citation objects.
 *
 * Hydrates `sourceName` from the sources table and `pageNumber`/
 * `paragraphIndex` from chunk metadata. Empty input returns `[]` without
 * hitting the DB. Behavior is identical to the previously-inlined blocks when
 * called with the matching `HydrateOptions`.
 */
export function hydrateCitations(
  retrieved: RetrievedChunk[],
  options: HydrateOptions = {},
): Citation[] {
  if (retrieved.length === 0) return [];
  const { trimSnippet = false, coercePageNumber = false } = options;

  const sourceIds = [...new Set(retrieved.map((c) => c.sourceId))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceNameMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const chunkIds = retrieved.map((c) => c.chunkId);
  const chunkRows = db()
    .select({ id: chunks.id, metadata: chunks.metadata })
    .from(chunks)
    .where(inArray(chunks.id, chunkIds))
    .all();
  const chunkMetaMap = new Map(chunkRows.map((c) => [c.id, c.metadata]));

  return retrieved.map((c) => {
    const meta = chunkMetaMap.get(c.chunkId) ?? {};
    const snippet = trimSnippet ? c.text.trim().slice(0, 200) : c.text.slice(0, 200);
    return {
      sourceId: c.sourceId,
      sourceName: sourceNameMap.get(c.sourceId) ?? 'unknown',
      chunkId: c.chunkId,
      // v1 1-based
      chunkIndex: c.chunkIndex + 1,
      pageNumber: extractNumber(meta.page, coercePageNumber),
      paragraphIndex: extractNumber(meta.paragraph_index, coercePageNumber),
      snippet,
      score: c.score,
    };
  });
}

/**
 * Format citation lines for markdown export (v1 _format_citation_line,
 * api.py:599-610 / api.py:452-461):
 *   [N] name · chunk N[ · page N][ · para N]
 *   > snippet
 * Defensive on optional fields so both QA and output exports share one impl.
 */
export function formatCitationMarkdownLines(
  citations: Array<{
    sourceName?: string;
    chunkIndex?: number;
    pageNumber?: number | null;
    paragraphIndex?: number | null;
    snippet?: string;
  }>,
): string[] {
  return citations.map((c, i) => {
    const parts = [`[${i + 1}] ${c.sourceName ?? 'unknown'}`];
    if (typeof c.chunkIndex === 'number') parts.push(`chunk ${c.chunkIndex}`);
    if (c.pageNumber !== null && c.pageNumber !== undefined) parts.push(`page ${c.pageNumber}`);
    if (c.paragraphIndex !== null && c.paragraphIndex !== undefined)
      parts.push(`para ${c.paragraphIndex}`);
    const line = parts.join(' · ');
    const snippet = c.snippet?.trim();
    return snippet ? `${line}\n> ${snippet}` : line;
  });
}

/** Joined citation block; `无引用` when empty. */
export function formatCitationBlock(
  citations: Parameters<typeof formatCitationMarkdownLines>[0],
): string {
  const lines = formatCitationMarkdownLines(citations);
  return lines.length ? lines.join('\n\n') : '无引用';
}
