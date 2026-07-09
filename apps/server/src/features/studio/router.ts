// Studio slides router — /v2/studio/slides
//
// Two-stage generation:
//   1. POST /slides/:id/outline   → generateObject(SlideOutlineSchema) → stage=outline
//   2. POST /slides/:id/markdown  → streamText from outline → stage=markdown
//
// Users can review/edit the outline before generating markdown (HITL).
import { generateObject, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources, notebooks, studioSlides } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { buildFrontmatter } from './theme-presets.ts';

const SlideOutlineSchema = z.object({
  title: z.string().nullable().optional(),
  slides: z
    .array(
      z.object({
        title: z.string().nullable().optional(),
        bullets: z.array(z.string()).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

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
    path: '/v2/studio/slides/:id/outline',
    method: 'post',
    summary: 'Generate outline (stage 1)',
    tags: ['studio'],
    responses: { 200: { description: 'Outline generated' } },
  },
  {
    path: '/v2/studio/slides/:id/markdown',
    method: 'post',
    summary: 'Generate markdown from outline (stage 2)',
    tags: ['studio'],
    responses: { 200: { description: 'Markdown generated' } },
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

function getContext(slide: typeof studioSlides.$inferSelect): string {
  const chunkRows = db()
    .select({ text: chunks.text, filename: sources.filename })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(eq(sources.notebookId, slide.notebookId))
    .all();
  return chunkRows
    .map((c) => c.text)
    .join('\n\n')
    .slice(0, 6000);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const studioRouter = new Elysia({ prefix: '/v2' })
  // Create slide draft
  .post('/studio/slides', ({ body }) => {
    const { notebook_id, title, prompt, source_ids } = body as Record<string, unknown>;
    const notebookId = Number(notebook_id);

    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const slide = db()
      .insert(studioSlides)
      .values({
        notebookId,
        title: title ? String(title) : null,
        prompt: prompt ? String(prompt) : null,
        sourceIds: source_ids ? (source_ids as number[]) : null,
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
    return db()
      .select()
      .from(studioSlides)
      .where(eq(studioSlides.notebookId, notebookId))
      .all()
      .map(serializeSlide);
  })

  // Get slide draft
  .get('/studio/slides/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!row) throw new NotFoundError(`Slide ${id} not found`);
    return serializeSlide(row);
  })

  // Stage 1: Generate outline
  .post('/studio/slides/:id/outline', async ({ params }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    const context = getContext(slide);
    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');

    db()
      .update(studioSlides)
      .set({ status: 'running', stage: 'outline' })
      .where(eq(studioSlides.id, id))
      .run();

    try {
      const model = withRetry(await resolveModel(modelConfig));
      const { object: outline } = await generateObject({
        model,
        schema: SlideOutlineSchema,
        system: `You are a presentation designer. Create a slide outline with title and bullet points for each slide.`,
        prompt: `Create a slide outline based on:\n\nTitle: ${slide.title || 'Presentation'}\n\nContent:\n${context}\n\n${slide.prompt ? `Additional instructions: ${slide.prompt}` : ''}`,
      });

      db()
        .update(studioSlides)
        .set({
          outline: outline as Record<string, unknown>,
          stage: 'outline',
          status: 'idle',
        })
        .where(eq(studioSlides.id, id))
        .run();

      const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
      return serializeSlide(updated!);
    } catch (error) {
      db()
        .update(studioSlides)
        .set({ status: 'error', errorMessage: String(error) })
        .where(eq(studioSlides.id, id))
        .run();
      throw error;
    }
  })

  // Stage 2: Generate markdown from outline
  .post('/studio/slides/:id/markdown', async ({ params }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);
    if (!slide.outline) throw new NotFoundError(`Slide ${id} has no outline — run /outline first`);

    const context = getContext(slide);
    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');

    db()
      .update(studioSlides)
      .set({ status: 'running', stage: 'markdown' })
      .where(eq(studioSlides.id, id))
      .run();

    try {
      const model = withRetry(await resolveModel(modelConfig));
      const outlineStr = JSON.stringify(slide.outline, null, 2);

      // Build deterministic frontmatter from theme preset if available
      const config = slide.generationConfig as Record<string, unknown> | null;
      const themePreset = config?.theme_preset as string | undefined;
      const frontmatter = themePreset ? buildFrontmatter(themePreset) : '';

      const result = await streamText({
        model,
        system: `You are an expert presentation designer. Generate Slidev markdown. Use exactly this structure:
${frontmatter ? `Frontmatter:\n${frontmatter}\n---\n` : `---\ntheme: seriph\n---\n`}

Each slide separated by ---. Keep content concise.`,
        prompt: `Generate slides from this outline:\n${outlineStr}\n\nBased on this content:\n${context}\n\n${slide.prompt ? `Additional: ${slide.prompt}` : ''}`,
      });

      let markdown = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') markdown += part.text;
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
      db()
        .update(studioSlides)
        .set({ status: 'error', errorMessage: String(error) })
        .where(eq(studioSlides.id, id))
        .run();
      throw error;
    }
  });

registerApiDoc(apiDocs);
