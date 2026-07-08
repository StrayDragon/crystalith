// Refine router — POST /v2/refine
//
// 4 refinement modes via system prompt:
//   - expand: elaborate/expand text
//   - summarize: condense/shorten
//   - rewrite: rephrase/improve readability
//   - translate: translate to another language
//   - structured: returns {title, bullets[], terms[]}
//
// Refine runs via the c19 task queue for concurrency control + cancellation.
// The request blocks until completion (waitForCompletion).
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import type { TaskQueue } from '../../shared/queue.ts';

// ---------------------------------------------------------------------------
// Refine modes
// ---------------------------------------------------------------------------

type RefineMode = 'expand' | 'summarize' | 'rewrite' | 'translate' | 'structured';

const MODE_PROMPTS: Record<RefineMode, string> = {
  expand: `You are an expert writer expanding content. Add detail, examples, and elaboration while preserving the original meaning and tone. Make the text more comprehensive.`,
  summarize: `You are an expert summarizer. Condense the text to its essential points. Be concise but complete.`,
  rewrite: `You are an expert editor. Rewrite the text to improve clarity, flow, and readability while preserving the original meaning.`,
  translate: `You are a professional translator. Translate the text to the target language specified by the user. Preserve formatting, tone, and nuance.`,
  structured: `You are an expert content organizer. Extract structured information from the text: a title, key bullet points, and important terms with definitions.`,
};

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/refine',
    method: 'post',
    summary: 'Refine text (expand/summarize/rewrite/translate/structured)',
    tags: ['refine'],
    responses: { 200: { description: 'Refined text' } },
  },
  {
    path: '/v2/refine/modes',
    method: 'get',
    summary: 'List available refine modes',
    tags: ['refine'],
    responses: { 200: { description: 'Mode list' } },
  },
];

// ---------------------------------------------------------------------------
// Router (factory)
// ---------------------------------------------------------------------------

export function refineRouter(taskQueue: TaskQueue) {
  registerApiDoc(apiDocs);

  return new Elysia({ prefix: '/v2' })
    // List modes
    .get('/refine/modes', () =>
      Object.entries(MODE_PROMPTS).map(([id]) => ({
        id,
        name:
          id === 'expand'
            ? '扩展'
            : id === 'summarize'
              ? '摘要'
              : id === 'rewrite'
                ? '重写'
                : id === 'translate'
                  ? '翻译'
                  : '结构化提取',
      })),
    )

    // Refine text (via task queue)
    .post('/refine', async ({ body }) => {
      const {
        text,
        mode,
        notebook_id,
        source_ids,
        target_language,
        custom_prompt,
      } = body as Record<string, unknown>;

      const refineMode = (mode as RefineMode) ?? 'rewrite';

      // Resolve input text from source_ids if not provided directly
      let inputText = (text as string) ?? '';
      if (!inputText && notebook_id && source_ids && (source_ids as number[]).length > 0) {
        const nid = Number(notebook_id);
        const sids = source_ids as number[];
        const chunkRows = db()
          .select({ text: chunks.text })
          .from(chunks)
          .innerJoin(sources, eq(chunks.sourceId, sources.id))
          .where(and(eq(sources.notebookId, nid), inArray(chunks.sourceId, sids)))
          .all();
        inputText = chunkRows.map((c) => c.text).join('\n\n');
      }

      if (!inputText) throw new NotFoundError('No text provided');

      // Enqueue refine task
      const taskId = taskQueue.enqueue({
        type: 'refine',
        notebookId: notebook_id ? Number(notebook_id) : undefined,
        payload: {
          refineInput: {
            text: inputText,
            mode: refineMode,
            notebook_id: notebook_id ? Number(notebook_id) : undefined,
            source_ids: source_ids as number[] | undefined,
            target_language: target_language as string | undefined,
            custom_prompt: custom_prompt as string | undefined,
          },
        },
        priority: 1,
      });

      try {
        const result = await taskQueue.waitForCompletion(taskId);
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === 'Task cancelled') {
          throw new NotFoundError('Refine task was cancelled');
        }
        throw error;
      }
    });
}
