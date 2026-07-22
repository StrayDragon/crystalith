import {
  NotebookIdQuerySchema,
  PaginatedSchema,
  PaginationParamsSchema,
  PatchNotebookExtractorPolicySchema,
  ChunkListSchema,
  Empty204Schema,
  SourceBatchDeleteRequestSchema,
  SourceBatchDeleteResponseSchema,
  SourceBatchReembedRequestSchema,
  SourceBatchReembedResponseSchema,
  SourceFromUrlRequestSchema,
  SourceFromUrlResponseSchema,
  SourceParserListSchema,
  SourceReembedResponseSchema,
  SourceSchema,
  SourceSearchRequestSchema,
  SourceSearchResponseSchema,
  SourceUploadResponseSchema,
  ExtractorsListSchema,
  ExtractorPolicyModeSchema,
  SourceTagBindingRequestSchema,
  SourceTagBindingResponseSchema,
  SourceTagCreateSchema,
  SourceTagSchema,
  SourceUploadNestedQuerySchema,
  SourceUploadQuerySchema,
  SourceStatusSchema,
  paginateItems,
  type ExtractorPolicyMode,
  type JsonMetadata,
} from '@crystalith/shared';
// Sources CRUD + upload router — /v2/notebooks/:nid/sources (canonical) + flat aliases
//
// Mirrors v1 `features/sources/api.py` + `features/sources/api_ingest.py`.
import { and, eq, sql } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

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
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import {
  extractUrl,
  extractors,
  getDefaultExtractor,
  listExtractorMetadata,
} from '../../shared/extraction/factory.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { fetchWithRedirectGuard } from '../../shared/net/fetch-with-redirect-guard.ts';
import { validateUrlForFetch, SsrfBlockedError } from '../../shared/net/url-safety.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import { uploadDedupKey, urlDedupKey } from './dedup.ts';
import { listParsers } from './parser-registry.ts';
import { ingestSource } from './pipeline.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uploadFileFromBody(body: unknown): File | undefined {
  if (body instanceof FormData) {
    const file = body.get('file');
    return file instanceof File ? file : undefined;
  }
  if (isRecord(body) && body.file instanceof File) {
    return body.file;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DedupActionSchema = z.enum(['prompt', 'reuse', 'create_new']);

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const SourceListQuerySchema = PaginationParamsSchema.extend({
  tag: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
});
const SourcesPageSchema = PaginatedSchema(SourceSchema);

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sources',
    method: 'get',
    summary: '分页列出笔记本下来源；可按标签筛选与排序',
    tags: ['sources'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
        tag: SourceListQuerySchema.shape.tag,
        sortBy: SourceListQuerySchema.shape.sortBy,
        sortOrder: SourceListQuerySchema.shape.sortOrder,
      },
    },
    responses: {
      200: { description: '来源列表', body: SourcesPageSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/sources/upload',
    method: 'post',
    summary: '上传文件并解析、分块、向量化',
    tags: ['sources'],
    responses: { 201: { description: '摄取结果' } },
  },
  {
    path: '/v2/sources/upload',
    method: 'post',
    summary: '上传摄取（扁平别名）',
    tags: ['sources'],
    deprecated: true,
    responses: { 201: { description: '摄取结果' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid',
    method: 'get',
    summary: '按 id 获取来源',
    tags: ['sources'],
    responses: { 200: { description: '来源', body: SourceSchema } },
  },
  {
    path: '/v2/sources/:id',
    method: 'get',
    summary: '按 id 获取来源（扁平别名）',
    tags: ['sources'],
    deprecated: true,
    responses: { 200: { description: '来源', body: SourceSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid',
    method: 'delete',
    summary: '删除来源及其分块与向量',
    tags: ['sources'],
    responses: { 204: { description: '已删除' } },
  },
  {
    path: '/v2/sources/:id',
    method: 'delete',
    summary: '删除来源及其分块与向量（扁平别名）',
    tags: ['sources'],
    deprecated: true,
    responses: { 204: { description: '已删除' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/chunks',
    method: 'get',
    summary: '列出某来源的分块',
    tags: ['sources'],
    responses: { 200: { description: '分块列表' } },
  },
  {
    path: '/v2/sources/:id/chunks',
    method: 'get',
    summary: '列出某来源的分块（扁平别名）',
    tags: ['sources'],
    deprecated: true,
    responses: { 200: { description: '分块列表' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/:sid/re-embed',
    method: 'post',
    summary: '对失败来源重新向量化',
    tags: ['sources'],
    responses: { 200: { description: '重嵌结果' } },
  },
  {
    path: '/v2/sources/:id/re-embed',
    method: 'post',
    summary: '对失败来源重新向量化（扁平别名）',
    tags: ['sources'],
    deprecated: true,
    responses: { 200: { description: '重嵌结果' } },
  },
  {
    path: '/v2/sources/parsers',
    method: 'get',
    summary: '列出可用解析器',
    tags: ['sources'],
    responses: { 200: { description: '解析器列表' } },
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
  metadata: JsonMetadata | null;
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
    metadata: row.metadata,
    dedupKey: row.dedupKey,
    status: SourceStatusSchema.parse(row.status),
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

type UploadSet = { status?: number | string };

async function handleSourceUpload(
  notebookId: number,
  body: unknown,
  dedupAction: 'prompt' | 'reuse' | 'create_new' | undefined,
) {
  // body is FormData; Elysia parses multipart into { filename, file }
  const file = uploadFileFromBody(body);
  if (!file) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'No file provided');
  }

  // Upload size limit (configurable, default 50 MB).
  const maxBytes = getUploadMaxBytes();
  if (file.size > maxBytes) {
    throw new AppHttpError(ErrorCode.PAYLOAD_TOO_LARGE, 'Payload Too Large', {
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
        throw new AppHttpError(ErrorCode.CONFLICT, 'Source dedup hit', {
          existingSourceId: hit.id,
        });
      }
      if (dedupAction === 'reuse') {
        return { reused: true as const, source: handleGetSource(hit.id, notebookId) };
      }
    }
  }

  return ingestSource({
    buffer,
    filename: file.name,
    notebookId,
    mimeType: file.type,
    dedupKey,
  });
}

function handleGetSource(id: number, notebookId: number) {
  const row = db().select().from(sources).where(eq(sources.id, id)).get();
  if (!row || row.notebookId !== notebookId) sourceNotFound(id);

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
}

function handleDeleteSource(id: number, notebookId: number, set: UploadSet) {
  const row = db().select().from(sources).where(eq(sources.id, id)).get();
  if (!row || row.notebookId !== notebookId) sourceNotFound(id);

  deleteSourceVectors(db(), id);
  db().delete(sources).where(eq(sources.id, id)).run();
  if (row.notebookId) bumpSourcesEpoch(row.notebookId);

  set.status = 204;
  return;
}

function handleGetSourceChunks(id: number, notebookId: number) {
  const row = db().select().from(sources).where(eq(sources.id, id)).get();
  if (!row || row.notebookId !== notebookId) sourceNotFound(id);
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
}

async function handleReEmbedSource(id: number, notebookId: number) {
  const row = db().select().from(sources).where(eq(sources.id, id)).get();
  if (!row || row.notebookId !== notebookId) sourceNotFound(id);
  if (row.status !== 'failed') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Source ${id} is not in failed status (current: ${row.status})`,
    );
  }

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
    // c74: re-embed success → refresh auto-summary asynchronously
    const { scheduleSourceSummary } = await import('./source-summary.ts');
    scheduleSourceSummary(id, { force: true });
    return { sourceId: id, reEmbedded: true as const };
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
}

/** Enrich source rows with chunk counts and tags. */
function enrichSources(
  rows: Array<{
    id: number;
    notebookId: number;
    filename: string;
    mimeType: string | null;
    parserType: string;
    metadata: JsonMetadata | null;
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
  .get(
    '/notebooks/:nid/sources',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tagFilter = query.tag;
      const sortBy = query.sortBy ?? 'date';
      const sortOrder = query.sortOrder ?? 'desc';
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 20;

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

      return paginateItems(enrichSources(rows), offset, limit);
    },
    { query: SourceListQuerySchema, response: SourcesPageSchema },
  )

  // Upload + ingest a file (nested canonical)
  .post(
    '/notebooks/:nid/sources/upload',
    async ({ params, body, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, query.notebookId);
      return handleSourceUpload(notebookId, body, query.dedupAction);
    },
    { query: SourceUploadNestedQuerySchema, response: SourceUploadResponseSchema },
  )

  // Upload + ingest a file (flat alias — c67 notebookId required)
  .post(
    '/sources/upload',
    async ({ body, query }) => {
      return handleSourceUpload(query.notebookId, body, query.dedupAction);
    },
    { query: SourceUploadQuerySchema, response: SourceUploadResponseSchema },
  )

  // Get a source by ID (nested canonical)
  .get(
    '/notebooks/:nid/sources/:sid',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'source id');
      return handleGetSource(sid, nid);
    },
    { response: SourceSchema },
  )

  // Get a source by ID (flat alias — c67 notebookId required)
  .get(
    '/sources/:id',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'source id');
      return handleGetSource(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: SourceSchema },
  )

  // Delete a source (nested canonical)
  .delete(
    '/notebooks/:nid/sources/:sid',
    ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'source id');
      return handleDeleteSource(sid, nid, set);
    },
    { response: { 204: Empty204Schema } },
  )

  // Delete a source (flat alias — c67 notebookId required)
  .delete(
    '/sources/:id',
    ({ params, query, set }) => {
      const id = requirePositiveIntId(params.id, 'source id');
      return handleDeleteSource(id, query.notebookId, set);
    },
    { query: NotebookIdQuerySchema, response: { 204: Empty204Schema } },
  )

  // List available parsers (global flat — do not nest)
  .get(
    '/sources/parsers',
    () => {
      return listParsers().map((p) => ({
        id: p.id,
        name: p.name,
        mimeTypes: p.mimeTypes,
        extensions: p.extensions,
      }));
    },
    { response: SourceParserListSchema },
  )

  // Tag CRUD (c39: uniqueness check + notebook ownership + idempotent assign/remove)
  .get(
    '/notebooks/:nid/sources/tags',
    ({ params }) => {
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
    },
    { response: SourceTagSchema.array() },
  )

  .post(
    '/notebooks/:nid/sources/tags',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rawName = body.name.trim().slice(0, 64);
      if (!rawName) {
        throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Tag name is required');
      }
      // Uniqueness check (case-insensitive, v1 api_tags.py:56-63)
      const existing = db()
        .select()
        .from(sourceTags)
        .where(eq(sourceTags.notebookId, nid))
        .all()
        .find((t) => t.name.toLowerCase() === rawName.toLowerCase());
      if (existing) {
        throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
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
      set.status = 201;
      return {
        id: row.id,
        notebookId: row.notebookId,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    { body: SourceTagCreateSchema, response: SourceTagSchema },
  )

  .patch(
    '/notebooks/:nid/sources/tags/:tid',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      const rawName = body.name.trim().slice(0, 64);
      if (!rawName) {
        throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Tag name is required');
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
        throw new AppHttpError(ErrorCode.CONFLICT, 'Tag name already exists', {
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
    { body: SourceTagCreateSchema, response: SourceTagSchema },
  )

  .delete(
    '/notebooks/:nid/sources/tags/:tid',
    ({ params, set }) => {
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
      return;
    },
    { response: { 204: Empty204Schema } },
  )

  .post(
    '/notebooks/:nid/sources/tags/:tid/sources',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      const { sourceIds } = body;
      // c53: per-item diagnostics (v1 api_tags.py:142-185 SourceBatchItemResult).
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
    { body: SourceTagBindingRequestSchema, response: SourceTagBindingResponseSchema },
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
    { body: SourceTagBindingRequestSchema, response: SourceTagBindingResponseSchema },
  )

  // Get source chunks (nested canonical)
  .get(
    '/notebooks/:nid/sources/:sid/chunks',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'source id');
      return handleGetSourceChunks(sid, nid);
    },
    { response: ChunkListSchema },
  )

  // Get source chunks (flat alias — c67 notebookId required)
  .get(
    '/sources/:id/chunks',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'source id');
      return handleGetSourceChunks(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ChunkListSchema },
  )

  // Re-embed a source (nested canonical)
  .post(
    '/notebooks/:nid/sources/:sid/re-embed',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'source id');
      return handleReEmbedSource(sid, nid);
    },
    { response: SourceReembedResponseSchema },
  )

  // Re-embed a source (flat alias — c67 notebookId required)
  .post(
    '/sources/:id/re-embed',
    async ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'source id');
      return handleReEmbedSource(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: SourceReembedResponseSchema },
  )

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
    { body: SourceSearchRequestSchema, response: SourceSearchResponseSchema },
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
    { body: SourceBatchDeleteRequestSchema, response: SourceBatchDeleteResponseSchema },
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
          const { scheduleSourceSummary } = await import('./source-summary.ts');
          scheduleSourceSummary(sid, { force: true });
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
    { body: SourceBatchReembedRequestSchema, response: SourceBatchReembedResponseSchema },
  )

  // Ingest from URL (c39: dedup default prompt + link mode + SSRF fallback fix)
  .post(
    '/notebooks/:nid/sources/from-url',
    async ({ params, body, query, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const { url, mode, title, extractor, snippet } = body;
      const normalizedMode = mode;
      const dedupParsed = DedupActionSchema.safeParse(
        isRecord(query) ? (query.dedupAction ?? 'prompt') : 'prompt',
      );
      const dedupAction = dedupParsed.success ? dedupParsed.data : 'prompt';

      // SSRF guard: validate URL before fetch.
      try {
        await validateUrlForFetch(url, getSecurityPolicy());
      } catch (error) {
        throw new AppHttpError(ErrorCode.SCHEMA_VALIDATION_FAILED, 'SSRF blocked', {
          reason: errorMessage(error),
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
            throw new AppHttpError(ErrorCode.CONFLICT, 'Source dedup hit', {
              existingSourceId: hit.id,
            });
          }
          if (dedupAction === 'reuse') {
            return { reused: true as const, source: handleGetSource(hit.id, nid) };
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
          const { scheduleSourceSummary } = await import('./source-summary.ts');
          scheduleSourceSummary(sourceRow.id);
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
        return { sourceId: sourceRow.id, filename: linkTitle, mode: 'link' as const };
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
          throw new AppHttpError(
            ErrorCode.SCHEMA_VALIDATION_FAILED,
            error instanceof SsrfBlockedError
              ? 'SSRF blocked on fallback'
              : 'fetch failed on fallback',
            { reason: errorMessage(error) },
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
    {
      body: SourceFromUrlRequestSchema,
      response: { 200: SourceFromUrlResponseSchema, 201: SourceFromUrlResponseSchema },
    },
  )

  // c44: Extractor policy routes — GET returns full ExtractorsListResponse (v1 api_ingest.py:79-153)
  .get(
    '/notebooks/:nid/extractors',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const policy = db()
        .select()
        .from(notebookExtractorPolicies)
        .where(eq(notebookExtractorPolicies.notebookId, nid))
        .get();
      const modeParsed = ExtractorPolicyModeSchema.safeParse(policy?.mode ?? 'inherit_global');
      const mode: ExtractorPolicyMode = modeParsed.success ? modeParsed.data : 'inherit_global';
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
    },
    { response: ExtractorsListSchema },
  )
  .patch(
    '/notebooks/:nid/extractors',
    ({ params, body }) => {
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
        throw new AppHttpError(
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
      const modeParsed = ExtractorPolicyModeSchema.safeParse(updated!.mode);
      const resolvedMode: ExtractorPolicyMode = modeParsed.success
        ? modeParsed.data
        : 'inherit_global';
      return {
        notebookId: nid,
        policy: {
          mode: resolvedMode,
          enabledExtractors: updated!.enabledExtractors,
        },
        extractors: listExtractorMetadata(config().raw),
        defaultExtractor: getDefaultExtractor(config().raw),
        fallbackEnabled: resolvedMode === 'inherit_global',
      };
    },
    { body: PatchNotebookExtractorPolicySchema, response: ExtractorsListSchema },
  );

registerApiDoc(apiDocs);
