import { generateText } from 'ai';
// Refine router — POST /v2/refine
//
// 4 refinement modes via system prompt:
//   - expand: elaborate/expand text
//   - summarize: condense/shorten
//   - rewrite: rephrase/improve readability
//   - translate: translate to another language
//
// Each mode uses a distinct system prompt. The LLM processes the input text
// and returns the refined version via streamText (or non-streaming).
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';

// ---------------------------------------------------------------------------
// Refine modes
// ---------------------------------------------------------------------------

type RefineMode = 'expand' | 'summarize' | 'rewrite' | 'translate';

const MODE_PROMPTS: Record<RefineMode, string> = {
  expand: `You are an expert writer expanding content. Add detail, examples, and elaboration while preserving the original meaning and tone. Make the text more comprehensive.`,
  summarize: `You are an expert summarizer. Condense the text to its essential points. Be concise but complete.`,
  rewrite: `You are an expert editor. Rewrite the text to improve clarity, flow, and readability while preserving the original meaning.`,
  translate: `You are a professional translator. Translate the text to the target language specified by the user. Preserve formatting, tone, and nuance.`,
};

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/refine',
    method: 'post',
    summary: 'Refine text (expand/summarize/rewrite/translate)',
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
// Router
// ---------------------------------------------------------------------------

export const refineRouter = new Elysia({ prefix: '/v2' })
  // List modes
  .get('/refine/modes', () =>
    Object.entries(MODE_PROMPTS).map(([id]) => ({
      id,
      name:
        id === 'expand' ? '扩展' : id === 'summarize' ? '摘要' : id === 'rewrite' ? '重写' : '翻译',
    })),
  )

  // Refine text
  .post('/refine', async ({ body }) => {
    const { text, mode, notebook_id, source_ids, target_language, custom_prompt } = body as {
      text?: string;
      mode: RefineMode;
      notebook_id?: number;
      source_ids?: number[];
      target_language?: string;
      custom_prompt?: string;
    };

    const refineMode = mode ?? 'rewrite';

    // Resolve input text: either from body or from source chunks
    let inputText = text ?? '';
    if (!inputText && notebook_id && source_ids && source_ids.length > 0) {
      const chunkRows = db()
        .select({ text: chunks.text })
        .from(chunks)
        .innerJoin(sources, eq(chunks.sourceId, sources.id))
        .where(eq(sources.notebookId, Number(notebook_id)))
        .all();

      inputText = chunkRows.map((c) => c.text).join('\n\n');
    }

    if (!inputText) throw new NotFoundError('No text provided');

    // Build system prompt
    let systemPrompt = MODE_PROMPTS[refineMode] ?? MODE_PROMPTS.rewrite;
    if (custom_prompt) systemPrompt = custom_prompt;

    let userPrompt: string;
    switch (refineMode) {
      case 'expand':
        userPrompt = `Expand the following text with more detail and examples:\n\n${inputText}`;
        break;
      case 'summarize':
        userPrompt = `Summarize the following text to its essential points:\n\n${inputText}`;
        break;
      case 'translate':
        userPrompt = `Translate the following text to ${target_language || 'English'}:\n\n${inputText}`;
        break;
      default:
        userPrompt = `Rewrite the following text to improve clarity and readability:\n\n${inputText}`;
        break;
    }

    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return {
      mode: refineMode,
      original_length: inputText.length,
      refined_length: result.text.length,
      text: result.text,
    };
  });

registerApiDoc(apiDocs);
