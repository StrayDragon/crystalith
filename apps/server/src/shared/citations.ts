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
  chunk_id: number;
  source_id: number;
  chunk_index: number;
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
 * Hydrates `source_name` from the sources table and `page_number`/
 * `paragraph_index` from chunk metadata. Empty input returns `[]` without
 * hitting the DB. Behavior is identical to the previously-inlined blocks when
 * called with the matching `HydrateOptions`.
 */
export function hydrateCitations(
  retrieved: RetrievedChunk[],
  options: HydrateOptions = {},
): Citation[] {
  if (retrieved.length === 0) return [];
  const { trimSnippet = false, coercePageNumber = false } = options;

  const sourceIds = [...new Set(retrieved.map((c) => c.source_id))];
  const sourceRows = db()
    .select({ id: sources.id, filename: sources.filename })
    .from(sources)
    .where(inArray(sources.id, sourceIds))
    .all();
  const sourceNameMap = new Map(sourceRows.map((s) => [s.id, s.filename]));

  const chunkIds = retrieved.map((c) => c.chunk_id);
  const chunkRows = db()
    .select({ id: chunks.id, metadata: chunks.metadata })
    .from(chunks)
    .where(inArray(chunks.id, chunkIds))
    .all();
  const chunkMetaMap = new Map(chunkRows.map((c) => [c.id, c.metadata]));

  return retrieved.map((c) => {
    const meta = (chunkMetaMap.get(c.chunk_id) ?? {}) as Record<string, unknown>;
    const snippet = trimSnippet ? c.text.trim().slice(0, 200) : c.text.slice(0, 200);
    return {
      source_id: c.source_id,
      source_name: sourceNameMap.get(c.source_id) ?? 'unknown',
      chunk_id: c.chunk_id,
      // v1 1-based
      chunk_index: c.chunk_index + 1,
      page_number: extractNumber(meta.page, coercePageNumber),
      paragraph_index: extractNumber(meta.paragraph_index, coercePageNumber),
      snippet,
      score: c.score,
    };
  });
}
