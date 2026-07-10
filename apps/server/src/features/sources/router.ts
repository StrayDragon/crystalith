import { SourceSchema } from '@crystalith/shared';
// Sources CRUD + upload router — /v2/sources, /v2/notebooks/:nid/sources
//
// Mirrors v1 `features/sources/api.py` + `features/sources/api_ingest.py`.
import { and, desc, eq, sql } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import {
  chunks,
  notebookExtractorPolicies,
  sources,
  sourceTags,
  sourceTagMap,
} from '../../db/schema.ts';
import { deleteSourceVectors } from '../../db/vectors.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { getSecurityPolicy, getUploadMaxBytes } from '../../shared/config.ts';
import { extractUrl } from '../../shared/extraction/factory.ts';
import { validateUrlForFetch } from '../../shared/net/url-safety.ts';
import { uploadDedupKey, urlDedupKey } from './dedup.ts';
import { listParsers } from './parser-registry.ts';
import { ingestSource } from './pipeline.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sources',
    method: 'get',
    summary: 'List sources in a notebook',
    tags: ['sources'],
    responses: {
      200: { description: 'List of sources', body: SourceSchema.array() },
    },
  },
  {
    path: '/v2/sources/upload',
    method: 'post',
    summary: 'Upload a file and ingest it',
    tags: ['sources'],
    responses: {
      201: { description: 'Ingestion result' },
    },
  },
  {
    path: '/v2/sources/:id',
    method: 'get',
    summary: 'Get a source by ID with chunks',
    tags: ['sources'],
    responses: { 200: { description: 'Source details', body: SourceSchema } },
  },
  {
    path: '/v2/sources/:id',
    method: 'delete',
    summary: 'Delete a source and its chunks/vectors',
    tags: ['sources'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/sources/parsers',
    method: 'get',
    summary: 'List available parsers',
    tags: ['sources'],
    responses: { 200: { description: 'Parser list' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSource(row: {
  id: number;
  notebookId: number;
  filename: string;
  mimeType: string | null;
  parserType: string;
  metadata: unknown;
  dedupKey: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  recoveryHint: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chunkCount?: number;
  tags?: string[];
}) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    filename: row.filename,
    mime_type: row.mimeType,
    parser_type: row.parserType,
    metadata: row.metadata as Record<string, unknown> | null | undefined,
    dedup_key: row.dedupKey,
    status: row.status as 'processing' | 'ready' | 'failed',
    error_code: row.errorCode,
    error_message: row.errorMessage,
    recovery_hint: row.recoveryHint,
    last_error_at: row.lastErrorAt?.toISOString() ?? undefined,
    chunk_count: row.chunkCount ?? 0,
    tags: row.tags ?? [],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function sourceNotFound(id: number): never {
  throw new NotFoundError(`Source ${id} not found`);
}

/** Enrich source rows with chunk counts and tags. */
function enrichSources(
  rows: Array<{
    id: number;
    notebookId: number;
    filename: string;
    mimeType: string | null;
    parserType: string;
    metadata: unknown;
    dedupKey: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    recoveryHint: string | null;
    lastErrorAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return rows.map((row) => {
    // Get chunk count
    const c = db()
      .select({ c: sql<number>`COUNT(*)` })
      .from(chunks)
      .where(eq(chunks.sourceId, row.id))
      .get();
    const chunkCount = c?.c ?? 0;

    // Get tags
    const tagRows = db()
      .select({ name: sourceTags.name })
      .from(sourceTagMap)
      .innerJoin(sourceTags, eq(sourceTagMap.tagId, sourceTags.id))
      .where(eq(sourceTagMap.sourceId, row.id))
      .all();
    const tags = tagRows.map((t) => t.name);

    return serializeSource({ ...row, chunkCount, tags });
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourcesRouter = new Elysia({ prefix: '/v2' })
  // List sources for a notebook
  .get('/notebooks/:nid/sources', ({ params }) => {
    const nid = Number(params.nid);
    const rows = db()
      .select()
      .from(sources)
      .where(eq(sources.notebookId, nid))
      .orderBy(desc(sources.updatedAt))
      .all();
    return enrichSources(rows);
  })

  // Upload + ingest a file
  .post('/sources/upload', async ({ body, query, set }) => {
    const notebookId = Number(query?.notebook_id);
    const dedupAction = ((query as Record<string, string> | undefined)?.dedup_action ??
      'create_new') as 'prompt' | 'reuse' | 'create_new';
    if (!notebookId) throw new NotFoundError('notebook_id query param is required');

    // body is FormData; Elysia parses multipart into { filename, file }
    const file = (body as { file?: File }).file;
    if (!file) throw new NotFoundError('No file provided');

    // Upload size limit (configurable, default 50 MB).
    const maxBytes = getUploadMaxBytes();
    if (file.size > maxBytes) {
      set.status = 413;
      return { error: 'Payload Too Large', max_bytes: maxBytes, uploaded_bytes: file.size };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Dedup check.
    const dedupKey = uploadDedupKey(buffer);
    if (dedupAction !== 'create_new') {
      const hit = db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.notebookId, notebookId), eq(sources.dedupKey, dedupKey)))
        .get();
      if (hit) {
        if (dedupAction === 'prompt') {
          set.status = 409;
          return { error_code: 'SOURCE_DEDUP_HIT', existing_source_id: hit.id };
        }
        if (dedupAction === 'reuse') {
          const existing = db().select().from(sources).where(eq(sources.id, hit.id)).get();
          return { reused: true, source: existing };
        }
      }
    }

    const result = await ingestSource({
      buffer,
      filename: file.name,
      notebookId,
      mimeType: file.type,
      dedupKey,
    });

    return result;
  })

  // Get a source by ID
  .get('/sources/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);

    const c = db()
      .select({ c: sql<number>`COUNT(*)` })
      .from(chunks)
      .where(eq(chunks.sourceId, id))
      .get();
    const chunkCount = c?.c ?? 0;

    const tagRows = db()
      .select({ name: sourceTags.name })
      .from(sourceTagMap)
      .innerJoin(sourceTags, eq(sourceTagMap.tagId, sourceTags.id))
      .where(eq(sourceTagMap.sourceId, id))
      .all();
    const tags = tagRows.map((t) => t.name);

    return serializeSource({ ...row, chunkCount, tags });
  })

  // Delete a source
  .delete('/sources/:id', ({ params, set }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);

    // Delete vectors first
    deleteSourceVectors(db(), id);

    // Delete source (cascades to chunks via FK)
    db().delete(sources).where(eq(sources.id, id)).run();

    // Invalidate cached retrievals for the source's notebook.
    if (row.notebookId) bumpSourcesEpoch(row.notebookId);

    set.status = 204;
    return '';
  })

  // List available parsers
  .get('/sources/parsers', () => {
    return listParsers().map((p) => ({
      id: p.id,
      name: p.name,
      mime_types: p.mimeTypes,
      extensions: p.extensions,
    }));
  })

  // Tag CRUD
  .get('/notebooks/:nid/sources/tags', ({ params }) => {
    const nid = Number(params.nid);
    return db()
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.notebookId, nid))
      .all()
      .map((t) => ({
        id: t.id,
        notebook_id: t.notebookId,
        name: t.name,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      }));
  })

  .post('/notebooks/:nid/sources/tags', ({ params, body }) => {
    const nid = Number(params.nid);
    const { name } = body as { name: string };
    const row = db().insert(sourceTags).values({ notebookId: nid, name }).returning().get();
    return {
      id: row.id,
      notebook_id: row.notebookId,
      name: row.name,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  })

  .patch('/notebooks/:nid/sources/tags/:tid', ({ params, body }) => {
    const tid = Number(params.tid);
    const { name } = body as { name: string };
    const existing = db().select().from(sourceTags).where(eq(sourceTags.id, tid)).get();
    if (!existing) throw new NotFoundError(`Tag ${tid} not found`);
    db().update(sourceTags).set({ name }).where(eq(sourceTags.id, tid)).run();
    const updated = db().select().from(sourceTags).where(eq(sourceTags.id, tid)).get();
    return {
      id: updated!.id,
      notebook_id: updated!.notebookId,
      name: updated!.name,
      created_at: updated!.createdAt.toISOString(),
      updated_at: updated!.updatedAt.toISOString(),
    };
  })

  .delete('/notebooks/:nid/sources/tags/:tid', ({ params, set }) => {
    const tid = Number(params.tid);
    db().delete(sourceTags).where(eq(sourceTags.id, tid)).run();
    set.status = 204;
    return '';
  })

  .post('/notebooks/:nid/sources/tags/:tid/sources', ({ params, body }) => {
    const tid = Number(params.tid);
    const { source_ids } = body as { source_ids: number[] };
    for (const sid of source_ids) {
      db().insert(sourceTagMap).values({ sourceId: sid, tagId: tid }).run();
    }
    return { tag_id: tid, source_ids, applied: source_ids.length };
  })

  .delete('/notebooks/:nid/sources/tags/:tid/sources', ({ params, body }) => {
    const tid = Number(params.tid);
    const { source_ids } = body as { source_ids: number[] };
    for (const sid of source_ids) {
      db()
        .delete(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
        .run();
    }
    return { tag_id: tid, source_ids, removed: source_ids.length };
  })

  // Get source chunks
  .get('/sources/:id/chunks', ({ params }) => {
    const id = Number(params.id);
    const rows = db()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, id))
      .orderBy(chunks.chunkIndex)
      .all();
    return rows.map((c) => ({
      id: c.id,
      chunk_index: c.chunkIndex,
      text: c.text,
      start_offset: c.startOffset,
      end_offset: c.endOffset,
      metadata: c.metadata,
    }));
  })

  // Re-embed a source
  .post('/sources/:id/re-embed', async ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);
    // Trigger re-embed via embed strategy (fire-and-forget)
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    deleteSourceVectors(db(), id);
    await strategy.indexSource(id, row.notebookId);
    return { source_id: id, re_embedded: true };
  })

  // Search sources (placeholder — delegates to embed strategy)
  .post('/notebooks/:nid/sources/search', async ({ params, body }) => {
    const nid = Number(params.nid);
    const { query, engine } = body as { query: string; engine?: string };
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    const results = await strategy.retrieve(query, nid, { topK: 10 });
    return {
      status: 'ok',
      query,
      engine: engine ?? 'Web',
      results: results.map((r) => ({
        chunk_id: r.chunk_id,
        source_id: r.source_id,
        text: r.text.slice(0, 200),
        score: r.score,
      })),
    };
  })

  // Batch delete sources
  .post('/notebooks/:nid/sources/batch/delete', ({ body }) => {
    const { source_ids } = body as { source_ids: number[] };
    const deletedIds: number[] = [];
    for (const sid of source_ids) {
      const row = db().select().from(sources).where(eq(sources.id, sid)).get();
      if (row) {
        deleteSourceVectors(db(), sid);
        db().delete(sources).where(eq(sources.id, sid)).run();
        deletedIds.push(sid);
      }
    }
    return { deleted_ids: deletedIds, deleted_count: deletedIds.length };
  })

  // Batch re-embed sources
  .post('/notebooks/:nid/sources/batch/re-embed', async ({ params, body }) => {
    const nid = Number(params.nid);
    const { source_ids } = body as { source_ids: number[] };
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    const reembedded: number[] = [];
    const failed: number[] = [];
    for (const sid of source_ids) {
      try {
        deleteSourceVectors(db(), sid);
        await strategy.indexSource(sid, nid);
        reembedded.push(sid);
      } catch {
        failed.push(sid);
      }
    }
    return {
      reembedded_ids: reembedded,
      failed_ids: failed,
      reembedded_count: reembedded.length,
      failed_count: failed.length,
    };
  })

  // Ingest from URL
  .post('/notebooks/:nid/sources/from-url', async ({ params, body, query, set }) => {
    const nid = Number(params.nid);
    const { url } = body as { url: string; mode?: string; title?: string };
    const dedupAction = ((query as Record<string, string> | undefined)?.dedup_action ??
      'create_new') as 'prompt' | 'reuse' | 'create_new';

    // SSRF guard: validate URL before fetch.
    try {
      await validateUrlForFetch(url, getSecurityPolicy());
    } catch (error) {
      set.status = 422;
      return { error: 'SSRF blocked', reason: (error as Error).message };
    }

    // Dedup check.
    const dedupKey = urlDedupKey(url);
    if (dedupAction !== 'create_new') {
      const hit = db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.notebookId, nid), eq(sources.dedupKey, dedupKey)))
        .get();
      if (hit) {
        if (dedupAction === 'prompt') {
          set.status = 409;
          return { error_code: 'SOURCE_DEDUP_HIT', existing_source_id: hit.id };
        }
        if (dedupAction === 'reuse') {
          const existing = db().select().from(sources).where(eq(sources.id, hit.id)).get();
          return { reused: true, source: existing };
        }
      }
    }

    // Fetch URL content via extractor factory (with SSRF guard already passed).
    try {
      const extracted = await extractUrl(url, {});
      const buffer = new TextEncoder().encode(extracted.content);
      const result = await ingestSource({
        buffer,
        filename: extracted.title || url.split('/').pop() || 'webpage.html',
        notebookId: nid,
        mimeType: 'text/html',
        dedupKey,
      });
      return { ...result, extracted_by: extracted.extractorUsed, title: extracted.title };
    } catch {
      // Fallback to raw fetch if extractors all fail.
      const response = await fetch(url);
      const html = await response.text();
      const buffer = new TextEncoder().encode(html);
      const result = await ingestSource({
        buffer,
        filename: url.split('/').pop() || 'webpage.html',
        notebookId: nid,
        mimeType: 'text/html',
        dedupKey,
      });
      return result;
    }
  })

  // Extractor policy routes
  .get('/notebooks/:nid/extractors', ({ params }) => {
    const nid = Number(params.nid);
    const policy = db()
      .select()
      .from(notebookExtractorPolicies)
      .where(eq(notebookExtractorPolicies.notebookId, nid))
      .get();
    return policy ?? { notebookId: nid, mode: 'inherit_global', enabledExtractors: null };
  })
  .patch('/notebooks/:nid/extractors', ({ params, body }) => {
    const nid = Number(params.nid);
    const { mode, enabled_extractors } = body as {
      mode?: string;
      enabled_extractors?: string[];
    };
    const existing = db()
      .select()
      .from(notebookExtractorPolicies)
      .where(eq(notebookExtractorPolicies.notebookId, nid))
      .get();
    if (existing) {
      db()
        .update(notebookExtractorPolicies)
        .set({
          mode: mode ?? existing.mode,
          enabledExtractors: enabled_extractors ?? existing.enabledExtractors,
        })
        .where(eq(notebookExtractorPolicies.notebookId, nid))
        .run();
    } else {
      db()
        .insert(notebookExtractorPolicies)
        .values({
          notebookId: nid,
          mode: mode ?? 'inherit_global',
          enabledExtractors: enabled_extractors ?? null,
        })
        .run();
    }
    const updated = db()
      .select()
      .from(notebookExtractorPolicies)
      .where(eq(notebookExtractorPolicies.notebookId, nid))
      .get();
    return updated;
  });

registerApiDoc(apiDocs);
