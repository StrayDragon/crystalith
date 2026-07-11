// Citation context — neighborhood evidence review (c26).
//
// Resolves a target chunk by chunk_id or (source_id + chunk_index),
// fetches neighboring chunks within the same source, and returns them
// as a before/chunk/after window. Chunk metadata (page_number, paragraph_index)
// is extracted from the json metadata column.
//
// Corresponds to v1 `features/citations/api.py:55-133`:
//   _to_context_chunk, _to_citation, get_citation_context.
import { and, between, eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CitationContextChunk {
  chunk_id: number;
  chunk_index: number; // 1-based for v1 API compatibility
  text: string; // full text (v1 returns untruncated)
  page_number: number | null;
  paragraph_index: number | null;
}

export interface CitationContextResult {
  citation: CitationContextChunk & {
    source_id: number;
    source_name: string;
    snippet: string;
    score: number | null;
  };
  before: CitationContextChunk[];
  chunk: CitationContextChunk;
  after: CitationContextChunk[];
}

// ---------------------------------------------------------------------------
// Metadata helpers — mirrors v1 shared/utils/chunk.py
// ---------------------------------------------------------------------------

type ChunkMetadata = Record<string, unknown> | null;

function extractPageNumber(metadata: ChunkMetadata): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const page = (metadata as Record<string, unknown>).page;
  return typeof page === 'number' ? page : null;
}

function extractParagraphIndex(metadata: ChunkMetadata): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const pi = (metadata as Record<string, unknown>).paragraph_index;
  return typeof pi === 'number' ? pi : null;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Resolve a chunk by chunk_id. Returns the chunk and its source. */
async function resolveByChunkId(
  chunkId: number,
  notebookId: number,
): Promise<{ chunk: typeof chunks.$inferSelect; source: typeof sources.$inferSelect } | null> {
  const rows = db()
    .select()
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(and(eq(chunks.id, chunkId), eq(sources.notebookId, notebookId)))
    .all();

  if (rows.length === 0) return null;
  const row = rows[0];
  return { chunk: row.chunks, source: row.sources };
}

/** Resolve a chunk by (source_id, 1-based chunk_index). */
async function resolveBySourceIndex(
  sourceId: number,
  chunkIndex: number,
  notebookId: number,
): Promise<{ chunk: typeof chunks.$inferSelect; source: typeof sources.$inferSelect } | null> {
  const zeroBased = chunkIndex - 1; // API is 1-based, DB is 0-based
  const rows = db()
    .select()
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(
      and(
        eq(chunks.sourceId, sourceId),
        eq(chunks.chunkIndex, zeroBased),
        eq(sources.notebookId, notebookId),
      ),
    )
    .all();

  if (rows.length === 0) return null;
  const row = rows[0];
  return { chunk: row.chunks, source: row.sources };
}

// ---------------------------------------------------------------------------
// Context building
// ---------------------------------------------------------------------------

/**
 * Build the neighborhood context window for a target chunk.
 *
 * Fetches up to `neighbors` chunks before and after the target (by chunk_index
 * within the same source), then returns a CitationContextResult.
 */
export async function resolveChunkContext(
  notebookId: number,
  opts: {
    chunkId?: number;
    sourceId?: number;
    chunkIndex?: number;
    neighborsBefore?: number;
    neighborsAfter?: number;
  },
): Promise<CitationContextResult> {
  const before = opts.neighborsBefore ?? 1;
  const after = opts.neighborsAfter ?? 1;

  // Resolve target
  let target: { chunk: typeof chunks.$inferSelect; source: typeof sources.$inferSelect } | null;
  if (opts.chunkId !== undefined) {
    target = await resolveByChunkId(opts.chunkId, notebookId);
  } else if (opts.sourceId !== undefined && opts.chunkIndex !== undefined) {
    target = await resolveBySourceIndex(opts.sourceId, opts.chunkIndex, notebookId);
  } else {
    throw new Error('Internal: missing resolution params');
  }

  if (!target) return { citation: {} as any, before: [], chunk: {} as any, after: [] };

  // Fetch window: chunk_index in [target - before, target + after]
  const lower = Math.max(0, target.chunk.chunkIndex - before);
  const upper = target.chunk.chunkIndex + after;

  const windowRows = db()
    .select()
    .from(chunks)
    .where(and(eq(chunks.sourceId, target.source.id), between(chunks.chunkIndex, lower, upper)))
    .orderBy(chunks.chunkIndex)
    .all();

  // Partition into before / current / after
  const beforeChunks: CitationContextChunk[] = [];
  const afterChunks: CitationContextChunk[] = [];
  let currentChunk: CitationContextChunk = toContextChunk(target.chunk);

  for (const item of windowRows) {
    if (item.id === target.chunk.id) {
      currentChunk = toContextChunk(item);
      continue;
    }
    const ctx = toContextChunk(item);
    if (item.chunkIndex < target.chunk.chunkIndex) {
      beforeChunks.push(ctx);
    } else {
      afterChunks.push(ctx);
    }
  }

  return {
    citation: {
      ...toContextChunk(target.chunk),
      source_id: target.source.id,
      source_name: target.source.filename,
      snippet: (target.chunk.text ?? '').slice(0, 200),
      score: null,
    },
    before: beforeChunks,
    chunk: currentChunk,
    after: afterChunks,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toContextChunk(chunk: typeof chunks.$inferSelect): CitationContextChunk {
  const meta = chunk.metadata as ChunkMetadata;
  return {
    chunk_id: chunk.id,
    chunk_index: chunk.chunkIndex + 1, // 1-based (v1 compat)
    text: chunk.text ?? '', // full text (v1 returns untruncated — c39 gap fix)
    page_number: extractPageNumber(meta),
    paragraph_index: extractParagraphIndex(meta),
  };
}
