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
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources, notebooks, outputs, studioSlides } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { buildFrontmatter } from './theme-presets.ts';

/** c43: Build prompt hint lines from generation_config (v1 generator.py:202-290). */
function buildConfigHints(config: Record<string, unknown> | null): string {
  if (!config) return '';
  const hints: string[] = [];
  if (typeof config.quantity === 'number') hints.push(`Generate ~${config.quantity} slides.`);
  if (typeof config.density === 'string') hints.push(`Content density: ${config.density}.`);
  if (typeof config.audience === 'string') hints.push(`Target audience: ${config.audience}.`);
  if (typeof config.tone === 'string') hints.push(`Tone: ${config.tone}.`);
  if (typeof config.structure === 'string') hints.push(`Structure: ${config.structure}.`);
  if (typeof config.language === 'string') hints.push(`Language: ${config.language}.`);
  return hints.length ? `\n\nGuidance:\n- ${hints.join('\n- ')}` : '';
}

/** c43: Strip LLM-generated frontmatter (v1 _strip_frontmatter). */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

/** c43: Apply preset frontmatter deterministically (v1 _apply_frontmatter). */
function applyFrontmatter(md: string, frontmatter: string): string {
  const stripped = stripFrontmatter(md.trim());
  return `${frontmatter}\n${stripped}`;
}

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

/** c43: Retrieve context via the unified RAG registry (not raw text slice).
 * Aligns studio with qa/outputs/refine retrieval paths.
 * Falls back to direct chunk query if RAG is unavailable (e.g. no embeddings). */
async function getContext(slide: typeof studioSlides.$inferSelect): Promise<string> {
  const sourceIds = (slide.sourceIds ?? []).filter((id) => id > 0);
  if (sourceIds.length === 0) {
    throw new Error('source_ids required — select at least one source');
  }

  const query = slide.prompt || slide.title || 'presentation slides';
  try {
    const { ragRegistry } = await import('../../rag/registry.ts');
    const results = await ragRegistry.retrieveWith('embed', slide.notebookId, query, {
      topK: 20,
      minScore: 0.2,
      sourceIds,
    });
    if (results.length > 0) {
      return results.map((r) => r.text).join('\n\n');
    }
  } catch {
    // RAG unavailable — fall through to direct query
  }

  // Fallback: direct chunk query (no semantic ranking)
  const chunkRows = db()
    .select({ text: chunks.text })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(and(eq(sources.notebookId, slide.notebookId), inArray(sources.id, sourceIds)))
    .all();
  return chunkRows.map((c) => c.text).join('\n\n');
}

/** c43: Clear stale RUNNING status (v1 SLIDE_RUNNING_STALE_AFTER = 10min). */
const SLIDE_STALE_MS = 10 * 60 * 1000;
function clearStaleRunning(id: number): boolean {
  const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
  if (!slide || slide.status !== 'running') return true; // not running, OK to proceed
  const updatedAt = new Date(slide.updatedAt).getTime();
  if (Date.now() - updatedAt > SLIDE_STALE_MS) {
    db()
      .update(studioSlides)
      .set({ status: 'idle', errorMessage: 'stale running status cleared' })
      .where(eq(studioSlides.id, id))
      .run();
    return true;
  }
  return false; // actively running
}

/** Write Slidev markdown to `slides/<notebookId>/<slideId>.md` for preview
 * and also to global preview file `slides/preview/slides.md` (v1 storage.py:57-66). */
function writeSlideFile(notebookId: number, slideId: number, markdown: string): void {
  const dir = join(process.cwd(), 'slides', String(notebookId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slideId}.md`), markdown, 'utf-8');
  // c43: global preview file (v1 write_preview_markdown)
  const previewDir = join(process.cwd(), 'slides', 'preview');
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true });
  writeFileSync(join(previewDir, 'slides.md'), markdown, 'utf-8');
}

/** Sync slide markdown into outputs table (v1 _sync_output). */
function syncSlideOutput(slide: typeof studioSlides.$inferSelect, markdown: string): void {
  const existingOutput = db()
    .select()
    .from(outputs)
    .where(eq(outputs.prompt, `studio:${slide.id}`))
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
        prompt: `studio:${slide.id}`,
        content: { title: slide.title, markdown, stage: 'markdown' },
      })
      .run();
  }
}

function requireSourceIds(raw: unknown): number[] {
  const ids = Array.isArray(raw) ? (raw as number[]).map(Number).filter((n) => n > 0) : [];
  if (ids.length === 0) {
    throw new Error('source_ids required — select at least one source');
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const studioRouter = new Elysia({ prefix: '/v2' })
  // Create slide draft
  .post('/studio/slides', ({ body }) => {
    const { notebook_id, title, prompt, source_ids, generation_config } = body as Record<
      string,
      unknown
    >;
    const notebookId = Number(notebook_id);
    if (!notebookId) throw new Error('notebook_id required');

    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const sourceIds = requireSourceIds(source_ids);

    const slide = db()
      .insert(studioSlides)
      .values({
        notebookId,
        title: title ? String(title) : null,
        prompt: prompt ? String(prompt) : null,
        sourceIds,
        generationConfig: (generation_config as Record<string, unknown>) ?? null,
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

  // c43: Get latest draft (v1 api.py:232-247)
  .get('/studio/slides/latest', ({ query }) => {
    const notebookId = Number((query as { notebook_id?: string }).notebook_id);
    if (!notebookId) throw new NotFoundError('notebook_id required');
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
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    const { title, prompt, source_ids, generation_config } = body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = String(title);
    if (prompt !== undefined) updateData.prompt = String(prompt);
    if (source_ids !== undefined) {
      updateData.sourceIds = requireSourceIds(source_ids);
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

    // c43: stale RUNNING guard (v1 busy event)
    if (!clearStaleRunning(id)) {
      return { event: 'busy', message: '演示正在生成中，请稍后重试。' };
    }

    const context = await getContext(slide);
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

    // c43: stale RUNNING guard
    if (!clearStaleRunning(id)) {
      return { event: 'busy', message: '演示正在生成中，请稍后重试。' };
    }

    const context = await getContext(slide);
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
      const themePreset = (config?.theme_preset as string) ?? 'minimal-clean';
      const frontmatter = buildFrontmatter(themePreset);
      // c43: interpret generation_config hints (v1 generator.py:202-290)
      const hintLines = buildConfigHints(config);

      const result = await streamText({
        model,
        system: `You are an expert presentation designer. Generate Slidev markdown.
Each slide separated by ---. Keep content concise.${hintLines}`,
        prompt: `Generate slides from this outline:\n${outlineStr}\n\nBased on this content:\n${context}\n\n${slide.prompt ? `Additional: ${slide.prompt}` : ''}`,
      });

      let rawMarkdown = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') rawMarkdown += part.text;
      }

      // c43: deterministic frontmatter strip + apply (v1 generator.py:150-170)
      const markdown = applyFrontmatter(rawMarkdown, frontmatter);

      db()
        .update(studioSlides)
        .set({
          markdown,
          stage: 'markdown',
          status: 'idle',
        })
        .where(eq(studioSlides.id, id))
        .run();

      // Persist to filesystem + sync outputs (v1 api.py:530-532)
      writeSlideFile(slide.notebookId, id, markdown);
      syncSlideOutput(slide, markdown);

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

    syncSlideOutput(slide, markdown);

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
  })

  // c43: SSE outline stream (v1 GET /drafts/:id/outline/stream)
  .get('/studio/slides/:id/outline/stream', async ({ params, set }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);

    set.headers['content-type'] = 'text/event-stream';
    set.headers['cache-control'] = 'no-cache';
    set.headers['x-accel-buffering'] = 'no';

    const sse = (event: string, data: unknown) =>
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    if (!clearStaleRunning(id)) {
      return new Response(sse('busy', { message: '演示正在生成中，请稍后重试。' }));
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(sse('progress', { stage: 'outline', progress: 5, message: '开始生成大纲' }));
          const context = await getContext(slide);
          const modelConfig = getDefaultChatModel();
          if (!modelConfig) throw new Error('No chat model configured');

          db().update(studioSlides).set({ status: 'running', stage: 'outline' }).where(eq(studioSlides.id, id)).run();

          const model = withRetry(await resolveModel(modelConfig));
          const { object: outline } = await generateObject({
            model,
            schema: SlideOutlineSchema,
            system: 'You are a presentation designer. Create a slide outline with title and bullet points for each slide.',
            prompt: `Create a slide outline based on:\n\nTitle: ${slide.title || 'Presentation'}\n\nContent:\n${context}\n\n${slide.prompt ? `Additional instructions: ${slide.prompt}` : ''}`,
          });

          controller.enqueue(sse('progress', { stage: 'outline', progress: 90, message: '大纲生成完成' }));

          db().update(studioSlides).set({ outline: outline as Record<string, unknown>, stage: 'outline', status: 'idle' }).where(eq(studioSlides.id, id)).run();

          const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
          controller.enqueue(sse('done', serializeSlide(updated!)));
        } catch (error) {
          // c43: fallback outline on failure (v1 generator.py:180-189)
          const fallback = { title: slide.title || 'Presentation', slides: [{ title: '生成失败', bullets: [String(error)] }] };
          db().update(studioSlides).set({ outline: fallback, status: 'error', errorMessage: String(error) }).where(eq(studioSlides.id, id)).run();
          controller.enqueue(sse('error', { message: String(error) }));
        }
        controller.close();
      },
    });
    return new Response(stream);
  })

  // c43: SSE markdown stream (v1 GET /drafts/:id/markdown/stream)
  .get('/studio/slides/:id/markdown/stream', async ({ params, set }) => {
    const id = Number(params.id);
    const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
    if (!slide) throw new NotFoundError(`Slide ${id} not found`);
    if (!slide.outline) throw new NotFoundError(`Slide ${id} has no outline`);

    set.headers['content-type'] = 'text/event-stream';
    set.headers['cache-control'] = 'no-cache';
    set.headers['x-accel-buffering'] = 'no';

    const sse = (event: string, data: unknown) =>
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    if (!clearStaleRunning(id)) {
      return new Response(sse('busy', { message: '演示正在生成中，请稍后重试。' }));
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(sse('progress', { stage: 'markdown', progress: 5, message: '开始生成幻灯片' }));
          const context = await getContext(slide);
          const modelConfig = getDefaultChatModel();
          if (!modelConfig) throw new Error('No chat model configured');

          db().update(studioSlides).set({ status: 'running', stage: 'markdown' }).where(eq(studioSlides.id, id)).run();

          const model = withRetry(await resolveModel(modelConfig));
          const config = slide.generationConfig as Record<string, unknown> | null;
          const themePreset = (config?.theme_preset as string) ?? 'minimal-clean';
          const frontmatter = buildFrontmatter(themePreset);
          const hintLines = buildConfigHints(config);

          const result = streamText({
            model,
            system: `You are an expert presentation designer. Generate Slidev markdown.\nEach slide separated by ---. Keep content concise.${hintLines}`,
            prompt: `Generate slides from this outline:\n${JSON.stringify(slide.outline, null, 2)}\n\nBased on this content:\n${context}\n\n${slide.prompt ? `Additional: ${slide.prompt}` : ''}`,
          });

          let rawMarkdown = '';
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              rawMarkdown += part.text;
              controller.enqueue(sse('progress', { stage: 'markdown', delta: part.text }));
            }
          }

          const markdown = applyFrontmatter(rawMarkdown, frontmatter);
          db().update(studioSlides).set({ markdown, stage: 'markdown', status: 'idle' }).where(eq(studioSlides.id, id)).run();
          writeSlideFile(slide.notebookId, id, markdown);
          syncSlideOutput(slide, markdown);

          const updated = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
          controller.enqueue(sse('done', serializeSlide(updated!)));
        } catch (error) {
          // c43: fallback markdown on failure
          const fallbackMd = `---\ntheme: seriph\n---\n# 生成失败\n\n${String(error)}`;
          db().update(studioSlides).set({ markdown: fallbackMd, status: 'error', errorMessage: String(error) }).where(eq(studioSlides.id, id)).run();
          controller.enqueue(sse('error', { message: String(error) }));
        }
        controller.close();
      },
    });
    return new Response(stream);
  });

registerApiDoc(apiDocs);
