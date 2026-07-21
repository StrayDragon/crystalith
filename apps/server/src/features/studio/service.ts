import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SlidesOutlineSchema,
  type SlideGenerationConfig,
  type SlidesOutline,
} from '@crystalith/shared';
// Studio service — shared generation logic + SSE helper.
//
// Extracted from router.ts (H5+H6 fix) to eliminate duplication between
// POST and SSE stream endpoints for outline + markdown generation.
import { generateObject, streamText } from 'ai';
import { and, eq, inArray } from 'drizzle-orm';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, outputs, sources, studioSlides } from '../../db/schema.ts';
import { getDataRoot, getDefaultChatModel } from '../../shared/config.ts';
import {
  resolveAudienceHint,
  resolveBulletRange,
  resolveLanguageHint,
  resolveQuantityRange,
  resolveRetrievalTuning,
  resolveStructureHint,
  resolveThemePreset,
  resolveToneHint,
} from './config.ts';
import { buildFrontmatter } from './theme-presets.ts';

// ---------------------------------------------------------------------------
// Frontmatter helpers (v1 generator.py:150-170)
// ---------------------------------------------------------------------------

export function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/u, '');
}

export function applyFrontmatter(md: string, frontmatter: string): string {
  const stripped = stripFrontmatter(md.trim());
  return `${frontmatter}\n${stripped}`;
}

// ---------------------------------------------------------------------------
// Config hints (c56: v1 generator.py:202-290 requirement_lines, expanded)
// ---------------------------------------------------------------------------

/**
 * Build the Chinese requirement block for the generation prompt (v1
 * _build_outline_prompt/_build_markdown_prompt requirement_lines). Expands
 * quantity/density to concrete ranges and appends audience/tone/structure/
 * language/theme hints when those config fields are set.
 *
 * Returns a `\n\nGuidance:\n- ...` block appended to the system prompt, or ''.
 */
export function buildConfigHints(config: SlideGenerationConfig | null): string {
  if (!config) return '';
  const [slideMin, slideMax] = resolveQuantityRange(config.quantity ?? null);
  const [bulletMin, bulletMax] = resolveBulletRange(config.density ?? null);
  const languageHint = resolveLanguageHint(config.language ?? null);
  const audienceHint = resolveAudienceHint(config.audience ?? null);
  const toneHint = resolveToneHint(config.tone ?? null);
  const structureHint = resolveStructureHint(config.structure ?? null);
  const themePreset = resolveThemePreset(config.themePreset ?? null);

  const lines: string[] = [];
  lines.push(`请生成 ${slideMin}-${slideMax} 张幻灯片。`);
  lines.push(`每页 ${bulletMin}-${bulletMax} 个要点。`);
  if (languageHint) lines.push(`输出语言：${languageHint}`);
  if (audienceHint) lines.push(`受众定位：${audienceHint}`);
  if (toneHint) lines.push(`语气风格：${toneHint}`);
  if (structureHint) lines.push(`结构模板：${structureHint}`);
  lines.push(`主题预设：${themePreset}`);
  return `\n\nGuidance:\n- ${lines.join('\n- ')}`;
}

// ---------------------------------------------------------------------------
// Context retrieval (c43: via ragRegistry with fallback)
// ---------------------------------------------------------------------------

export async function getContext(slide: typeof studioSlides.$inferSelect): Promise<string> {
  const sourceIds = (slide.sourceIds ?? []).filter((id) => id > 0);
  if (sourceIds.length === 0) {
    throw new Error('source_ids required — select at least one source');
  }

  // c56: preference (quality/speed) tunes topK/minScore (v1 generation_preference.py).
  const preference = slide.generationConfig?.preference ?? null;
  const { topK, minScore } = resolveRetrievalTuning(preference);

  const query = slide.prompt || slide.title || 'presentation slides';
  try {
    const { ragRegistry } = await import('../../rag/registry.ts');
    const results = await ragRegistry.retrieveWith('embed', slide.notebookId, query, {
      topK,
      minScore,
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
    // c51: v1 _clear_stale_running_status (api.py:107-118) sets status=IDLE +
    // clears error_message (None). Was: set a non-empty error string, which
    // made stale-cleared slides show an error in v2 where v1 shows none.
    db()
      .update(studioSlides)
      .set({ status: 'idle', errorMessage: null })
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
  const slidesDir = join(getDataRoot(), 'slides', String(notebookId));
  if (!existsSync(slidesDir)) mkdirSync(slidesDir, { recursive: true });
  writeFileSync(join(slidesDir, `${slideId}.md`), markdown, 'utf-8');
  const previewDir = join(getDataRoot(), 'slides', 'preview');
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true });
  writeFileSync(join(previewDir, 'slides.md'), markdown, 'utf-8');
}

/**
 * c51: sync the slide to an Output row, writing the studioSlides.outputId FK
 * (v1 _sync_output, api.py:194-229) + full content schema
 * {title, engine, outline, markdown, slide_id}. Was: matched by
 * prompt='studio:<id>' and never wrote the outputId FK (left it null),
 * and used a partial content shape {title, markdown, stage}.
 */
export function syncSlideOutput(slide: typeof studioSlides.$inferSelect, markdown: string): void {
  // Reuse existing output if the slide already has an outputId FK, else look
  // up by the studio:<id> prompt convention (for slides created pre-c51).
  let outputId = slide.outputId ?? null;
  if (!outputId) {
    const legacy = db()
      .select()
      .from(outputs)
      .where(eq(outputs.prompt, `studio:${slide.id}`))
      .get();
    outputId = legacy?.id ?? null;
  }

  const content = {
    title: slide.title,
    engine: slide.engine,
    outline: slide.outline,
    markdown,
    slideId: slide.id,
  };

  if (outputId) {
    db().update(outputs).set({ content }).where(eq(outputs.id, outputId)).run();
  } else {
    const inserted = db()
      .insert(outputs)
      .values({
        notebookId: slide.notebookId,
        type: 'SLIDES',
        prompt: `studio:${slide.id}`,
        content,
      })
      .returning()
      .get();
    outputId = inserted.id;
  }

  // c51: write the FK so slide→output joins work (column existed but was never set)
  if (slide.outputId !== outputId) {
    db().update(studioSlides).set({ outputId }).where(eq(studioSlides.id, slide.id)).run();
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
): Promise<SlidesOutline> {
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  // c56: interpret generation_config into concrete ranges (v1 _build_outline_prompt).
  const hintLines = buildConfigHints(slide.generationConfig ?? null);

  const { object: outline } = await generateObject({
    model,
    schema: SlidesOutlineSchema,
    system:
      'You are a presentation designer. Create a slide outline with title and bullet points for each slide.' +
      hintLines,
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

  const config = slide.generationConfig ?? null;
  const themePreset = config?.themePreset ?? 'minimal-clean';
  const frontmatterOverride =
    typeof config?.frontmatter === 'string' && config.frontmatter.trim()
      ? config.frontmatter
      : null;
  // c56: pass title + override so buildFrontmatter honors the v1 override path.
  const frontmatter = buildFrontmatter(themePreset, slide.title, frontmatterOverride);
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

/** c51: context handed to the SSE run callback — traceId for event correlation. */
export interface SseContext {
  /** Per-request trace id; MUST be included in every event payload (v1 api.py:428,538). */
  traceId: string;
  /** The slide id. */
  slideId: number;
}

/**
 * Create an SSE response with shared headers, busy guard, and error handling.
 * The `run` callback receives an `emit` function + context (traceId) and can
 * yield progress/toolcall/done/error events. Errors are caught and emitted as
 * `error` events, then the stream closes.
 *
 * c51: generates a traceId per request; the done payload is {traceId, slideId}
 * (v1 api.py:428,538), not a full serialized slide.
 */
export function createSseResponse(
  slideId: number,
  run: (emit: SseEmit, ctx: SseContext) => Promise<void>,
): Response {
  const traceId = crypto.randomUUID();
  const ctx: SseContext = { traceId, slideId };
  const sse = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify({ traceId, ...(data as object) })}\n\n`;

  // Check busy guard before starting stream
  if (!clearStaleRunning(slideId)) {
    return new Response(sse('busy', { message: '演示正在生成中，请稍后重试。', slideId }), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no',
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const encoder = new TextEncoder();
      const emit: SseEmit = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };
      try {
        await run(emit, ctx);
      } catch (error) {
        emit('error', { message: String(error), slideId });
      }
      if (!closed) {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Client aborted — run() may still finish; emit guards skip enqueue.
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
