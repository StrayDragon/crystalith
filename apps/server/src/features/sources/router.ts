import {
  PatchNotebookExtractorPolicySchema,
  SourceBatchDeleteRequestSchema,
  SourceBatchReembedRequestSchema,
  SourceFromUrlRequestSchema,
  SourceSchema,
  SourceSearchRequestSchema,
  SourceTagBindingRequestSchema,
  SourceTagCreateSchema,
} from '@crystalith/shared';
// Sources CRUD + upload router — /v2/sources, /v2/notebooks/:nid/sources
//
// Mirrors v1 `features/sources/api.py` + `features/sources/api_ingest.py`.
import { and, eq, sql } from 'drizzle-orm';
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
import {
  config,
  getDedupEnabled,
  getSecurityPolicy,
  getUploadMaxBytes,
} from '../../shared/config.ts';
import { ErrorCode, sendError } from '../../shared/errors.ts';
import {
  extractUrl,
  extractors,
  getDefaultExtractor,
  listExtractorMetadata,
} from '../../shared/extraction/factory.ts';
import { requirePositiveIntId, requireOptionalPositiveIntId } from '../../shared/ids.ts';
import { fetchWithRedirectGuard } from '../../shared/net/fetch-with-redirect-guard.ts';
import { validateUrlForFetch, SsrfBlockedError } from '../../shared/net/url-safety.ts';
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
    notebookId: row.notebookId,
    filename: row.filename,
    mimeType: row.mimeType,
    parserType: row.parserType,
    metadata: row.metadata as Record<string, unknown> | null | undefined,
    dedupKey: row.dedupKey,
    status: row.status as 'processing' | 'ready' | 'failed',
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    recoveryHint: row.recoveryHint,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? undefined,
    chunkCount: row.chunkCount ?? 0,
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
  // List sources for a notebook (c39: tag filter + sortBy + N+1 fix)
  .get('/notebooks/:nid/sources', ({ params, query }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const tagFilter = (query as { tag?: string }).tag;
    const q = query as {
      sortBy?: string;
      sortOrder?: string;
    };
    const sortBy = q.sortBy ?? 'date';
    const sortOrder = q.sortOrder ?? 'desc';

    let rows = db().select().from(sources).where(eq(sources.notebookId, nid)).all();

    // Tag filter
    if (tagFilter) {
      const tagRow = db()
        .select({ id: sourceTags.id })
        .from(sourceTags)
        .where(and(eq(sourceTags.notebookId, nid), eq(sourceTags.name, tagFilter)))
        .get();
      if (tagRow) {
        const taggedSourceIds = new Set(
          db()
            .select({ sourceId: sourceTagMap.sourceId })
            .from(sourceTagMap)
            .where(eq(sourceTagMap.tagId, tagRow.id))
            .all()
            .map((r) => r.sourceId),
        );
        rows = rows.filter((r) => taggedSourceIds.has(r.id));
      }
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.filename.localeCompare(b.filename);
          break;
        case 'size': {
          const ca = db()
            .select({ c: sql<number>`COUNT(*)` })
            .from(chunks)
            .where(eq(chunks.sourceId, a.id))
            .get();
          const cb = db()
            .select({ c: sql<number>`COUNT(*)` })
            .from(chunks)
            .where(eq(chunks.sourceId, b.id))
            .get();
          cmp = (ca?.c ?? 0) - (cb?.c ?? 0);
          break;
        }
        case 'type':
          cmp = (a.parserType ?? '').localeCompare(b.parserType ?? '');
          break;
        default:
          cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return enrichSources(rows);
  })

  // Upload + ingest a file
  .post('/sources/upload', async ({ body, query, set }) => {
    if (query?.notebookId === undefined || query?.notebookId === '') {
      return sendError(set, ErrorCode.INVALID_REQUEST, 'notebookId query param is required');
    }
    const notebookId = requirePositiveIntId(query.notebookId, 'notebook id');
    const dedupAction = ((query as Record<string, string> | undefined)?.dedupAction ?? 'prompt') as
      | 'prompt'
      | 'reuse'
      | 'create_new';

    // body is FormData; Elysia parses multipart into { filename, file }
    const file = (body as { file?: File }).file;
    if (!file) {
      return sendError(set, ErrorCode.INVALID_REQUEST, 'No file provided');
    }

    // Upload size limit (configurable, default 50 MB).
    const maxBytes = getUploadMaxBytes();
    if (file.size > maxBytes) {
      return sendError(set, ErrorCode.PAYLOAD_TOO_LARGE, 'Payload Too Large', {
        maxBytes: maxBytes,
        uploadedBytes: file.size,
      });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // c44: Dedup check — gated by config (v1 source_ingestion.dedup.enabled)
    const dedupKey = getDedupEnabled() ? uploadDedupKey(buffer) : undefined;
    if (dedupKey && dedupAction !== 'create_new') {
      const hit = db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.notebookId, notebookId), eq(sources.dedupKey, dedupKey)))
        .get();
      if (hit) {
        if (dedupAction === 'prompt') {
          return sendError(set, ErrorCode.CONFLICT, 'Source dedup hit', {
            existingSourceId: hit.id,
          });
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
  // c57: notebook ownership check — requires ?notebookId= query, returns 404
  // if the source doesn't belong to that notebook (prevents cross-notebook access)
  .get('/sources/:id', ({ params, query }) => {
    const id = requirePositiveIntId(params.id, 'source id');
    const nid = requireOptionalPositiveIntId(
      (query as Record<string, string> | undefined)?.notebookId,
      'notebook id',
    );
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row || (nid && row.notebookId !== nid)) sourceNotFound(id);

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
  // c57: notebook ownership check via ?notebookId= query
  .delete('/sources/:id', ({ params, query, set }) => {
    const id = requirePositiveIntId(params.id, 'source id');
    const nid = requireOptionalPositiveIntId(
      (query as Record<string, string> | undefined)?.notebookId,
      'notebook id',
    );
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row || (nid && row.notebookId !== nid)) sourceNotFound(id);

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
      mimeTypes: p.mimeTypes,
      extensions: p.extensions,
    }));
  })

  // Tag CRUD (c39: uniqueness check + notebook ownership + idempotent assign/remove)
  .get('/notebooks/:nid/sources/tags', ({ params }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    return db()
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.notebookId, nid))
      .all()
      .map((t) => ({
        id: t.id,
        notebookId: t.notebookId,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
  })

  .post(
    '/notebooks/:nid/sources/tags',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rawName = body.name.trim().slice(0, 64);
      if (!rawName) {
        set.status = 400;
        return sendError(set, ErrorCode.INVALID_REQUEST, 'Tag name is required');
      }
      // Uniqueness check (case-insensitive, v1 api_tags.py:56-63)
      const existing = db()
        .select()
        .from(sourceTags)
        .where(eq(sourceTags.notebookId, nid))
        .all()
        .find((t) => t.name.toLowerCase() === rawName.toLowerCase());
      if (existing) {
        return sendError(set, ErrorCode.CONFLICT, 'Tag name already exists', {
          existingTagId: existing.id,
        });
      }
      const row = db()
        .insert(sourceTags)
        .values({ notebookId: nid, name: rawName })
        .returning()
        .get();
      // c57: invalidate sources cache (list-sources cache key includes tag filter)
      bumpSourcesEpoch(nid);
      return {
        id: row.id,
        notebookId: row.notebookId,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    { body: SourceTagCreateSchema },
  )

  .patch(
    '/notebooks/:nid/sources/tags/:tid',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      const rawName = body.name.trim().slice(0, 64);
      if (!rawName) {
        set.status = 400;
        return sendError(set, ErrorCode.INVALID_REQUEST, 'Tag name is required');
      }
      // Ownership check (v1 api_tags.py:81)
      const existing = db()
        .select()
        .from(sourceTags)
        .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid)))
        .get();
      if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
      // Uniqueness check (exclude self)
      const conflict = db()
        .select()
        .from(sourceTags)
        .where(eq(sourceTags.notebookId, nid))
        .all()
        .find((t) => t.id !== tid && t.name.toLowerCase() === rawName.toLowerCase());
      if (conflict) {
        return sendError(set, ErrorCode.CONFLICT, 'Tag name already exists', {
          existingTagId: conflict.id,
        });
      }
      db().update(sourceTags).set({ name: rawName }).where(eq(sourceTags.id, tid)).run();
      // c57: invalidate sources cache
      bumpSourcesEpoch(nid);
      const updated = db().select().from(sourceTags).where(eq(sourceTags.id, tid)).get();
      return {
        id: updated!.id,
        notebookId: updated!.notebookId,
        name: updated!.name,
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      };
    },
    { body: SourceTagCreateSchema },
  )

  .delete('/notebooks/:nid/sources/tags/:tid', ({ params, set }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const tid = requirePositiveIntId(params.tid, 'tag id');
    // Ownership check (v1 api_tags.py:110)
    const existing = db()
      .select()
      .from(sourceTags)
      .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid)))
      .get();
    if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
    db().delete(sourceTags).where(eq(sourceTags.id, tid)).run();
    // c57: invalidate sources cache
    bumpSourcesEpoch(nid);
    set.status = 204;
    return '';
  })

  .post(
    '/notebooks/:nid/sources/tags/:tid/sources',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      const { sourceIds } = body;
      // c53: per-item diagnostics (v1 api_tags.py:142-185 SourceBatchItemResult).
      // Was: silent continue on missing source + only counts returned.
      const results: Array<{
        sourceId: number;
        ok: boolean;
        message?: string;
        errorCode?: string;
      }> = [];
      let applied = 0;
      let skipped = 0;
      for (const sid of sourceIds) {
        const src = db()
          .select({ id: sources.id })
          .from(sources)
          .where(and(eq(sources.id, sid), eq(sources.notebookId, nid)))
          .get();
        if (!src) {
          results.push({ sourceId: sid, ok: false, errorCode: 'SOURCE_NOT_FOUND' });
          continue;
        }
        const existing = db()
          .select()
          .from(sourceTagMap)
          .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
          .get();
        if (existing) {
          skipped++;
          results.push({ sourceId: sid, ok: true, message: 'already assigned' });
          continue;
        }
        db().insert(sourceTagMap).values({ sourceId: sid, tagId: tid }).run();
        applied++;
        results.push({ sourceId: sid, ok: true });
      }
      // c57: invalidate sources cache (tag binding changed)
      if (applied > 0) bumpSourcesEpoch(nid);
      return { tagId: tid, sourceIds, applied, skipped, results };
    },
    { body: SourceTagBindingRequestSchema },
  )

  .delete(
    '/notebooks/:nid/sources/tags/:tid/sources',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      const { sourceIds } = body;
      // c53: per-item diagnostics (v1 api_tags.py:142-185)
      const results: Array<{
        sourceId: number;
        ok: boolean;
        message?: string;
        errorCode?: string;
      }> = [];
      let removed = 0;
      let skipped = 0;
      for (const sid of sourceIds) {
        const existing = db()
          .select()
          .from(sourceTagMap)
          .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
          .get();
        if (!existing) {
          skipped++;
          results.push({ sourceId: sid, ok: true, message: 'not assigned' });
          continue;
        }
        db()
          .delete(sourceTagMap)
          .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
          .run();
        removed++;
        results.push({ sourceId: sid, ok: true });
      }
      // c57: invalidate sources cache (tag unbinding changed)
      if (removed > 0) bumpSourcesEpoch(nid);
      return { tagId: tid, sourceIds, removed, skipped, results };
    },
    { body: SourceTagBindingRequestSchema },
  )

  // Get source chunks
  // c57: notebook ownership check via ?notebookId= query
  .get('/sources/:id/chunks', ({ params, query }) => {
    const id = requirePositiveIntId(params.id, 'source id');
    const nid = requireOptionalPositiveIntId(
      (query as Record<string, string> | undefined)?.notebookId,
      'notebook id',
    );
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row || (nid && row.notebookId !== nid)) sourceNotFound(id);
    const rows = db()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, id))
      .orderBy(chunks.chunkIndex)
      .all();
    return rows.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      text: c.text,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
      metadata: c.metadata,
    }));
  })

  // Re-embed a source (v1: requires FAILED status; processing → ready/failed)
  // c57: notebook ownership check via ?notebookId= query
  .post('/sources/:id/re-embed', async ({ params, query }) => {
    const id = requirePositiveIntId(params.id, 'source id');
    const nid = requireOptionalPositiveIntId(
      (query as Record<string, string> | undefined)?.notebookId,
      'notebook id',
    );
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row || (nid && row.notebookId !== nid)) sourceNotFound(id);
    // c44: v1 _reembed_existing_source rejects non-failed with 400
    if (row.status !== 'failed') {
      throw new Error(`Source ${id} is not in failed status (current: ${row.status})`);
    }

    // c57: clear ALL error fields (v1 api_common.py:261-263), not just errorMessage
    db()
      .update(sources)
      .set({
        status: 'processing',
        errorCode: null,
        errorMessage: null,
        recoveryHint: null,
        lastErrorAt: null,
      })
      .where(eq(sources.id, id))
      .run();

    try {
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      const strategy = new EmbedStrategy();
      deleteSourceVectors(db(), id);
      await strategy.indexSource(id, row.notebookId);
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, id)).run();
      bumpSourcesEpoch(row.notebookId);
      return { sourceId: id, reEmbedded: true };
    } catch (error) {
      db()
        .update(sources)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        .where(eq(sources.id, id))
        .run();
      bumpSourcesEpoch(row.notebookId);
      throw error;
    }
  })

  // c44: Search sources via real web search (v1 run_search_graph + SearXNG)
  .post(
    '/notebooks/:nid/sources/search',
    async ({ body }) => {
      const { query, engine, mode } = body;
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        source_id?: number;
      }> = [];

      try {
        // Use the existing SearXNG web-search tool (same as research agent)
        const { searchWeb } = await import('../../ai/tools/web-search.ts');
        const webResults = await searchWeb(query, { maxResults: 10 });
        for (const r of webResults) {
          results.push({
            title: r.title,
            url: r.url,
            snippet: r.snippet ?? '',
          });
        }
      } catch (error) {
        // SearXNG unavailable — return error info, not a crash
        console.error('[sources/search] web search failed:', error);
      }

      return {
        status: results.length > 0 ? 'ok' : 'no_results',
        query,
        engine: engine ?? 'searxng',
        mode,
        createdAt: new Date().toISOString(),
        results,
      };
    },
    { body: SourceSearchRequestSchema },
  )

  // Batch delete sources
  // c57: per-item results array (v1 api_schemas.py:111-114 SourceBatchDeleteResponse)
  .post(
    '/notebooks/:nid/sources/batch/delete',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const { sourceIds } = body;
      const deletedIds: number[] = [];
      const results: Array<{
        sourceId: number;
        ok: boolean;
        errorCode?: string;
        message?: string;
      }> = [];
      for (const sid of sourceIds) {
        const row = db().select().from(sources).where(eq(sources.id, sid)).get();
        if (row && row.notebookId === nid) {
          deleteSourceVectors(db(), sid);
          db().delete(sources).where(eq(sources.id, sid)).run();
          deletedIds.push(sid);
          results.push({ sourceId: sid, ok: true });
        } else {
          results.push({
            sourceId: sid,
            ok: false,
            errorCode: 'SOURCE_NOT_FOUND',
            message: row ? 'Source not in this notebook' : 'Source not found',
          });
        }
      }
      if (deletedIds.length) bumpSourcesEpoch(nid);
      return { results, deletedIds, deletedCount: deletedIds.length };
    },
    { body: SourceBatchDeleteRequestSchema },
  )

  // Batch re-embed sources
  // c57: per-item results array + clear all error fields
  .post(
    '/notebooks/:nid/sources/batch/re-embed',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const { sourceIds } = body;
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      const strategy = new EmbedStrategy();
      const reembedded: number[] = [];
      const failed: number[] = [];
      const results: Array<{
        sourceId: number;
        ok: boolean;
        errorCode?: string;
        message?: string;
      }> = [];
      for (const sid of sourceIds) {
        const row = db().select().from(sources).where(eq(sources.id, sid)).get();
        if (!row || row.notebookId !== nid) {
          failed.push(sid);
          results.push({
            sourceId: sid,
            ok: false,
            errorCode: 'SOURCE_NOT_FOUND',
            message: 'Source not found in this notebook',
          });
          continue;
        }
        // c57: clear ALL error fields (v1 api_common.py:261-263)
        db()
          .update(sources)
          .set({
            status: 'processing',
            errorCode: null,
            errorMessage: null,
            recoveryHint: null,
            lastErrorAt: null,
          })
          .where(eq(sources.id, sid))
          .run();
        try {
          deleteSourceVectors(db(), sid);
          await strategy.indexSource(sid, nid);
          db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sid)).run();
          reembedded.push(sid);
          results.push({ sourceId: sid, ok: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          db()
            .update(sources)
            .set({
              status: 'failed',
              errorCode: 'EMBEDDING_FAILED',
              errorMessage: msg,
            })
            .where(eq(sources.id, sid))
            .run();
          failed.push(sid);
          results.push({ sourceId: sid, ok: false, errorCode: 'EMBEDDING_FAILED', message: msg });
        }
      }
      if (reembedded.length || failed.length) bumpSourcesEpoch(nid);
      return {
        results,
        reembeddedIds: reembedded,
        failedIds: failed,
        reembeddedCount: reembedded.length,
        failedCount: failed.length,
      };
    },
    { body: SourceBatchReembedRequestSchema },
  )

  // Ingest from URL (c39: dedup default prompt + link mode + SSRF fallback fix)
  .post(
    '/notebooks/:nid/sources/from-url',
    async ({ params, body, query, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const { url, mode, title, extractor, snippet } = body;
      const normalizedMode = mode;
      const dedupAction = ((query as Record<string, string> | undefined)?.dedupAction ??
        'prompt') as 'prompt' | 'reuse' | 'create_new';

      // SSRF guard: validate URL before fetch.
      try {
        await validateUrlForFetch(url, getSecurityPolicy());
      } catch (error) {
        return sendError(set, ErrorCode.SCHEMA_VALIDATION_FAILED, 'SSRF blocked', {
          reason: (error as Error).message,
        });
      }

      // c44: Dedup check — gated by config (v1 source_ingestion.dedup.enabled)
      const dedupKey = getDedupEnabled() ? urlDedupKey(url) : undefined;
      if (dedupKey && dedupAction !== 'create_new') {
        const hit = db()
          .select({ id: sources.id })
          .from(sources)
          .where(and(eq(sources.notebookId, nid), eq(sources.dedupKey, dedupKey)))
          .get();
        if (hit) {
          if (dedupAction === 'prompt') {
            return sendError(set, ErrorCode.CONFLICT, 'Source dedup hit', {
              existingSourceId: hit.id,
            });
          }
          if (dedupAction === 'reuse') {
            const existing = db().select().from(sources).where(eq(sources.id, hit.id)).get();
            return { reused: true, source: existing };
          }
        }
      }

      // Link mode: create a lightweight source, then embed so it is searchable (v1 still embeds)
      if (normalizedMode === 'link') {
        const linkTitle = title ?? url;
        // c62: use snippet from body if provided (v1 api_ingest.py:381-390)
        const content = snippet
          ? `# ${linkTitle}\n\n${snippet}\n\n来源: ${url}`
          : `# ${linkTitle}\n\n${url}\n\n来源链接（未抓取正文）`;
        const sourceRow = db()
          .insert(sources)
          .values({
            notebookId: nid,
            filename: linkTitle,
            mimeType: 'text/plain',
            parserType: 'link',
            status: 'processing',
            dedupKey,
            metadata: { url, mode: 'link' },
          })
          .returning()
          .get();
        db()
          .insert(chunks)
          .values({
            sourceId: sourceRow.id,
            chunkIndex: 0,
            text: content,
            metadata: { url, type: 'link' },
          })
          .run();

        try {
          const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
          const strategy = new EmbedStrategy();
          await strategy.indexSource(sourceRow.id, nid);
          db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
        } catch (error) {
          db()
            .update(sources)
            .set({
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : String(error),
            })
            .where(eq(sources.id, sourceRow.id))
            .run();
        }
        bumpSourcesEpoch(nid);
        set.status = 201;
        return { sourceId: sourceRow.id, filename: linkTitle, mode: 'link' };
      }

      // Default mode: fetch and extract URL content
      try {
        // c62: pass extractor order if specified (v1 preferred-extractor)
        const order = extractor ? [extractor] : undefined;
        const extracted = await extractUrl(url, {}, order);
        const buffer = new TextEncoder().encode(extracted.content);
        const result = await ingestSource({
          buffer,
          filename: extracted.title || title || url.split('/').pop() || 'webpage.html',
          notebookId: nid,
          mimeType: 'text/html',
          dedupKey,
        });
        return { ...result, extractedBy: extracted.extractorUsed, title: extracted.title };
      } catch {
        // Fallback to raw fetch if extractors all fail.
        // P0-3: use fetchWithRedirectGuard so the initial URL AND every redirect
        // hop are validated against the SSRF policy (replaces the c39 single
        // pre-check + bare fetch that followed redirects unsafely).
        let response: Response;
        try {
          response = await fetchWithRedirectGuard(url, getSecurityPolicy());
        } catch (error) {
          return sendError(
            set,
            ErrorCode.SCHEMA_VALIDATION_FAILED,
            error instanceof SsrfBlockedError
              ? 'SSRF blocked on fallback'
              : 'fetch failed on fallback',
            { reason: (error as Error).message },
          );
        }
        const html = await response.text();
        const buffer = new TextEncoder().encode(html);
        const result = await ingestSource({
          buffer,
          filename: title || url.split('/').pop() || 'webpage.html',
          notebookId: nid,
          mimeType: 'text/html',
          dedupKey,
        });
        return result;
      }
    },
    { body: SourceFromUrlRequestSchema },
  )

  // c44: Extractor policy routes — GET returns full ExtractorsListResponse (v1 api_ingest.py:79-153)
  .get('/notebooks/:nid/extractors', ({ params }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const policy = db()
      .select()
      .from(notebookExtractorPolicies)
      .where(eq(notebookExtractorPolicies.notebookId, nid))
      .get();
    const mode = policy?.mode ?? 'inherit_global';
    const enabledExtractors = policy?.enabledExtractors ?? null;

    // Use factory's listExtractorMetadata — reads real config, not env vars (H2 fix)
    const allExtractors = listExtractorMetadata(config().raw);

    // Nest mode/enabledExtractors under policy to match ExtractorsListResponse.
    return {
      notebookId: nid,
      policy: {
        mode,
        enabledExtractors: enabledExtractors,
      },
      extractors: allExtractors,
      defaultExtractor: getDefaultExtractor(config().raw),
      fallbackEnabled: mode === 'inherit_global',
    };
  })
  .patch(
    '/notebooks/:nid/extractors',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const mode = body.mode;
      const enabledExtractorsBody = body.enabledExtractors ?? undefined;
      // Business check: enabledExtractors entries against registered set
      const validExtractors = Object.keys(extractors);
      if (
        enabledExtractorsBody !== undefined &&
        enabledExtractorsBody !== null &&
        !enabledExtractorsBody.every((e) => validExtractors.includes(e))
      ) {
        const invalid = enabledExtractorsBody.filter((e) => !validExtractors.includes(e));
        return sendError(
          set,
          ErrorCode.INVALID_REQUEST,
          `Unknown extractor(s): ${invalid.join(', ')}`,
        );
      }
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
            enabledExtractors: enabledExtractorsBody ?? existing.enabledExtractors,
          })
          .where(eq(notebookExtractorPolicies.notebookId, nid))
          .run();
      } else {
        db()
          .insert(notebookExtractorPolicies)
          .values({
            notebookId: nid,
            mode: mode ?? 'inherit_global',
            enabledExtractors: enabledExtractorsBody ?? null,
          })
          .run();
      }
      const updated = db()
        .select()
        .from(notebookExtractorPolicies)
        .where(eq(notebookExtractorPolicies.notebookId, nid))
        .get();
      return {
        notebookId: nid,
        policy: {
          mode: updated!.mode,
          enabledExtractors: updated!.enabledExtractors,
        },
        extractors: listExtractorMetadata(config().raw),
        defaultExtractor: getDefaultExtractor(config().raw),
        fallbackEnabled: updated!.mode === 'inherit_global',
      };
    },
    { body: PatchNotebookExtractorPolicySchema },
  );

registerApiDoc(apiDocs);
