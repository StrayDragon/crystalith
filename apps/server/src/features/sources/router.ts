import { SourceSchema } from '@crystalith/shared';
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
import { listExtractorMetadata } from '../../shared/extraction/factory.ts';
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
  // List sources for a notebook (c39: tag filter + sort_by + N+1 fix)
  .get('/notebooks/:nid/sources', ({ params, query }) => {
    const nid = Number(params.nid);
    const tagFilter = (query as { tag?: string }).tag;
    const sortBy = (query as { sort_by?: string }).sort_by ?? 'date';
    const sortOrder = (query as { sort_order?: string }).sort_order ?? 'desc';

    let rows = db().select().from(sources).where(eq(sources.notebookId, nid)).all();

    // Tag filter
    if (tagFilter) {
      const tagRow = db()
        .select({ id: sourceTags.id })
        .from(sourceTags)
        .where(and(eq(sourceTags.notebookId, nid), eq(sourceTags.name, tagFilter)))
        .get();
      if (tagRow) {
        const taggedSourceIds = db()
          .select({ sourceId: sourceTagMap.sourceId })
          .from(sourceTagMap)
          .where(eq(sourceTagMap.tagId, tagRow.id))
          .all()
          .map((r) => r.sourceId);
        rows = rows.filter((r) => taggedSourceIds.includes(r.id));
      } else {
        rows = [];
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
        case 'date':
        default:
          cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return enrichSources(rows);
  })

  // Upload + ingest a file
  .post('/sources/upload', async ({ body, query, set }) => {
    const notebookId = Number(query?.notebook_id);
    const dedupAction = ((query as Record<string, string> | undefined)?.dedup_action ??
      'prompt') as 'prompt' | 'reuse' | 'create_new';
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

  // Tag CRUD (c39: uniqueness check + notebook ownership + idempotent assign/remove)
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

  .post('/notebooks/:nid/sources/tags', ({ params, body, set }) => {
    const nid = Number(params.nid);
    const rawName = (body as { name: string }).name?.trim().slice(0, 64);
    if (!rawName) {
      set.status = 400;
      return { error: 'Tag name is required' };
    }
    // Uniqueness check (case-insensitive, v1 api_tags.py:56-63)
    const existing = db()
      .select()
      .from(sourceTags)
      .where(eq(sourceTags.notebookId, nid))
      .all()
      .find((t) => t.name.toLowerCase() === rawName.toLowerCase());
    if (existing) {
      set.status = 409;
      return { error: 'Tag name already exists', existing_tag_id: existing.id };
    }
    const row = db()
      .insert(sourceTags)
      .values({ notebookId: nid, name: rawName })
      .returning()
      .get();
    return {
      id: row.id,
      notebook_id: row.notebookId,
      name: row.name,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  })

  .patch('/notebooks/:nid/sources/tags/:tid', ({ params, body, set }) => {
    const nid = Number(params.nid);
    const tid = Number(params.tid);
    const rawName = (body as { name: string }).name?.trim().slice(0, 64);
    if (!rawName) {
      set.status = 400;
      return { error: 'Tag name is required' };
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
      set.status = 409;
      return { error: 'Tag name already exists', existing_tag_id: conflict.id };
    }
    db().update(sourceTags).set({ name: rawName }).where(eq(sourceTags.id, tid)).run();
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
    const nid = Number(params.nid);
    const tid = Number(params.tid);
    // Ownership check (v1 api_tags.py:110)
    const existing = db()
      .select()
      .from(sourceTags)
      .where(and(eq(sourceTags.id, tid), eq(sourceTags.notebookId, nid)))
      .get();
    if (!existing) throw new NotFoundError(`Tag ${tid} not found in notebook ${nid}`);
    db().delete(sourceTags).where(eq(sourceTags.id, tid)).run();
    set.status = 204;
    return '';
  })

  .post('/notebooks/:nid/sources/tags/:tid/sources', ({ params, body }) => {
    const nid = Number(params.nid);
    const tid = Number(params.tid);
    const { source_ids } = body as { source_ids: number[] };
    // c53: per-item diagnostics (v1 api_tags.py:142-185 SourceBatchItemResult).
    // Was: silent continue on missing source + only counts returned.
    const results: Array<{
      source_id: number;
      ok: boolean;
      message?: string;
      error_code?: string;
    }> = [];
    let applied = 0;
    let skipped = 0;
    for (const sid of source_ids) {
      const src = db()
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.id, sid), eq(sources.notebookId, nid)))
        .get();
      if (!src) {
        results.push({ source_id: sid, ok: false, error_code: 'SOURCE_NOT_FOUND' });
        continue;
      }
      const existing = db()
        .select()
        .from(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
        .get();
      if (existing) {
        skipped++;
        results.push({ source_id: sid, ok: true, message: 'already assigned' });
        continue;
      }
      db().insert(sourceTagMap).values({ sourceId: sid, tagId: tid }).run();
      applied++;
      results.push({ source_id: sid, ok: true });
    }
    return { tag_id: tid, source_ids, applied, skipped, results };
  })

  .delete('/notebooks/:nid/sources/tags/:tid/sources', ({ params, body }) => {
    const _nid = Number(params.nid);
    void _nid;
    const tid = Number(params.tid);
    const { source_ids } = body as { source_ids: number[] };
    // c53: per-item diagnostics (v1 api_tags.py:142-185)
    const results: Array<{
      source_id: number;
      ok: boolean;
      message?: string;
      error_code?: string;
    }> = [];
    let removed = 0;
    let skipped = 0;
    for (const sid of source_ids) {
      const existing = db()
        .select()
        .from(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
        .get();
      if (!existing) {
        skipped++;
        results.push({ source_id: sid, ok: true, message: 'not assigned' });
        continue;
      }
      db()
        .delete(sourceTagMap)
        .where(and(eq(sourceTagMap.sourceId, sid), eq(sourceTagMap.tagId, tid)))
        .run();
      removed++;
      results.push({ source_id: sid, ok: true });
    }
    return { tag_id: tid, source_ids, removed, skipped, results };
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

  // Re-embed a source (v1: requires FAILED status; processing → ready/failed)
  .post('/sources/:id/re-embed', async ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(sources).where(eq(sources.id, id)).get();
    if (!row) sourceNotFound(id);
    // c44: v1 _reembed_existing_source rejects non-failed with 400
    if (row.status !== 'failed') {
      throw new Error(`Source ${id} is not in failed status (current: ${row.status})`);
    }

    db()
      .update(sources)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(sources.id, id))
      .run();

    try {
      const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
      const strategy = new EmbedStrategy();
      deleteSourceVectors(db(), id);
      await strategy.indexSource(id, row.notebookId);
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, id)).run();
      bumpSourcesEpoch(row.notebookId);
      return { source_id: id, re_embedded: true };
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
  .post('/notebooks/:nid/sources/search', async ({ params, body }) => {
    const nid = Number(params.nid);
    const { query, engine } = body as { query: string; engine?: string };
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
      created_at: new Date().toISOString(),
      results,
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
      const row = db().select().from(sources).where(eq(sources.id, sid)).get();
      if (!row || row.notebookId !== nid) {
        failed.push(sid);
        continue;
      }
      db()
        .update(sources)
        .set({ status: 'processing', errorMessage: null })
        .where(eq(sources.id, sid))
        .run();
      try {
        deleteSourceVectors(db(), sid);
        await strategy.indexSource(sid, nid);
        db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sid)).run();
        reembedded.push(sid);
      } catch (error) {
        db()
          .update(sources)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          })
          .where(eq(sources.id, sid))
          .run();
        failed.push(sid);
      }
    }
    if (reembedded.length || failed.length) bumpSourcesEpoch(nid);
    return {
      reembedded_ids: reembedded,
      failed_ids: failed,
      reembedded_count: reembedded.length,
      failed_count: failed.length,
    };
  })

  // Ingest from URL (c39: dedup default prompt + link mode + SSRF fallback fix)
  .post('/notebooks/:nid/sources/from-url', async ({ params, body, query, set }) => {
    const nid = Number(params.nid);
    const { url, mode, title } = body as { url: string; mode?: string; title?: string };
    const dedupAction = ((query as Record<string, string> | undefined)?.dedup_action ??
      'prompt') as 'prompt' | 'reuse' | 'create_new';

    // SSRF guard: validate URL before fetch.
    try {
      await validateUrlForFetch(url, getSecurityPolicy());
    } catch (error) {
      set.status = 422;
      return { error: 'SSRF blocked', reason: (error as Error).message };
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
          set.status = 409;
          return { error_code: 'SOURCE_DEDUP_HIT', existing_source_id: hit.id };
        }
        if (dedupAction === 'reuse') {
          const existing = db().select().from(sources).where(eq(sources.id, hit.id)).get();
          return { reused: true, source: existing };
        }
      }
    }

    // Link mode: create a lightweight source, then embed so it is searchable (v1 still embeds)
    if (mode === 'link') {
      const linkTitle = title ?? url;
      const snippet = `# ${linkTitle}\n\n${url}\n\n来源链接（未抓取正文）`;
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
          text: snippet,
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
      return { source_id: sourceRow.id, filename: linkTitle, mode: 'link' };
    }

    // Default mode: fetch and extract URL content
    try {
      const extracted = await extractUrl(url, {});
      const buffer = new TextEncoder().encode(extracted.content);
      const result = await ingestSource({
        buffer,
        filename: extracted.title || title || url.split('/').pop() || 'webpage.html',
        notebookId: nid,
        mimeType: 'text/html',
        dedupKey,
      });
      return { ...result, extracted_by: extracted.extractorUsed, title: extracted.title };
    } catch {
      // Fallback to raw fetch if extractors all fail.
      // c39: SSRF guard re-applied on fallback path (was bypassed before)
      try {
        await validateUrlForFetch(url, getSecurityPolicy());
      } catch (error) {
        set.status = 422;
        return { error: 'SSRF blocked on fallback', reason: (error as Error).message };
      }
      const response = await fetch(url);
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
  })

  // c44: Extractor policy routes — GET returns full ExtractorsListResponse (v1 api_ingest.py:79-153)
  .get('/notebooks/:nid/extractors', ({ params }) => {
    const nid = Number(params.nid);
    const policy = db()
      .select()
      .from(notebookExtractorPolicies)
      .where(eq(notebookExtractorPolicies.notebookId, nid))
      .get();
    const mode = policy?.mode ?? 'inherit_global';
    const enabledExtractors = policy?.enabledExtractors ?? null;

    // Use factory's listExtractorMetadata — reads real config, not env vars (H2 fix)
    const allExtractors = listExtractorMetadata(config().raw);

    return {
      notebook_id: nid,
      mode,
      enabled_extractors: enabledExtractors,
      extractors: allExtractors,
      default_extractor: 'readability',
      fallback_enabled: mode === 'inherit_global',
    };
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
