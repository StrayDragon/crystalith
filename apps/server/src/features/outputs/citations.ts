// Citation mapping (v1 output_graph.py:108-195, 722-742) +
// c50: citation index sanitization (v1 output_postprocess.py:293-346) +
// _postprocessed marker (v1 output_postprocess.py:377).

import type { Citation } from '@crystalith/shared';

import { hydrateCitations } from '../../shared/citations.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface ChunkRow {
  id: number;
  text: string;
  sourceId: number;
  chunkIndex: number;
  score: number;
}

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
    chunkId: c.id,
    sourceId: c.sourceId,
    chunkIndex: c.chunkIndex,
    text: c.text,
    score: c.score,
  }));
  const citations = hydrateCitations(retrieved);

  const citationMap = new Map<number, Citation>();
  // 1-based index
  citations.forEach((citation, i) => citationMap.set(i + 1, citation));

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
  if (isRecord(content)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(content)) {
      if (key === 'citations' && Array.isArray(value)) {
        // Resolve numeric indices to full Citation objects (v1 _resolve_citations)
        const indices = value
          .map((v) => (typeof v === 'number' && v > 0 ? v : null))
          .filter((v): v is number => v !== null);
        const resolved = indices
          .map((idx) => citationMap.get(idx))
          .filter((c): c is Citation => c !== undefined);
        // Fallback: if no indices resolved but we have citations, use the first (v1)
        result[key] = resolved.length > 0 ? resolved : fallback.length > 0 ? [fallback[0]] : [];
      } else {
        result[key] = mapCitationsIntoContent(value, citationMap, fallback);
      }
    }
    return result;
  }
  return content;
}

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
export function sanitizeCitationsIndices(
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
  if (isRecord(payload)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
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
      // out of range
      didChange = true;
      continue;
    }
    if (seen.has(item)) {
      // duplicate
      didChange = true;
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
export function markPostprocessed(
  content: unknown,
  _postprocessed: boolean,
  warnings: string[],
): unknown {
  if (isRecord(content)) {
    const result = { ...content };
    result._postprocessed = true;
    if (warnings.length > 0) result._warnings = warnings;
    return result;
  }
  return content;
}

export { buildCitationMap, mapCitationsIntoContent };
