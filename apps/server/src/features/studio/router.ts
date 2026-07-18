// Studio slides router — /v2/studio/slides
//
// Two-stage generation with HITL review/edit:
//   1. POST /slides/:id/outline   → generateObject → stage=outline
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
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, studioSlides } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
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

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/studio/slides',
    method: 'post',
    summary: 'Create a slide draft',
    tags: ['studio'],
    responses: { 201: { description: 'Created slide draft' } },
  },
  {
    path: '/v2/studio/slides',
    method: 'get',
    summary: 'List slide drafts for a notebook',
    tags: ['studio'],
    responses: { 200: { description: 'Slide draft list' } },
  },
  {
    path: '/v2/studio/slides/:id',
    method: 'get',
    summary: 'Get a slide draft',
    tags: ['studio'],
    responses: { 200: { description: 'Slide draft details' } },
  },
  {
    path: '/v2/studio/slides/:id',
    method: 'patch',
    summary: 'Update slide draft fields',
    tags: ['studio'],
    responses: { 200: { description: 'Draft updated' } },
  },
  {
    path: '/v2/studio/slides/:id/outline',
    method: 'post',
    summary: 'Generate outline via AI (stage 1)',
    tags: ['studio'],
    responses: { 200: { description: 'Outline generated' } },
  },
  {
    path: '/v2/studio/slides/:id/outline',
    method: 'put',
    summary: 'Edit outline manually (HITL review)',
    tags: ['studio'],
    responses: { 200: { description: 'Outline updated' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown',
    method: 'post',
    summary: 'Generate markdown from outline via AI (stage 2)',
    tags: ['studio'],
    responses: { 200: { description: 'Markdown generated' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown',
    method: 'put',
    summary: 'Edit markdown manually + Slidev persist + output sync (HITL)',
    tags: ['studio'],
    responses: { 200: { description: 'Markdown updated and persisted' } },
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

function requireSourceIds(raw: unknown): number[] {
  const ids = Array.isArray(raw) ? (raw as number[]).map(Number).filter((n) => n > 0) : [];
  if (ids.length === 0) throw new Error('source_ids required — select at least one source');
  return ids;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const studioRouter = new Elysia({ prefix: '/v2' })
  // Create slide draft
  .post('/studio/slides', ({ body }) => {
    const {
      notebookId: nbId,
      title,
      prompt,
      sourceIds,
      generationConfig,
    } = body as Record<string, unknown>;
    const notebookId = requirePositiveIntId(nbId, 'notebook id');

    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const slide = db()
      .insert(studioSlides)
      .values({
        notebookId,
        title: title
          ? typeof title === 'string'
            ? title
            : typeof title === 'string'
              ? title
              : ''
          : null,
        prompt: prompt
          ? typeof prompt === 'string'
            ? prompt
            : typeof prompt === 'string'
              ? prompt
              : ''
          : null,
        sourceIds: requireSourceIds(sourceIds),
        generationConfig: (generationConfig as Record<string, unknown>) ?? null,
        stage: 'input',
        status: 'idle',
      })
      .returning()
      .get();
    return serializeSlide(slide);
  })

  // List slide drafts
  .get('/studio/slides', ({ query }) => {
    const notebookId = requirePositiveIntId(
      (query as { notebookId?: string }).notebookId,
      'notebook id',
    );
    return db()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .all()
      .map(serializeSlide);
  })

  // Get slide draft
  .get('/studio/slides/:id', ({ params }) =>
    serializeSlide(getSlideOrThrow(requirePositiveIntId(params.id, 'slide id'))),
  )

  // c43: Get latest draft (v1 api.py:232-247)
  .get('/studio/slides/latest', ({ query }) => {
    const notebookId = requirePositiveIntId(
      (query as { notebookId?: string }).notebookId,
      'notebook id',
    );
    const row = db()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .orderBy(desc(studioSlides.updatedAt))
      .get();
    if (!row) throw new NotFoundError('Slide draft not found');
    return serializeSlide(row);
  })

  // Update draft fields (c32: PATCH draft — v1 parity)
  .patch('/studio/slides/:id', ({ params, body }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    getSlideOrThrow(id);
    const { title, prompt, sourceIds, generationConfig } = body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};
    if (title !== undefined)
      updateData.title = typeof title === 'string' ? title : typeof title === 'string' ? title : '';
    if (prompt !== undefined)
      updateData.prompt =
        typeof prompt === 'string' ? prompt : typeof prompt === 'string' ? prompt : '';
    if (sourceIds !== undefined) updateData.sourceIds = requireSourceIds(sourceIds);
    if (generationConfig !== undefined)
      updateData.generationConfig = generationConfig as Record<string, unknown>;
    updateData.errorMessage = null;
    db().update(studioSlides).set(updateData).where(eq(studioSlides.id, id)).run();
    return serializeSlide(getSlideOrThrow(id));
  })

  // Stage 1: Generate outline via AI (POST — non-streaming)
  .post('/studio/slides/:id/outline', async ({ params }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    const slide = getSlideOrThrow(id);
    if (!clearStaleRunning(id)) return { event: 'busy', message: '演示正在生成中，请稍后重试。' };

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
        .set({ outline: outline as Record<string, unknown>, stage: 'outline', status: 'idle' })
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
  })

  // HITL: manually edit outline (c32: PUT outline — v1 parity)
  .put('/studio/slides/:id/outline', ({ params, body }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    getSlideOrThrow(id);
    const { outline } = body as { outline: Record<string, unknown> };
    db()
      .update(studioSlides)
      .set({ outline, stage: 'outline', status: 'idle', errorMessage: null })
      .where(eq(studioSlides.id, id))
      .run();
    return serializeSlide(getSlideOrThrow(id));
  })

  // Stage 2: Generate markdown from outline via AI (POST — non-streaming)
  .post('/studio/slides/:id/markdown', async ({ params }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    const slide = getSlideOrThrow(id);
    if (!slide.outline) throw new NotFoundError(`Slide ${id} has no outline — run /outline first`);
    if (!clearStaleRunning(id)) return { event: 'busy', message: '演示正在生成中，请稍后重试。' };

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
  })

  // HITL: manually edit markdown + Slidev persist + output sync (c32: PUT markdown — v1 parity)
  .put('/studio/slides/:id/markdown', ({ params, body }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    const slide = getSlideOrThrow(id);
    const { markdown } = body as { markdown: string };
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
  })

  // c43: SSE outline stream (v1 GET /drafts/:id/outline/stream)
  .get('/studio/slides/:id/outline/stream', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    const slide = getSlideOrThrow(id);

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
        .set({ outline: outline as Record<string, unknown>, stage: 'outline', status: 'idle' })
        .where(eq(studioSlides.id, id))
        .run();
      // c51: done payload = {traceId, slideId} (v1 api.py:428)
      emit('done', { traceId: ctx.traceId, slideId: id });
    });
  })

  // c43: SSE markdown stream (v1 GET /drafts/:id/markdown/stream)
  .get('/studio/slides/:id/markdown/stream', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'slide id');
    const slide = getSlideOrThrow(id);
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
  });

registerApiDoc(apiDocs);
