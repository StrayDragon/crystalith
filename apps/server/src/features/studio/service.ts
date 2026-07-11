// Studio service — shared generation logic + SSE helper.
//
// Extracted from router.ts (H5+H6 fix) to eliminate duplication between
// POST and SSE stream endpoints for outline + markdown generation.
import { generateObject, streamText } from 'ai';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, outputs, sources, studioSlides } from '../../db/schema.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { buildFrontmatter } from './theme-presets.ts';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const SlideOutlineSchema = z.object({
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
// Frontmatter helpers (v1 generator.py:150-170)
// ---------------------------------------------------------------------------

export function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

export function applyFrontmatter(md: string, frontmatter: string): string {
  const stripped = stripFrontmatter(md.trim());
  return `${frontmatter}\n${stripped}`;
}

// ---------------------------------------------------------------------------
// Config hints (v1 generator.py:202-290)
// ---------------------------------------------------------------------------

export function buildConfigHints(config: Record<string, unknown> | null): string {
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

// ---------------------------------------------------------------------------
// Context retrieval (c43: via ragRegistry with fallback)
// ---------------------------------------------------------------------------

export async function getContext(slide: typeof studioSlides.$inferSelect): Promise<string> {
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
  } catch (error) {
    // H5 fix: log degradation instead of silent swallow
    console.warn('[studio] RAG unavailable, falling back to direct query:', error);
  }

  const chunkRows = db()
    .select({ text: chunks.text })
    .from(chunks)
    .innerJoin(sources, eq(chunks.sourceId, sources.id))
    .where(and(eq(sources.notebookId, slide.notebookId), inArray(sources.id, sourceIds)))
    .all();
  return chunkRows.map((c) => c.text).join('\n\n');
}

// ---------------------------------------------------------------------------
// Stale RUNNING clearing (v1 SLIDE_RUNNING_STALE_AFTER = 10min)
// ---------------------------------------------------------------------------

const SLIDE_STALE_MS = 10 * 60 * 1000;

export function clearStaleRunning(id: number): boolean {
  const slide = db().select().from(studioSlides).where(eq(studioSlides.id, id)).get();
  if (!slide || slide.status !== 'running') return true;
  const updatedAt = new Date(slide.updatedAt).getTime();
  if (Date.now() - updatedAt > SLIDE_STALE_MS) {
    db()
      .update(studioSlides)
      .set({ status: 'idle', errorMessage: 'stale running status cleared' })
      .where(eq(studioSlides.id, id))
      .run();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Filesystem + output sync
// ---------------------------------------------------------------------------

export function writeSlideFile(notebookId: number, slideId: number, markdown: string): void {
  const dir = join(process.cwd(), 'slides', String(notebookId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slideId}.md`), markdown, 'utf-8');
  const previewDir = join(process.cwd(), 'slides', 'preview');
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true });
  writeFileSync(join(previewDir, 'slides.md'), markdown, 'utf-8');
}

export function syncSlideOutput(slide: typeof studioSlides.$inferSelect, markdown: string): void {
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

// ---------------------------------------------------------------------------
// Shared generation cores (H6: used by both POST and SSE endpoints)
// ---------------------------------------------------------------------------

/**
 * Generate outline via generateObject. Shared by POST /outline and SSE stream.
 * Returns the outline object. Caller handles DB status transitions.
 */
export async function generateOutline(
  slide: typeof studioSlides.$inferSelect,
  context: string,
): Promise<z.infer<typeof SlideOutlineSchema>> {
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  const { object: outline } = await generateObject({
    model,
    schema: SlideOutlineSchema,
    system: 'You are a presentation designer. Create a slide outline with title and bullet points for each slide.',
    prompt: `Create a slide outline based on:\n\nTitle: ${slide.title || 'Presentation'}\n\nContent:\n${context}\n\n${slide.prompt ? `Additional instructions: ${slide.prompt}` : ''}`,
  });

  return outline;
}

/**
 * Generate markdown from outline via streamText. Shared by POST /markdown and SSE stream.
 * Calls onDelta for each text chunk (SSE uses it to stream progress).
 * Returns the final markdown with deterministic frontmatter applied.
 */
export async function generateMarkdown(
  slide: typeof studioSlides.$inferSelect,
  context: string,
  onDelta?: (text: string) => void,
): Promise<string> {
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
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
      onDelta?.(part.text);
    }
  }

  return applyFrontmatter(rawMarkdown, frontmatter);
}

// ---------------------------------------------------------------------------
// SSE helper (H5: shared between outline/stream and markdown/stream)
// ---------------------------------------------------------------------------

export type SseEmit = (event: string, data: unknown) => void;

/**
 * Create an SSE response with shared headers, busy guard, and error handling.
 * The `run` callback receives an `emit` function and can yield progress/done/error events.
 * Errors are caught and emitted as `error` events, then the stream closes.
 */
export function createSseResponse(
  slideId: number,
  run: (emit: SseEmit) => Promise<void>,
): Response {
  const sse = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Check busy guard before starting stream
  if (!clearStaleRunning(slideId)) {
    return new Response(sse('busy', { message: '演示正在生成中，请稍后重试。' }), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no',
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit: SseEmit = (event, data) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      try {
        await run(emit);
      } catch (error) {
        emit('error', { message: String(error) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  });
}
