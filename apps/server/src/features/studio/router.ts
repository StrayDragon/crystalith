import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Studio slides router — /v2/studio/slides
//
// Two-stage generation with HITL review/edit:
//   1. POST /slides/:id/outline   → generateObject → stage=outline
//   2. PUT  /slides/:id/outline   → manual edit outline (HITL review)
//   3. POST /slides/:id/markdown  → streamText from outline → stage=markdown
//   4. PUT  /slides/:id/markdown  → manual edit markdown + Slidev persist + output sync
//
// CRUD: POST (create) / GET (list/id) / PATCH (edit draft fields)
// Slidev (c32): write .md to cwd/slides/ for preview
import { generateObject, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources, notebooks, outputs, studioSlides } from '../../db/schema.ts';
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
    path: '/v2/studio/slides/:id',
    method: 'patch',
    summary: 'Update slide draft fields (title/prompt/source_ids/generation_config)',
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

/** Write Slidev markdown to `slides/<notebookId>/<slideId>.md` for preview. */
function writeSlideFile(notebookId: number, slideId: number, markdown: string): void {
  const dir = join(process.cwd(), 'slides', String(notebookId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slideId}.md`), markdown, 'utf-8');
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

  // Update draft fields (c32: PATCH draft — v1 parity)
  .patch('/studio/slides/:id', ({ params, body }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    const { title, prompt, source_ids, generation_config } = body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = String(title);
    if (prompt !== undefined) updateData.prompt = String(prompt);
    if (source_ids !== undefined) {
      const ids = Array.isArray(source_ids) ? (source_ids as number[]).filter((n) => n > 0) : [];
      updateData.sourceIds = ids;
    }
    if (generation_config !== undefined) {
      updateData.generationConfig = generation_config as Record<string, unknown>;
    }
    updateData.errorMessage = null;

    db().update(studioSlides).set(updateData).where(eq(studioSlides.id, id)).run();

    const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    return serializeSlide(updated!);
  })

  // Stage 1: Generate outline via AI
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

  // HITL: manually edit outline (c32: PUT outline — v1 parity)
  .put('/studio/slides/:id/outline', ({ params, body }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    const { outline } = body as { outline: Record<string, unknown> };

    db()
      .update(studioSlides)
      .set({
        outline,
        stage: 'outline',
        status: 'idle',
        errorMessage: null,
      })
      .where(eq(studioSlides.id, id))
      .run();

    const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    return serializeSlide(updated!);
  })

  // Stage 2: Generate markdown from outline via AI
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

      // Persist to filesystem on AI generation too (c39 gap fix — v1 api.py:530-531)
      writeSlideFile(slide.notebookId, id, markdown);

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

  // HITL: manually edit markdown + Slidev persist + output sync (c32: PUT markdown — v1 parity)
  .put('/studio/slides/:id/markdown', ({ params, body }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    const { markdown } = body as { markdown: string };

    // Write Slidev file for preview
    try {
      writeSlideFile(slide.notebookId, id, markdown);
    } catch (error) {
      console.error('[studio] slidev file write failed:', error);
    }

    // Sync to outputs table
    const existingOutput = db()
      .select()
      .from(outputs)
      .where(eq(outputs.prompt, `studio:${id}`))
      .get();

    if (existingOutput) {
      db()
        .update(outputs)
        .set({ content: { title: slide.title, markdown, stage: 'markdown' } })
        .where(eq(outputs.id, existingOutput.id))
        .run();
    } else {
      db()
        .insert(outputs)
        .values({
          notebookId: slide.notebookId,
          type: 'SLIDES',
          prompt: `studio:${id}`,
          content: { title: slide.title, markdown, stage: 'markdown' },
        })
        .run();
    }

    db()
      .update(studioSlides)
      .set({
        markdown,
        stage: 'markdown',
        status: 'idle',
        errorMessage: null,
      })
      .where(eq(studioSlides.id, id))
      .run();

    const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    return serializeSlide(updated!);
  });

registerApiDoc(apiDocs);
