// Studio slides router — nested canonical + flat deprecated aliases (c69).
//
// Canonical: /v2/notebooks/:nid/studio/slides*
// Flat aliases: /v2/studio/slides* (c67 ?notebookId=)
//
// Two-stage generation with HITL review/edit:
//   1. POST /slides/:id/outline   → generateText+Output → stage=outline
//   2. PUT  /slides/:id/outline   → manual edit outline (HITL review)
//   3. POST /slides/:id/markdown  → streamText from outline → stage=markdown
//   4. PUT  /slides/:id/markdown  → manual edit markdown + Slidev persist + output sync
//   5. GET  /slides/:id/outline/stream  → SSE (c43)
//   6. GET  /slides/:id/markdown/stream  → SSE (c43)
//
// CRUD: POST (create) / GET (list/id/latest) / PATCH (edit draft fields)
// Slidev (c32): write .md to data/slides/ for preview
//
// H5+H6: generation logic + SSE helper extracted to service.ts
import {
  NotebookIdQuerySchema,
  PaginatedSchema,
  PaginationParamsSchema,
  SlideDraftCreateNestedRequestSchema,
  SlideDraftCreateRequestSchema,
  SlideDraftUpdateSchema,
  StudioMarkdownPutSchema,
  StudioOutlinePutSchema,
  StudioSlideSchema,
  StudioSlidesListQuerySchema,
  type SlideDraftCreateBody,
  type SlideDraftUpdate,
  type StudioMarkdownPut,
  type StudioOutlinePut,
} from '@crystalith/shared';
import { count, desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, studioSlides } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import {
  clearStaleRunning,
  createSseResponse,
  generateMarkdown,
  generateOutline,
  getContext,
  syncSlideOutput,
  writeSlideFile,
} from './service.ts';

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const SlidesPageSchema = PaginatedSchema(StudioSlideSchema);

const apiDocs: OpenApiRoute[] = [
  // Nested canonical
  {
    path: '/v2/notebooks/:nid/studio/slides',
    method: 'post',
    summary: 'Create a slide draft',
    tags: ['studio'],
    request: { body: SlideDraftCreateNestedRequestSchema },
    responses: { 201: { description: 'Created slide draft' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides',
    method: 'get',
    summary: 'List slide drafts for a notebook',
    tags: ['studio'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated slide draft list', body: SlidesPageSchema } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/latest',
    method: 'get',
    summary: 'Get latest slide draft for a notebook',
    tags: ['studio'],
    responses: { 200: { description: 'Latest slide draft' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id',
    method: 'get',
    summary: 'Get a slide draft',
    tags: ['studio'],
    responses: { 200: { description: 'Slide draft details' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id',
    method: 'patch',
    summary: 'Update slide draft fields',
    tags: ['studio'],
    request: { body: SlideDraftUpdateSchema },
    responses: { 200: { description: 'Draft updated' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/outline',
    method: 'post',
    summary: 'Generate outline via AI (stage 1)',
    tags: ['studio'],
    responses: { 200: { description: 'Outline generated' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/outline',
    method: 'put',
    summary: 'Edit outline manually (HITL review)',
    tags: ['studio'],
    request: { body: StudioOutlinePutSchema },
    responses: { 200: { description: 'Outline updated' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/markdown',
    method: 'post',
    summary: 'Generate markdown from outline via AI (stage 2)',
    tags: ['studio'],
    responses: { 200: { description: 'Markdown generated' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/markdown',
    method: 'put',
    summary: 'Edit markdown manually + Slidev persist + output sync (HITL)',
    tags: ['studio'],
    request: { body: StudioMarkdownPutSchema },
    responses: { 200: { description: 'Markdown updated and persisted' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/outline/stream',
    method: 'get',
    summary: 'SSE stream outline generation',
    tags: ['studio'],
    responses: { 200: { description: 'SSE event stream', contentType: 'text/event-stream' } },
  },
  {
    path: '/v2/notebooks/:nid/studio/slides/:id/markdown/stream',
    method: 'get',
    summary: 'SSE stream markdown generation',
    tags: ['studio'],
    responses: { 200: { description: 'SSE event stream', contentType: 'text/event-stream' } },
  },
  // Flat deprecated aliases
  {
    path: '/v2/studio/slides',
    method: 'post',
    summary: 'Create a slide draft',
    tags: ['studio'],
    deprecated: true,
    request: { body: SlideDraftCreateRequestSchema },
    responses: { 201: { description: 'Created slide draft' } },
  },
  {
    path: '/v2/studio/slides',
    method: 'get',
    summary: 'List slide drafts for a notebook',
    tags: ['studio'],
    deprecated: true,
    request: {
      query: {
        notebookId: StudioSlidesListQuerySchema.shape.notebookId,
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated slide draft list', body: SlidesPageSchema } },
  },
  {
    path: '/v2/studio/slides/latest',
    method: 'get',
    summary: 'Get latest slide draft for a notebook',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'Latest slide draft' } },
  },
  {
    path: '/v2/studio/slides/:id',
    method: 'get',
    summary: 'Get a slide draft',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'Slide draft details' } },
  },
  {
    path: '/v2/studio/slides/:id',
    method: 'patch',
    summary: 'Update slide draft fields',
    tags: ['studio'],
    deprecated: true,
    request: { body: SlideDraftUpdateSchema },
    responses: { 200: { description: 'Draft updated' } },
  },
  {
    path: '/v2/studio/slides/:id/outline',
    method: 'post',
    summary: 'Generate outline via AI (stage 1)',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'Outline generated' } },
  },
  {
    path: '/v2/studio/slides/:id/outline',
    method: 'put',
    summary: 'Edit outline manually (HITL review)',
    tags: ['studio'],
    deprecated: true,
    request: { body: StudioOutlinePutSchema },
    responses: { 200: { description: 'Outline updated' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown',
    method: 'post',
    summary: 'Generate markdown from outline via AI (stage 2)',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'Markdown generated' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown',
    method: 'put',
    summary: 'Edit markdown manually + Slidev persist + output sync (HITL)',
    tags: ['studio'],
    deprecated: true,
    request: { body: StudioMarkdownPutSchema },
    responses: { 200: { description: 'Markdown updated and persisted' } },
  },
  {
    path: '/v2/studio/slides/:id/outline/stream',
    method: 'get',
    summary: 'SSE stream outline generation',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'SSE event stream', contentType: 'text/event-stream' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown/stream',
    method: 'get',
    summary: 'SSE stream markdown generation',
    tags: ['studio'],
    deprecated: true,
    responses: { 200: { description: 'SSE event stream', contentType: 'text/event-stream' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSlide(row: typeof studioSlides.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    // c51: v1 SlideDraftRead (api.py:76-94) includes outputId + generationConfig
    outputId: row.outputId ?? null,
    title: row.title,
    prompt: row.prompt,
    engine: row.engine,
    chunkIds: row.chunkIds,
    sourceIds: row.sourceIds,
    outline: row.outline,
    markdown: row.markdown,
    generationConfig: row.generationConfig ?? null,
    stage: row.stage,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getSlideOrThrow(id: number): typeof studioSlides.$inferSelect {
  const row = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
  if (!row) throw new NotFoundError(`Slide ${id} not found`);
  return row;
}

function getSlideInNotebookOrThrow(
  id: number,
  notebookId: number,
): typeof studioSlides.$inferSelect {
  const row = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
  if (!row || row.notebookId !== notebookId) {
    throw new NotFoundError(`Slide ${id} not found`);
  }
  return row;
}

// ---------------------------------------------------------------------------
// Handlers (shared by nested + flat)
// ---------------------------------------------------------------------------

function handleCreateSlide(notebookId: number, body: SlideDraftCreateBody) {
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

  const slide = db()
    .insert(studioSlides)
    .values({
      notebookId,
      title: body.title ?? null,
      prompt: body.prompt ?? null,
      engine: body.engine ?? 'slidev',
      sourceIds: body.sourceIds,
      generationConfig: body.generationConfig ?? null,
      stage: 'input',
      status: 'idle',
    })
    .returning()
    .get();
  return serializeSlide(slide);
}

function handleListSlides(notebookId: number, offset: number, limit: number) {
  const total =
    db()
      .select({ n: count() })
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .get()?.n ?? 0;
  const items = db()
    .select()
    .from(studioSlides)
    .where(eq(studioSlides.notebookId, notebookId))
    .limit(limit)
    .offset(offset)
    .all()
    .map(serializeSlide);
  return { items, total, offset, limit };
}

function handleLatestSlide(notebookId: number) {
  const row = db()
    .select()
    .from(studioSlides)
    .where(eq(studioSlides.notebookId, notebookId))
    .orderBy(desc(studioSlides.updatedAt))
    .get();
  if (!row) throw new NotFoundError('Slide draft not found');
  return serializeSlide(row);
}

function handleGetSlide(id: number, notebookId: number) {
  return serializeSlide(getSlideInNotebookOrThrow(id, notebookId));
}

function handlePatchSlide(id: number, notebookId: number, body: SlideDraftUpdate) {
  getSlideInNotebookOrThrow(id, notebookId);
  const updateData: Record<string, unknown> = { errorMessage: null };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.prompt !== undefined) updateData.prompt = body.prompt;
  if (body.engine !== undefined) updateData.engine = body.engine;
  if (body.sourceIds !== undefined) updateData.sourceIds = body.sourceIds;
  if (body.generationConfig !== undefined) updateData.generationConfig = body.generationConfig;
  if (body.outline !== undefined) updateData.outline = body.outline;
  if (body.markdown !== undefined) updateData.markdown = body.markdown;
  if (body.stage !== undefined) updateData.stage = body.stage;
  db().update(studioSlides).set(updateData).where(eq(studioSlides.id, id)).run();
  return serializeSlide(getSlideOrThrow(id));
}

async function handleGenerateOutline(id: number, notebookId: number) {
  const slide = getSlideInNotebookOrThrow(id, notebookId);
  if (!clearStaleRunning(id)) {
    throw new AppHttpError(ErrorCode.CONFLICT, '演示正在生成中，请稍后重试。');
  }

  const context = await getContext(slide);
  db()
    .update(studioSlides)
    .set({ status: 'running', stage: 'outline' })
    .where(eq(studioSlides.id, id))
    .run();
  try {
    const outline = await generateOutline(slide, context);
    db()
      .update(studioSlides)
      .set({ outline, stage: 'outline', status: 'idle' })
      .where(eq(studioSlides.id, id))
      .run();
    return serializeSlide(getSlideOrThrow(id));
  } catch (error) {
    db()
      .update(studioSlides)
      .set({ status: 'error', errorMessage: String(error) })
      .where(eq(studioSlides.id, id))
      .run();
    throw error;
  }
}

function handlePutOutline(id: number, notebookId: number, body: StudioOutlinePut) {
  getSlideInNotebookOrThrow(id, notebookId);
  db()
    .update(studioSlides)
    .set({
      outline: body.outline,
      stage: 'outline',
      status: 'idle',
      errorMessage: null,
    })
    .where(eq(studioSlides.id, id))
    .run();
  return serializeSlide(getSlideOrThrow(id));
}

async function handleGenerateMarkdown(id: number, notebookId: number) {
  const slide = getSlideInNotebookOrThrow(id, notebookId);
  if (!slide.outline) throw new NotFoundError(`Slide ${id} has no outline — run /outline first`);
  if (!clearStaleRunning(id)) {
    throw new AppHttpError(ErrorCode.CONFLICT, '演示正在生成中，请稍后重试。');
  }

  const context = await getContext(slide);
  db()
    .update(studioSlides)
    .set({ status: 'running', stage: 'markdown' })
    .where(eq(studioSlides.id, id))
    .run();
  try {
    const markdown = await generateMarkdown(slide, context);
    db()
      .update(studioSlides)
      .set({ markdown, stage: 'markdown', status: 'idle' })
      .where(eq(studioSlides.id, id))
      .run();
    writeSlideFile(slide.notebookId, id, markdown);
    syncSlideOutput(slide, markdown);
    return serializeSlide(getSlideOrThrow(id));
  } catch (error) {
    db()
      .update(studioSlides)
      .set({ status: 'error', errorMessage: String(error) })
      .where(eq(studioSlides.id, id))
      .run();
    throw error;
  }
}

function handlePutMarkdown(id: number, notebookId: number, body: StudioMarkdownPut) {
  const slide = getSlideInNotebookOrThrow(id, notebookId);
  const { markdown } = body;
  try {
    writeSlideFile(slide.notebookId, id, markdown);
  } catch (error) {
    console.error('[studio] slidev file write failed:', error);
  }
  syncSlideOutput(slide, markdown);
  db()
    .update(studioSlides)
    .set({ markdown, stage: 'markdown', status: 'idle', errorMessage: null })
    .where(eq(studioSlides.id, id))
    .run();
  return serializeSlide(getSlideOrThrow(id));
}

function handleOutlineStream(id: number, notebookId: number) {
  const slide = getSlideInNotebookOrThrow(id, notebookId);

  return createSseResponse(id, async (emit, ctx) => {
    emit('progress', { stage: 'outline', progress: 5, message: '开始生成大纲' });
    const context = await getContext(slide);
    db()
      .update(studioSlides)
      .set({ status: 'running', stage: 'outline' })
      .where(eq(studioSlides.id, id))
      .run();

    // c51: emit toolcall before the generation stage (v1 api.py:401)
    emit('toolcall', { tool: 'slides_generate_outline', slideId: id });
    const outline = await generateOutline(slide, context);
    emit('progress', { stage: 'outline', progress: 90, message: '大纲生成完成' });
    db()
      .update(studioSlides)
      .set({ outline, stage: 'outline', status: 'idle' })
      .where(eq(studioSlides.id, id))
      .run();
    // c51: done payload = {traceId, slideId} (v1 api.py:428)
    emit('done', { traceId: ctx.traceId, slideId: id });
  });
}

function handleMarkdownStream(id: number, notebookId: number) {
  const slide = getSlideInNotebookOrThrow(id, notebookId);
  if (!slide.outline) throw new NotFoundError(`Slide ${id} has no outline`);

  return createSseResponse(id, async (emit, ctx) => {
    emit('progress', { stage: 'markdown', progress: 5, message: '开始生成幻灯片' });
    const context = await getContext(slide);
    db()
      .update(studioSlides)
      .set({ status: 'running', stage: 'markdown' })
      .where(eq(studioSlides.id, id))
      .run();

    // c51: emit toolcall before the generation stage (v1 api.py:506)
    emit('toolcall', { tool: 'slides_generate_markdown', slideId: id });
    const markdown = await generateMarkdown(slide, context, (delta) => {
      emit('progress', { stage: 'markdown', delta });
    });

    db()
      .update(studioSlides)
      .set({ markdown, stage: 'markdown', status: 'idle' })
      .where(eq(studioSlides.id, id))
      .run();
    writeSlideFile(slide.notebookId, id, markdown);
    syncSlideOutput(slide, markdown);
    // c51: done payload = {traceId, slideId} (v1 api.py:538)
    emit('done', { traceId: ctx.traceId, slideId: id });
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const studioRouter = new Elysia({ prefix: '/v2' })
  // ---- Nested canonical ----
  .post(
    '/notebooks/:nid/studio/slides',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      set.status = 201;
      return handleCreateSlide(notebookId, body);
    },
    { body: SlideDraftCreateNestedRequestSchema, response: StudioSlideSchema },
  )
  .get(
    '/notebooks/:nid/studio/slides',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return handleListSlides(nid, query.offset ?? 0, query.limit ?? 20);
    },
    { query: PaginationParamsSchema, response: SlidesPageSchema },
  )
  // Static /latest before /:id
  .get(
    '/notebooks/:nid/studio/slides/latest',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return handleLatestSlide(nid);
    },
    { response: StudioSlideSchema },
  )
  .get(
    '/notebooks/:nid/studio/slides/:id',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handleGetSlide(id, nid);
    },
    { response: StudioSlideSchema },
  )
  .patch(
    '/notebooks/:nid/studio/slides/:id',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handlePatchSlide(id, nid, body);
    },
    { body: SlideDraftUpdateSchema, response: StudioSlideSchema },
  )
  .post(
    '/notebooks/:nid/studio/slides/:id/outline',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handleGenerateOutline(id, nid);
    },
    { response: StudioSlideSchema },
  )
  .put(
    '/notebooks/:nid/studio/slides/:id/outline',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handlePutOutline(id, nid, body);
    },
    { body: StudioOutlinePutSchema, response: StudioSlideSchema },
  )
  .post(
    '/notebooks/:nid/studio/slides/:id/markdown',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handleGenerateMarkdown(id, nid);
    },
    { response: StudioSlideSchema },
  )
  .put(
    '/notebooks/:nid/studio/slides/:id/markdown',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'slide id');
      return handlePutMarkdown(id, nid, body);
    },
    { body: StudioMarkdownPutSchema, response: StudioSlideSchema },
  )
  .get('/notebooks/:nid/studio/slides/:id/outline/stream', ({ params }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const id = requirePositiveIntId(params.id, 'slide id');
    return handleOutlineStream(id, nid);
  })
  .get('/notebooks/:nid/studio/slides/:id/markdown/stream', ({ params }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const id = requirePositiveIntId(params.id, 'slide id');
    return handleMarkdownStream(id, nid);
  })

  // ---- Flat deprecated aliases (c67 notebookId required on query/body) ----
  .post(
    '/studio/slides',
    ({ body, set }) => {
      set.status = 201;
      return handleCreateSlide(body.notebookId, body);
    },
    { body: SlideDraftCreateRequestSchema, response: StudioSlideSchema },
  )
  .get(
    '/studio/slides',
    ({ query }) => handleListSlides(query.notebookId, query.offset ?? 0, query.limit ?? 20),
    { query: StudioSlidesListQuerySchema, response: SlidesPageSchema },
  )
  // Static /latest before /:id
  .get('/studio/slides/latest', ({ query }) => handleLatestSlide(query.notebookId), {
    query: StudioSlidesListQuerySchema,
    response: StudioSlideSchema,
  })
  .get(
    '/studio/slides/:id',
    ({ params, query }) =>
      handleGetSlide(requirePositiveIntId(params.id, 'slide id'), query.notebookId),
    { query: NotebookIdQuerySchema, response: StudioSlideSchema },
  )
  .patch(
    '/studio/slides/:id',
    ({ params, query, body }) =>
      handlePatchSlide(requirePositiveIntId(params.id, 'slide id'), query.notebookId, body),
    { query: NotebookIdQuerySchema, body: SlideDraftUpdateSchema, response: StudioSlideSchema },
  )
  .post(
    '/studio/slides/:id/outline',
    async ({ params, query }) =>
      handleGenerateOutline(requirePositiveIntId(params.id, 'slide id'), query.notebookId),
    { query: NotebookIdQuerySchema, response: StudioSlideSchema },
  )
  .put(
    '/studio/slides/:id/outline',
    ({ params, query, body }) =>
      handlePutOutline(requirePositiveIntId(params.id, 'slide id'), query.notebookId, body),
    {
      query: NotebookIdQuerySchema,
      body: StudioOutlinePutSchema,
      response: StudioSlideSchema,
    },
  )
  .post(
    '/studio/slides/:id/markdown',
    async ({ params, query }) =>
      handleGenerateMarkdown(requirePositiveIntId(params.id, 'slide id'), query.notebookId),
    { query: NotebookIdQuerySchema, response: StudioSlideSchema },
  )
  .put(
    '/studio/slides/:id/markdown',
    ({ params, query, body }) =>
      handlePutMarkdown(requirePositiveIntId(params.id, 'slide id'), query.notebookId, body),
    {
      query: NotebookIdQuerySchema,
      body: StudioMarkdownPutSchema,
      response: StudioSlideSchema,
    },
  )
  .get(
    '/studio/slides/:id/outline/stream',
    ({ params, query }) =>
      handleOutlineStream(requirePositiveIntId(params.id, 'slide id'), query.notebookId),
    { query: NotebookIdQuerySchema },
  )
  .get(
    '/studio/slides/:id/markdown/stream',
    ({ params, query }) =>
      handleMarkdownStream(requirePositiveIntId(params.id, 'slide id'), query.notebookId),
    { query: NotebookIdQuerySchema },
  );

registerApiDoc(apiDocs);
