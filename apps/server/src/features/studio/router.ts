import { streamText } from 'ai';
// Studio slides router — POST /v2/studio/slides
//
// Generates Slidev markdown from notebook content using AI SDK streamText.
// The agent retrieves relevant chunks, generates an outline, then produces
// per-slide markdown content. Supports configurable theme, audience, language.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources, notebooks, studioSlides } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/studio/slides',
    method: 'post',
    summary: 'Generate Slidev markdown from notebook content',
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
    path: '/v2/studio/slides/:id/generate',
    method: 'post',
    summary: 'Trigger slide generation for a draft',
    tags: ['studio'],
    responses: { 200: { description: 'Generated markdown' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSlide(row: typeof studioSlides.$inferSelect) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    title: row.title,
    prompt: row.prompt,
    engine: row.engine,
    chunk_ids: row.chunkIds,
    source_ids: row.sourceIds,
    outline: row.outline,
    markdown: row.markdown,
    stage: row.stage,
    status: row.status,
    error_message: row.errorMessage,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const SLIDES_SYSTEM_PROMPT = `You are an expert presentation designer. Generate a Slidev markdown presentation.

Follow this format exactly:

---
theme: seriph
---

# Title Slide

---

## Content Slide Title

- Bullet point
- Another point with supporting detail

---

## Another Section

### Subsection

More content here...

Include 5-10 slides. Each slide should have a clear title and 2-4 bullet points.`;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const studioRouter = new Elysia({ prefix: '/v2' })
  // Create slide draft
  .post('/studio/slides', ({ body }) => {
    const { notebook_id, title, prompt, source_ids } = body as {
      notebook_id: number;
      title?: string;
      prompt?: string;
      source_ids?: number[];
    };

    const notebookId = Number(notebook_id);

    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const slide = db()
      .insert(studioSlides)
      .values({
        notebookId,
        title: title ?? null,
        prompt: prompt ?? null,
        sourceIds: source_ids ?? null,
        stage: 'input',
        status: 'idle',
      })
      .returning()
      .get();

    return serializeSlide(slide);
  })

  // List slide drafts
  .get('/studio/slides', ({ query }) => {
    const notebookId = Number((query as { notebook_id?: string }).notebook_id);
    if (!notebookId) throw new NotFoundError('notebook_id required');

    const rows = db()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .all();

    return rows.map(serializeSlide);
  })

  // Get slide draft
  .get('/studio/slides/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!row) throw new NotFoundError(`Slide ${id} not found`);
    return serializeSlide(row);
  })

  // Generate slides
  .post('/studio/slides/:id/generate', async ({ params }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    // Gather context from notebook
    const chunkRows = db()
      .select({
        text: chunks.text,
        filename: sources.filename,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .where(eq(sources.notebookId, slide.notebookId))
      .all();

    const context = chunkRows
      .map((c) => c.text)
      .join('\n\n')
      .substring(0, 6000);

    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    // Mark running
    db()
      .update(studioSlides)
      .set({ status: 'running', stage: 'outline' })
      .where(eq(studioSlides.id, id))
      .run();

    try {
      const result = await streamText({
        model,
        system: SLIDES_SYSTEM_PROMPT,
        prompt: `Create a presentation based on this content:\n\nTitle: ${slide.title || 'Presentation'}\n\nContent:\n${context}\n\n${slide.prompt ? `Additional instructions: ${slide.prompt}` : ''}`,
      });

      let markdown = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          markdown += part.text;
        }
      }

      db()
        .update(studioSlides)
        .set({
          markdown,
          stage: 'markdown',
          status: 'idle',
        })
        .where(eq(studioSlides.id, id))
        .run();

      const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();

      return serializeSlide(updated!);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      db()
        .update(studioSlides)
        .set({
          status: 'error',
          errorMessage: message,
        })
        .where(eq(studioSlides.id, id))
        .run();

      throw error;
    }
  });

registerApiDoc(apiDocs);
