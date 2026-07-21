import {
  Empty204Schema,
  NotebookIdQuerySchema,
  OutputConvertToSourceResponseSchema,
  OutputExportFormatQuerySchema,
  OutputExportJsonResponseSchema,
  OutputExportQuerySchema,
  OutputGenerateNestedRequestSchema,
  OutputGenerateRequestSchema,
  OutputSchema,
  OutputsPageSchema,
  PaginationParamsSchema,
  ParagraphContentSchema,
  CitationSchema,
  ToolOutputTypeSchema,
  type Citation,
  type OutputGenerateBody,
} from '@crystalith/shared';
import { NoSuchModelError, TypeValidationError, APICallError, NoObjectGeneratedError } from 'ai';
// Outputs router — nested canonical + flat deprecated aliases (c69).
//
// Canonical:
//   POST   /v2/notebooks/:nid/outputs
//   GET    /v2/notebooks/:nid/outputs
//   GET    /v2/notebooks/:nid/outputs/:id
//   DELETE /v2/notebooks/:nid/outputs/:id
//   GET    /v2/notebooks/:nid/outputs/:id/export
//   POST   /v2/notebooks/:nid/outputs/:id/convert-to-source
// Flat aliases (deprecated): /v2/outputs{,/:id,/export,/convert-to-source}
// (c73: GET /v2/outputs/types removed — FE uses GET /v2/workspace/tools)
import { count, desc, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { outputs, notebooks, sources, chunks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { bumpSourcesEpoch } from '../../rag/cache.ts';
import { getDefaultChatModel, getModelById } from '../../shared/config.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import { runOutputPipeline } from './pipeline.ts';
import { renderOutputToMarkdown, splitTextToChunks } from './render.ts';

/** JSON export is Zod-validated; markdown download is a raw Response (bypass object schema). */
const OutputExportResponseSchema = z.union([
  OutputExportJsonResponseSchema,
  z.custom<Response>((value) => value instanceof Response),
]);

function requireOutputInNotebook(id: number, notebookId: number): typeof outputs.$inferSelect {
  const row = db().select().from(outputs).where(eq(outputs.id, id)).get();
  if (!row || row.notebookId !== notebookId) {
    throw new NotFoundError(`Output ${id} not found`);
  }
  return row;
}

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const OutputsListQuerySchema = NotebookIdQuerySchema.extend(PaginationParamsSchema.shape);

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/outputs',
    method: 'post',
    summary: 'Generate a new output',
    tags: ['outputs'],
    request: { body: OutputGenerateNestedRequestSchema },
    responses: { 201: { description: 'Generated output' } },
  },
  {
    path: '/v2/notebooks/:nid/outputs',
    method: 'get',
    summary: 'List outputs for a notebook',
    tags: ['outputs'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated output list', body: OutputsPageSchema } },
  },
  {
    path: '/v2/notebooks/:nid/outputs/:id',
    method: 'get',
    summary: 'Get a single output',
    tags: ['outputs'],
    responses: { 200: { description: 'Output details', body: OutputSchema } },
  },
  {
    path: '/v2/notebooks/:nid/outputs/:id',
    method: 'delete',
    summary: 'Delete an output',
    tags: ['outputs'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/notebooks/:nid/outputs/:id/export',
    method: 'get',
    summary: 'Export an output (markdown or json)',
    tags: ['outputs'],
    responses: { 200: { description: 'Exported output' } },
  },
  {
    path: '/v2/notebooks/:nid/outputs/:id/convert-to-source',
    method: 'post',
    summary: 'Convert an output to a source',
    tags: ['outputs'],
    responses: { 201: { description: 'Created source' } },
  },
  {
    path: '/v2/outputs',
    method: 'post',
    summary: 'Generate a new output',
    tags: ['outputs'],
    deprecated: true,
    request: { body: OutputGenerateRequestSchema },
    responses: { 201: { description: 'Generated output' } },
  },
  {
    path: '/v2/outputs',
    method: 'get',
    summary: 'List outputs for a notebook',
    tags: ['outputs'],
    deprecated: true,
    request: {
      query: {
        notebookId: NotebookIdQuerySchema.shape.notebookId,
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated output list', body: OutputsPageSchema } },
  },
  {
    path: '/v2/outputs/:id',
    method: 'get',
    summary: 'Get a single output',
    tags: ['outputs'],
    deprecated: true,
    responses: { 200: { description: 'Output details', body: OutputSchema } },
  },
  {
    path: '/v2/outputs/:id',
    method: 'delete',
    summary: 'Delete an output',
    tags: ['outputs'],
    deprecated: true,
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/outputs/:id/export',
    method: 'get',
    summary: 'Export an output (markdown or json)',
    tags: ['outputs'],
    deprecated: true,
    responses: { 200: { description: 'Exported output' } },
  },
  {
    path: '/v2/outputs/:id/convert-to-source',
    method: 'post',
    summary: 'Convert an output to a source',
    tags: ['outputs'],
    deprecated: true,
    responses: { 201: { description: 'Created source' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SetStatus = { status?: number | string; headers: Record<string, string | number> };

function serializeOutput(row: typeof outputs.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    type: row.type,
    prompt: row.prompt,
    chunkIds: row.chunkIds,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const PREVIEW_MAX = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Thin list projection — no full content (c72). */
function serializeOutputListItem(row: typeof outputs.$inferSelect) {
  const content = isRecord(row.content) ? row.content : null;

  let title: string | null = null;
  let preview: string | null = null;
  let slideId: number | null = null;

  if (content) {
    if (typeof content.title === 'string' && content.title.trim()) {
      title = content.title.trim();
    }
    if (typeof content.slideId === 'number' && Number.isFinite(content.slideId)) {
      slideId = content.slideId;
    }
    const markdown = typeof content.markdown === 'string' ? content.markdown : null;
    const summary = typeof content.summary === 'string' ? content.summary : null;
    const text = typeof content.text === 'string' ? content.text : null;
    const rawPreview = (markdown ?? summary ?? text ?? '').trim();
    if (rawPreview) {
      preview =
        rawPreview.length > PREVIEW_MAX ? `${rawPreview.slice(0, PREVIEW_MAX)}…` : rawPreview;
    }
  }

  if (!title && row.prompt?.trim()) {
    title = row.prompt.trim().slice(0, 120);
  }

  return {
    id: row.id,
    notebookId: row.notebookId,
    type: row.type,
    prompt: row.prompt,
    title,
    preview,
    slideId,
    chunkIds: row.chunkIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Walk an output's content tree and collect only the citations actually
 * referenced by leaf nodes (v1 _collect_output_citations, api.py:124-156).
 * pipeline.mapCitationsIntoContent already resolved numeric `citations` arrays
 * into full Citation dicts embedded on leaf nodes, so we recurse and dedup by
 * chunk_id in first-seen order. Returns the cited subset — NOT the full
 * retrieved-chunk superset stored in `outputs.chunkIds`.
 */
export function collectCitedCitations(content: Record<string, unknown> | null): Citation[] {
  if (!content) return [];
  const seen = new Set<number>();
  const out: Citation[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    const cited = node.citations;
    if (Array.isArray(cited)) {
      for (const c of cited) {
        const parsed = CitationSchema.safeParse(c);
        if (!parsed.success) continue;
        const chunkId = parsed.data.chunkId;
        if (seen.has(chunkId)) continue;
        seen.add(chunkId);
        out.push(parsed.data);
      }
    }
    // Recurse into all object-valued properties.
    for (const v of Object.values(node)) visit(v);
  };
  visit(content);
  return out;
}

async function handleGenerateOutput(
  notebookId: number,
  body: OutputGenerateBody,
  set: SetStatus,
  request: Request,
) {
  const {
    type,
    chunkIds,
    sourceIds,
    prompt: promptRaw,
    content: contentRaw,
    preference,
    topK,
    minScore,
    modelId,
  } = body;

  // Normalize output type to uppercase (API accepts both 'faq' and 'FAQ')
  const normalizedType = type.toUpperCase();

  // Verify notebook
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

  // Manual markdown note: schema already allows `content`; honor it for PARAGRAPH
  // without LLM / sourceIds (Studio「添加笔记」).
  if (normalizedType === 'PARAGRAPH' && contentRaw !== null && isRecord(contentRaw)) {
    const parsedContent = ParagraphContentSchema.safeParse(contentRaw);
    if (!parsedContent.success) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Invalid PARAGRAPH content');
    }
    const text = parsedContent.data.text?.trim() ?? '';
    if (!text) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'PARAGRAPH content.text must not be empty');
    }
    const title =
      (typeof parsedContent.data.title === 'string' && parsedContent.data.title.trim()) ||
      text
        .split('\n')
        .find((line) => line.trim())
        ?.replace(/^#+\s*/u, '')
        .trim()
        .slice(0, 80) ||
      '笔记';
    const content = { ...parsedContent.data, title, text };
    const output = db()
      .insert(outputs)
      .values({
        notebookId,
        type: 'PARAGRAPH',
        prompt: promptRaw?.trim() || title,
        chunkIds: chunkIds?.length ? chunkIds : [],
        content,
      })
      .returning()
      .get();
    set.status = 201;
    return serializeOutput(output);
  }

  const parsedType = ToolOutputTypeSchema.safeParse(normalizedType);
  if (!parsedType.success) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Unsupported output type: ${type}`);
  }

  // c50: reject SLIDES — v1 api.py:205-206 returns 400 "Use slides endpoints
  // for SLIDES output". SLIDES has its own studio pipeline; the generic
  // outputs pipeline has no SLIDES postprocess/isContentEmpty case.
  if (parsedType.data === 'SLIDES') {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Use slides endpoints for SLIDES output');
  }

  // c38 gap fix: sourceIds is required when chunkIds is not provided (v1 api.py:292-293)
  const resolvedSourceIds = sourceIds?.length ? sourceIds : undefined;
  const resolvedChunkIds = chunkIds?.length ? chunkIds : undefined;
  if (!resolvedChunkIds?.length && !resolvedSourceIds?.length) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      'sourceIds must not be empty (or provide chunkIds)',
    );
  }

  // Resolve model (config default or explicit modelId override)
  const modelConfig = modelId ? getModelById(modelId) : getDefaultChatModel();
  // c42: granular error mapping (v1 api.py:309-361) — typed exceptions, not string matching
  if (!modelConfig) {
    throw new AppHttpError(ErrorCode.MODEL_UNAVAILABLE, 'No chat model configured');
  }

  let model;
  try {
    model = withRetry(await resolveModel(modelConfig));
  } catch (error) {
    // Model resolution failure → 503 (v1 ModelConfigurationError)
    if (error instanceof NoSuchModelError) {
      throw new AppHttpError(ErrorCode.MODEL_UNAVAILABLE, 'Model not available');
    }
    throw error;
  }

  let result;
  try {
    result = await runOutputPipeline({
      model,
      notebookId,
      type: parsedType.data,
      chunkIds: resolvedChunkIds,
      sourceIds: resolvedSourceIds,
      prompt: promptRaw ?? undefined,
      preference: preference === 'speed' ? 'speed' : 'quality',
      topK: topK ?? undefined,
      minScore: minScore ?? undefined,
      modelId: modelId ?? undefined,
      abortSignal: request.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Client cancelled');
    }
    const msg = error instanceof Error ? error.message : String(error);
    // Typed error mapping (v1 api.py:309-361)
    if (error instanceof TypeValidationError || error instanceof NoObjectGeneratedError) {
      throw new AppHttpError(ErrorCode.SCHEMA_VALIDATION_FAILED, msg);
    }
    if (error instanceof NoSuchModelError || error instanceof APICallError) {
      throw new AppHttpError(ErrorCode.MODEL_ERROR, msg);
    }
    if (msg.includes('retrieval')) {
      throw new AppHttpError(ErrorCode.INVALID_REQUEST, msg);
    }
    throw new AppHttpError(ErrorCode.INTERNAL_ERROR, msg);
  }

  // c42: return v1 OutputRead contract (snake_case) instead of PipelineResult
  const row = db().select().from(outputs).where(eq(outputs.id, result.outputId)).get();
  set.status = 201;
  return serializeOutput(row!);
}

function handleListOutputs(notebookId: number, offset: number, limit: number) {
  const total =
    db().select({ n: count() }).from(outputs).where(eq(outputs.notebookId, notebookId)).get()?.n ??
    0;

  const rows = db()
    .select()
    .from(outputs)
    .where(eq(outputs.notebookId, notebookId))
    .orderBy(desc(outputs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    items: rows.map(serializeOutputListItem),
    total,
    offset,
    limit,
  };
}

function handleGetOutput(id: number, notebookId: number) {
  const row = requireOutputInNotebook(id, notebookId);
  return serializeOutput(row);
}

function handleDeleteOutput(id: number, notebookId: number, set: SetStatus) {
  requireOutputInNotebook(id, notebookId);
  db().delete(outputs).where(eq(outputs.id, id)).run();
  set.status = 204;
  return;
}

function handleExportOutput(id: number, notebookId: number, format: 'markdown' | 'json') {
  const row = requireOutputInNotebook(id, notebookId);

  const exportedAt = new Date().toISOString();

  // P1-6: collect only the citations actually referenced in the content tree
  // (v1 _collect_output_citations, api.py:124-156). pipeline.mapCitationsIntoContent
  // already resolved numeric indices into full Citation dicts embedded on
  // leaf nodes, so we walk the tree and dedup by chunk_id (first-seen order).
  // This replaces the prior `row.chunkIds` join which listed ALL retrieved
  // chunks (the superset), not just the cited ones.
  const citations = collectCitedCitations(isRecord(row.content) ? row.content : null);
  const sourceIds = [...new Set(citations.map((c) => c.sourceId))];
  const sourceRows = sourceIds.length
    ? db().select().from(sources).where(inArray(sources.id, sourceIds)).all()
    : [];

  if (format === 'json') {
    // c42: full citation fields + correct source metadata (v1 OutputExportJson)
    return {
      notebookId: row.notebookId,
      outputId: row.id,
      outputType: row.type,
      prompt: row.prompt,
      content: row.content,
      citations,
      sources: sourceRows.map((s) => ({
        sourceId: s.id,
        sourceName: s.filename,
        mimeType: s.mimeType,
        parserType: s.parserType,
      })),
      exportedAt,
    };
  }

  // Markdown format — type-aware rendering (v1 _extract_text_from_output)
  // + Citations and Sources sections (v1 api.py:441-476). Citation line
  // format aligns with v1 api.py:452-461:
  //   [N] source_name · chunk N[ · page N][ · para N]
  //   > snippet
  const bodyMarkdown = renderOutputToMarkdown(
    row.type,
    isRecord(row.content) ? row.content : null,
    row.prompt,
  );
  const citationLines = citations.map((c, i) => {
    const parts = [`[${i + 1}] ${c.sourceName}`, `chunk ${c.chunkIndex}`];
    if (c.pageNumber !== null && c.pageNumber !== undefined) parts.push(`page ${c.pageNumber}`);
    if (c.paragraphIndex !== null && c.paragraphIndex !== undefined)
      parts.push(`para ${c.paragraphIndex}`);
    const line = parts.join(' · ');
    const snippet = (c.snippet ?? '').trim();
    return snippet ? `${line}\n> ${snippet}` : line;
  });
  const markdown = [
    bodyMarkdown,
    '',
    '## Citations',
    citationLines.length ? citationLines.join('\n\n') : '无引用',
    '',
    '## Sources',
    sourceRows.map((s) => `- ${s.filename} (${s.status})`).join('\n') || '无来源',
  ].join('\n');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="output-${row.id}-${row.type}.md"`,
    },
  });
}

async function handleConvertOutputToSource(id: number, notebookId: number, set: SetStatus) {
  const row = requireOutputInNotebook(id, notebookId);

  // Render output content to type-aware markdown (not raw JSON)
  const markdown = renderOutputToMarkdown(
    row.type,
    isRecord(row.content) ? row.content : null,
    row.prompt,
  );

  // Split into chunks for embedding (v1: 500/50 paragraph+sentence aware)
  const chunkTexts = splitTextToChunks(markdown, 500, 50);
  const filename = `output-${row.id}-${row.type}.md`;

  const sourceRow = db()
    .insert(sources)
    .values({
      notebookId: row.notebookId,
      filename,
      mimeType: 'text/markdown',
      parserType: 'text',
      status: 'processing',
      metadata: { type: row.type, source: 'output_conversion' },
    })
    .returning()
    .get();

  // Create chunks
  let offset = 0;
  for (let i = 0; i < chunkTexts.length; i++) {
    const text = chunkTexts[i];
    db()
      .insert(chunks)
      .values({
        sourceId: sourceRow.id,
        chunkIndex: i,
        text,
        startOffset: offset,
        endOffset: offset + text.length,
      })
      .run();
    // +2 for paragraph separator
    offset += text.length + 2;
  }

  // Embed the chunks so they're discoverable via semantic search.
  try {
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    const strategy = new EmbedStrategy();
    await strategy.indexSource(sourceRow.id, sourceRow.notebookId);
    db().update(sources).set({ status: 'ready' }).where(eq(sources.id, sourceRow.id)).run();
    bumpSourcesEpoch(sourceRow.notebookId);
  } catch {
    db().update(sources).set({ status: 'failed' }).where(eq(sources.id, sourceRow.id)).run();
    bumpSourcesEpoch(sourceRow.notebookId);
  }

  set.status = 201;
  return {
    sourceId: sourceRow.id,
    filename: sourceRow.filename,
    chunkCount: chunkTexts.length,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const outputsRouter = new Elysia({ prefix: '/v2' })
  // ---- Nested canonical ----
  .post(
    '/notebooks/:nid/outputs',
    async ({ params, body, set, request }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      return handleGenerateOutput(notebookId, body, set, request);
    },
    { body: OutputGenerateNestedRequestSchema, response: OutputSchema },
  )
  .get(
    '/notebooks/:nid/outputs',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return handleListOutputs(nid, query.offset ?? 0, query.limit ?? 20);
    },
    { query: PaginationParamsSchema, response: OutputsPageSchema },
  )
  .get(
    '/notebooks/:nid/outputs/:id',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'output id');
      return handleGetOutput(id, nid);
    },
    { response: OutputSchema },
  )
  .delete(
    '/notebooks/:nid/outputs/:id',
    ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'output id');
      return handleDeleteOutput(id, nid, set);
    },
    { response: { 204: Empty204Schema } },
  )
  .get(
    '/notebooks/:nid/outputs/:id/export',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'output id');
      return handleExportOutput(id, nid, query.format);
    },
    { query: OutputExportFormatQuerySchema, response: OutputExportResponseSchema },
  )
  .post(
    '/notebooks/:nid/outputs/:id/convert-to-source',
    async ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'output id');
      return handleConvertOutputToSource(id, nid, set);
    },
    { response: OutputConvertToSourceResponseSchema },
  )

  // ---- Flat aliases (deprecated; c67 notebookId still required) ----
  .post(
    '/outputs',
    async ({ body, set, request }) => handleGenerateOutput(body.notebookId, body, set, request),
    { body: OutputGenerateRequestSchema, response: OutputSchema },
  )
  .get(
    '/outputs',
    ({ query }) => handleListOutputs(query.notebookId, query.offset ?? 0, query.limit ?? 20),
    { query: OutputsListQuerySchema, response: OutputsPageSchema },
  )
  .get(
    '/outputs/:id',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'output id');
      return handleGetOutput(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: OutputSchema },
  )
  .delete(
    '/outputs/:id',
    ({ params, query, set }) => {
      const id = requirePositiveIntId(params.id, 'output id');
      return handleDeleteOutput(id, query.notebookId, set);
    },
    { query: NotebookIdQuerySchema, response: { 204: Empty204Schema } },
  )
  .get(
    '/outputs/:id/export',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'output id');
      return handleExportOutput(id, query.notebookId, query.format);
    },
    { query: OutputExportQuerySchema, response: OutputExportResponseSchema },
  )
  .post(
    '/outputs/:id/convert-to-source',
    async ({ params, query, set }) => {
      const id = requirePositiveIntId(params.id, 'output id');
      return handleConvertOutputToSource(id, query.notebookId, set);
    },
    { query: NotebookIdQuerySchema, response: OutputConvertToSourceResponseSchema },
  );

registerApiDoc(apiDocs);
