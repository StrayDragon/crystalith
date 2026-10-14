// Knowledge-base (global) search service (c132 r484/r488/r489).
//
// Fixed hybrid path over both retrieval channels with RRF fusion — it never
// reads per-notebook strategy configs (a notebook's retrieval preference must
// not hijack cross-notebook search). Scope is all-notebooks or one notebook.
// When the embedding index is unavailable (rebuilding / dim_mismatch /
// interrupted) or the embed gateway fails, the keyword channel still serves
// results with an explicit `degraded` reason (r488) — the search box never
// hard-fails on index state.
import type { SearchDegraded, SearchItem, SearchScope } from '@crystalith/shared';
import { eq, inArray } from 'drizzle-orm';

import { ftsSearch } from '../db/fts.ts';
import { client, db } from '../db/index.ts';
import { chunks, notebooks, sources } from '../db/schema.ts';
import { searchVectors } from '../db/vectors.ts';
import { getKnowledgeSearchSettings } from '../shared/config-settings.ts';
import { logger } from '../shared/logger.ts';
import { embedSingle } from './embedder.ts';
import { getIndexState } from './index-rebuild.ts';
import { rrfFuseSeeds } from './multi-query.ts';
import type { ChunkResult } from './types.ts';

export type { SearchScope };
export type SearchDegradedReason = SearchDegraded;

export interface SearchFacets {
  notebooks: Array<{ notebookId: number; title: string; count: number }>;
  originTypes: Array<{ type: SearchItem['originType']; count: number }>;
}

export interface KnowledgeSearchResult {
  items: SearchItem[];
  facets: SearchFacets;
  degraded?: SearchDegradedReason;
}

export interface KnowledgeSearchOptions {
  topK?: number;
  minScore?: number;
  /** Which origin kinds to search; default = every indexed origin. */
  originTypes?: string[];
}

/** r488: index-unavailable states skip the KNN channel (never the request).
 * Global scope reads the global signals via notebook id 0 (active global job /
 * dim mismatch); notebook-specific interrupted markers only apply to that
 * notebook's scope. */
async function resolveDegradedReason(
  scope: SearchScope,
): Promise<SearchDegradedReason | undefined> {
  const state = await getIndexState(scope.kind === 'notebook' ? scope.notebookId : 0);
  if (state.state === 'rebuilding' || state.state === 'interrupted') return 'index_rebuilding';
  if (state.state === 'dim_mismatch') return 'dim_mismatch';
  return undefined;
}

/** Channel A — semantic KNN; throws propagate to the degrade path. */
async function knnChannel(
  query: string,
  scopeNotebookId: number | null,
  fetchK: number,
  originTypes: string[],
): Promise<ChunkResult[]> {
  const queryVec = await embedSingle(query);
  return (await searchVectors(db(), queryVec, scopeNotebookId, fetchK, undefined, originTypes)).map(
    (h) => ({
      chunkId: h.rowid,
      text: h.text,
      score: Math.max(0, 1 - h.distance),
      sourceId: h.source_id,
      chunkIndex: h.chunk_index,
    }),
  );
}

/** Channel B — keyword FTS (always available). */
async function keywordChannel(
  query: string,
  scopeNotebookId: number | null,
  fetchK: number,
  originTypes: string[],
): Promise<ChunkResult[]> {
  return (
    await ftsSearch(db(), query, { notebookId: scopeNotebookId, originTypes, topK: fetchK })
  ).map((h) => ({
    chunkId: h.chunkId,
    text: h.text,
    score: 1 / h.rank,
    sourceId: h.sourceId,
    chunkIndex: h.chunkIndex,
  }));
}

/** Enrich fused chunk ids with jump context (source + notebook titles). */
async function enrichItems(fused: ChunkResult[]): Promise<SearchItem[]> {
  if (fused.length === 0) return [];
  const rows = await client().all(
    db()
      .select({
        chunkId: chunks.id,
        text: chunks.text,
        originType: chunks.originType,
        originId: chunks.originId,
        sourceId: sources.id,
        sourceTitle: sources.filename,
        notebookId: notebooks.id,
        notebookTitle: notebooks.name,
        chunkIndex: chunks.chunkIndex,
        modality: chunks.modality,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(
        inArray(
          chunks.id,
          fused.map((f) => f.chunkId),
        ),
      ),
  );
  const rowById = new Map(rows.map((r) => [r.chunkId, r]));
  const items: SearchItem[] = [];
  for (const f of fused) {
    const row = rowById.get(f.chunkId);
    if (!row) continue;
    // DB column is free text; the write seam only ever stores the two wire
    // values — narrow it here so the wire enum holds without a cast.
    const originType: SearchItem['originType'] = row.originType === 'output' ? 'output' : 'source';
    items.push({ ...row, originType, score: f.score });
  }
  return items;
}

/** Grouping context over the final items (r484 facets). */
function buildFacets(items: SearchItem[]): SearchFacets {
  const byNotebook = new Map<number, { title: string; count: number }>();
  const byOrigin = new Map<SearchItem['originType'], number>();
  for (const item of items) {
    const nb = byNotebook.get(item.notebookId) ?? { title: item.notebookTitle, count: 0 };
    nb.count++;
    byNotebook.set(item.notebookId, nb);
    byOrigin.set(item.originType, (byOrigin.get(item.originType) ?? 0) + 1);
  }
  return {
    notebooks: [...byNotebook.entries()].map(([notebookId, v]) => ({
      notebookId,
      title: v.title,
      count: v.count,
    })),
    originTypes: [...byOrigin.entries()].map(([type, count]) => ({ type, count })),
  };
}

/**
 * Run a knowledge-base search. SQL lives behind db/vectors.ts + db/fts.ts
 * (dialect-neutral; c129 pg backend swaps those two, not this service).
 */
export async function knowledgeSearch(
  query: string,
  scope: SearchScope,
  opts: KnowledgeSearchOptions = {},
): Promise<KnowledgeSearchResult> {
  const cfg = getKnowledgeSearchSettings();
  const requested = opts.topK ?? cfg.default_top_k;
  const topK = Math.max(1, Math.min(requested, cfg.max_top_k));
  const minScore = opts.minScore ?? 0;
  const originTypes = opts.originTypes?.length ? opts.originTypes : ['source', 'output'];
  const scopeNotebookId = scope.kind === 'notebook' ? scope.notebookId : null;

  const startedAt = Date.now();
  let degraded = await resolveDegradedReason(scope);

  let knnHits: ChunkResult[] = [];
  if (!degraded) {
    try {
      knnHits = await knnChannel(query, scopeNotebookId, topK * 2, originTypes);
    } catch (error) {
      logger.warn('[search] semantic channel unavailable, degrading to keyword-only:', error);
      degraded = 'embed_unavailable';
    }
  }
  const ftsHits = await keywordChannel(query, scopeNotebookId, topK * 2, originTypes);

  // RRF fusion (same k=60 semantics as the multi-query path), then cut to the
  // clamped topK — channels over-fetch (topK*2) as fusion headroom.
  const fused = rrfFuseSeeds([knnHits, ftsHits], topK * 2)
    .filter((r) => r.score >= minScore)
    .slice(0, topK);
  const items = await enrichItems(fused);
  const facets = buildFacets(items);

  const durationMs = Date.now() - startedAt;
  if (durationMs > cfg.budget_ms) {
    logger.warn(`[search] over budget: ${durationMs}ms > ${cfg.budget_ms}ms (scope=${scope.kind})`);
  }

  return {
    items,
    facets,
    ...(degraded ? { degraded } : {}),
  };
}
