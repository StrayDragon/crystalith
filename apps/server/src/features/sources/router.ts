import {
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
  SourceStatusSchema,
  paginateItems,
  type ExtractorPolicyMode,
  type JsonMetadata,
} from '@crystalith/shared';
// Sources CRUD + upload router — /v2/notebooks/:nid/sources (canonical).
// GET /v2/sources/parsers remains global flat (process registry).
// (c90: flat notebook-scoped /v2/sources/:id* and /upload aliases removed)
//
// Mirrors v1 `features/sources/api.py` + `features/sources/api_ingest.py`.
import { and, eq, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
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
import { config, getDedupEnabled, getUploadMaxBytes } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import {
  extractors,
  getDefaultExtractor,
  listExtractorMetadata,
} from '../../shared/extraction/factory.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { requireOwnedRow, resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import { batchDeleteSources, batchReembedSources } from './batch.service.ts';
import { uploadDedupKey } from './dedup.ts';
import { ingestFromUrl } from './from-url.service.ts';
import { listParsers } from './parser-registry.ts';
import { ingestSource } from './pipeline.ts';
import {
  assignSourcesToTag,
  createTag,
  deleteTag,
  listNotebookTags,
  removeSourcesFromTag,
  renameTag,
} from './tags.service.ts';

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
    path: '/v2/notebooks/:nid/sources/:sid',
    method: 'get',
    summary: '按 id 获取来源',
    tags: ['sources'],
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
    path: '/v2/notebooks/:nid/sources/:sid/chunks',
    method: 'get',
    summary: '列出某来源的分块',
    tags: ['sources'],
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
    path: '/v2/sources/parsers',
    method: 'get',
    summary: '列出可用解析器',
    tags: ['sources'],
    responses: { 200: { description: '解析器列表' } },
  },

  // ---- Tag CRUD（c39）----
  {
    path: '/v2/notebooks/:nid/sources/tags',
    method: 'get',
    summary: '列出笔记本下全部来源标签',
    tags: ['sources'],
    responses: { 200: { description: '标签列表', body: SourceTagSchema.array() } },
  },
  {
    path: '/v2/notebooks/:nid/sources/tags',
    method: 'post',
    summary: '创建来源标签；同名（忽略大小写）返回 409 冲突',
    tags: ['sources'],
    request: { body: SourceTagCreateSchema },
    responses: { 201: { description: '已创建的标签', body: SourceTagSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sources/tags/:tid',
    method: 'patch',
    summary: '重命名来源标签；校验笔记本归属与同 notebook 内唯一性',
    tags: ['sources'],
    request: { body: SourceTagCreateSchema },
    responses: { 200: { description: '更新后的标签', body: SourceTagSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sources/tags/:tid',
    method: 'delete',
    summary: '删除来源标签及其与来源的绑定关系',
    tags: ['sources'],
    responses: { 204: { description: '已删除' } },
  },
  {
    path: '/v2/notebooks/:nid/sources/tags/:tid/sources',
    method: 'post',
    summary: '批量为来源打上该标签；逐条给出成功/跳过/失败诊断（幂等）',
    tags: ['sources'],
    request: { body: SourceTagBindingRequestSchema },
    responses: { 200: { description: '逐条绑定结果', body: SourceTagBindingResponseSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sources/tags/:tid/sources',
    method: 'delete',
    summary: '批量移除来源与该标签的绑定；逐条给出诊断（未绑定时记 skipped）',
    tags: ['sources'],
    request: { body: SourceTagBindingRequestSchema },
    responses: { 200: { description: '逐条解绑结果', body: SourceTagBindingResponseSchema } },
  },

  // ---- 搜索 / 批量操作（c44/c53/c57）----
  {
    path: '/v2/notebooks/:nid/sources/search',
    method: 'post',
    summary: '真实联网搜索（SearXNG）返回候选结果；供前端加入搜索队列，不产生来源',
    tags: ['sources'],
    request: { body: SourceSearchRequestSchema },
    responses: {
      200: { description: '搜索结果（含无结果状态）', body: SourceSearchResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/sources/batch/delete',
    method: 'post',
    summary: '批量删除来源及其分块与向量；逐条给出不存在/不归属诊断',
    tags: ['sources'],
    request: { body: SourceBatchDeleteRequestSchema },
    responses: {
      200: { description: '逐条删除结果', body: SourceBatchDeleteResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/sources/batch/re-embed',
    method: 'post',
    summary: '批量对失败来源重新向量化；逐条给出 EMBEDDING_FAILED 等诊断',
    tags: ['sources'],
    request: { body: SourceBatchReembedRequestSchema },
    responses: {
      200: { description: '逐条重嵌结果', body: SourceBatchReembedResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/sources/from-url',
    method: 'post',
    summary:
      '从 URL 摄取来源：抓取正文入库；支持 link 链接模式与去重策略（prompt/reuse/create_new），SSRF 校验拦截内网地址',
    tags: ['sources'],
    request: { body: SourceFromUrlRequestSchema },
    responses: {
      200: { description: '摄取结果', body: SourceFromUrlResponseSchema },
      201: { description: '摄取结果（新建）', body: SourceFromUrlResponseSchema },
    },
  },

  // ---- 抽取器策略（c44）----
  {
    path: '/v2/notebooks/:nid/extractors',
    method: 'get',
    summary: '读取笔记本抽取器策略与可用抽取器清单',
    tags: ['sources'],
    responses: { 200: { description: '抽取器策略与清单', body: ExtractorsListSchema } },
  },
  {
    path: '/v2/notebooks/:nid/extractors',
    method: 'patch',
    summary: '更新笔记本抽取器策略（mode / enabledExtractors 白名单校验）',
    tags: ['sources'],
    request: { body: PatchNotebookExtractorPolicySchema },
    responses: { 200: { description: '更新后的抽取器策略与清单', body: ExtractorsListSchema } },
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
  const row = requireOwnedRow(sources, id, notebookId, 'Source');

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
  const row = requireOwnedRow(sources, id, notebookId, 'Source');

  deleteSourceVectors(db(), id);
  db().delete(sources).where(eq(sources.id, id)).run();
  if (row.notebookId) bumpSourcesEpoch(row.notebookId);

  set.status = 204;
  return;
}

function handleGetSourceChunks(id: number, notebookId: number) {
  requireOwnedRow(sources, id, notebookId, 'Source');
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
  const row = requireOwnedRow(sources, id, notebookId, 'Source');
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

  // Delete a source (nested canonical)
  .delete(
    '/notebooks/:nid/sources/:sid',
    ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'source id');
      handleDeleteSource(sid, nid, set);
    },
    { response: { 204: Empty204Schema } },
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
      return listNotebookTags(nid);
    },
    { response: SourceTagSchema.array() },
  )

  .post(
    '/notebooks/:nid/sources/tags',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tag = createTag(nid, body.name);
      set.status = 201;
      return tag;
    },
    { body: SourceTagCreateSchema, response: SourceTagSchema },
  )

  .patch(
    '/notebooks/:nid/sources/tags/:tid',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      return renameTag(nid, tid, body.name);
    },
    { body: SourceTagCreateSchema, response: SourceTagSchema },
  )

  .delete(
    '/notebooks/:nid/sources/tags/:tid',
    ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      deleteTag(nid, tid);
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
      return assignSourcesToTag(nid, tid, body);
    },
    { body: SourceTagBindingRequestSchema, response: SourceTagBindingResponseSchema },
  )

  .delete(
    '/notebooks/:nid/sources/tags/:tid/sources',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const tid = requirePositiveIntId(params.tid, 'tag id');
      return removeSourcesFromTag(nid, tid, body);
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

      // mode is web-search channel metadata (echo); not Deep Research / ResearchRun.
      const searchMode = mode && mode !== 'Deep Research' ? mode : 'Fast Research';

      return {
        status: results.length > 0 ? 'ok' : 'no_results',
        query,
        engine: engine ?? 'searxng',
        mode: searchMode,
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
      return batchDeleteSources(nid, body);
    },
    { body: SourceBatchDeleteRequestSchema, response: SourceBatchDeleteResponseSchema },
  )

  // Batch re-embed sources
  // c57: per-item results array + clear all error fields
  .post(
    '/notebooks/:nid/sources/batch/re-embed',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return batchReembedSources(nid, body);
    },
    { body: SourceBatchReembedRequestSchema, response: SourceBatchReembedResponseSchema },
  )

  // Ingest from URL (c39: dedup default prompt + link mode + SSRF fallback fix)
  .post(
    '/notebooks/:nid/sources/from-url',
    async ({ params, body, query, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const outcome = await ingestFromUrl(nid, body, query);
      if (outcome.kind === 'reused') {
        return { reused: true as const, source: handleGetSource(outcome.sourceId, nid) };
      }
      if (outcome.kind === 'created-link') {
        set.status = 201;
        return outcome.payload;
      }
      return outcome.payload;
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
