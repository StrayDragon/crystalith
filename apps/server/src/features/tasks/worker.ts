// Task worker — dispatch by type and manage state machines.
//
// The TaskQueue in shared/queue.ts handles prioritization + concurrency.
// This module provides the dispatch function and StageLimiters for domain
// resource control (embedding / vector_search / llm_generate).
import { and, eq, inArray } from 'drizzle-orm';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { chunks, sources } from '../../db/schema.ts';
import { Semaphore } from '../../shared/semaphore.ts';

// ---------------------------------------------------------------------------
// StageLimiters — domain-specific concurrency limits
// ---------------------------------------------------------------------------

export interface StageLimiters {
  embedding: Semaphore;
  vectorSearch: Semaphore;
  llmGenerate: Semaphore;
}

export function createStageLimiters(): StageLimiters {
  return {
    embedding: new Semaphore(2),
    vectorSearch: new Semaphore(4),
    llmGenerate: new Semaphore(3),
  };
}

// ---------------------------------------------------------------------------
// Task dispatch
// ---------------------------------------------------------------------------

export interface TaskPayload {
  type: 'refine' | 'document_parse';
  refineInput?: {
    text?: string;
    mode: string;
    notebook_id?: number;
    source_ids?: number[];
    target_language?: string;
    custom_prompt?: string;
  };
  sourceId?: number;
  notebookId?: number;
}

export async function runTask(
  _taskId: number,
  payload: TaskPayload,
  signal: AbortSignal,
  limiters: StageLimiters,
): Promise<unknown> {
  switch (payload.type) {
    case 'refine':
      return handleRefine(payload, signal, limiters);
    case 'document_parse':
      return handleDocumentParse(payload, signal, limiters);
    default:
      throw new Error(`Unknown task type: ${(payload as { type: string }).type}`);
  }
}

// ---------------------------------------------------------------------------
// Refine handler
// ---------------------------------------------------------------------------

async function handleRefine(
  payload: TaskPayload,
  signal: AbortSignal,
  limiters: StageLimiters,
): Promise<unknown> {
  const input = payload.refineInput;
  if (!input) throw new Error('refine task missing refineInput payload');

  const releaseLlm = await limiters.llmGenerate.acquire();
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    let inputText = input.text ?? '';
    if (!inputText && input.notebook_id && input.source_ids && input.source_ids.length > 0) {
      const chunkRows = db()
        .select({ text: chunks.text })
        .from(chunks)
        .innerJoin(sources, eq(chunks.sourceId, sources.id))
        .where(
          and(
            eq(sources.notebookId, Number(input.notebook_id)),
            inArray(chunks.sourceId, input.source_ids),
          ),
        )
        .all();
      inputText = chunkRows.map((c) => c.text).join('\n\n');
    }
    if (!inputText) throw new Error('No text provided for refine');

    const mode = input.mode ?? 'rewrite';
    const MODE_PROMPTS: Record<string, string> = {
      expand: `You are an expert writer expanding content. Add detail, examples, and elaboration while preserving the original meaning and tone. Make the text more comprehensive.`,
      summarize: `You are an expert summarizer. Condense the text to its essential points. Be concise but complete.`,
      rewrite: `You are an expert editor. Rewrite the text to improve clarity, flow, and readability while preserving the original meaning.`,
      translate: `You are a professional translator. Translate the text to the target language specified by the user. Preserve formatting, tone, and nuance.`,
    };

    let systemPrompt = MODE_PROMPTS[mode] ?? MODE_PROMPTS.rewrite;
    if (input.custom_prompt) systemPrompt = input.custom_prompt;

    let userPrompt: string;
    switch (mode) {
      case 'expand':
        userPrompt = `Expand the following text with more detail and examples:\n\n${inputText}`;
        break;
      case 'summarize':
        userPrompt = `Summarize the following text to its essential points:\n\n${inputText}`;
        break;
      case 'translate':
        userPrompt = `Translate the following text to ${input.target_language || 'English'}:\n\n${inputText}`;
        break;
      default:
        userPrompt = `Rewrite the following text to improve clarity and readability:\n\n${inputText}`;
        break;
    }

    const { getDefaultChatModel } = await import('../../shared/config.ts');
    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    const { generateText } = await import('ai');
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: signal,
    });

    return {
      mode,
      original_length: inputText.length,
      refined_length: result.text.length,
      text: result.text,
    };
  } finally {
    releaseLlm();
  }
}

// ---------------------------------------------------------------------------
// Document parse handler — async ingestion for large files
// ---------------------------------------------------------------------------
// Reads persisted raw bytes (storage layer), re-parses + chunks + embeds.
// Used when upload-time parsing was deferred (e.g. very large files) or to
// re-index after a chunker/embedding model change.

async function handleDocumentParse(
  payload: TaskPayload,
  signal: AbortSignal,
  limiters: StageLimiters,
): Promise<unknown> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const sourceId = payload.sourceId;
  if (!sourceId) throw new Error('document_parse task missing sourceId');

  // 1. Fetch persisted raw bytes.
  const { contentStorage } = await import('../../shared/storage.ts');
  const buffer = await contentStorage.fetch(sourceId);

  // 2. Load source row for mime/filename/parser selection.
  const sourceRow = db().select().from(sources).where(eq(sources.id, sourceId)).get();
  if (!sourceRow) throw new Error(`document_parse: source ${sourceId} not found`);

  const { guessMimeType, selectParser } = await import('../sources/parser-registry.ts');
  const parser = sourceRow.parserType
    ? selectParser(sourceRow.parserType)
    : selectParser(sourceRow.mimeType ?? guessMimeType(sourceRow.filename));

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 3. Parse + chunk (reusing pipeline internals).
  const { chunkText } = await import('../../rag/chunker.ts');
  const result = await parser!.parse(buffer, sourceRow.filename);
  const chunked = chunkText(result.text);

  // 4. Clear any existing chunks for this source (idempotent re-index).
  db().delete(chunks).where(eq(chunks.sourceId, sourceId)).run();

  // 5. Insert fresh chunk rows.
  let offset = 0;
  for (const c of chunked) {
    db()
      .insert(chunks)
      .values({
        sourceId,
        chunkIndex: c.index,
        text: c.text,
        startOffset: offset,
        endOffset: offset + c.text.length,
        metadata: result.metadata ?? null,
      })
      .run();
    offset += c.text.length + 1;
  }

  // 6. Mark source ready.
  db()
    .update(sources)
    .set({ status: 'ready', metadata: result.metadata ?? null })
    .where(eq(sources.id, sourceId))
    .run();

  // 7. Re-embed under the embedding stage limiter.
  const releaseEmbed = await limiters.embedding.acquire();
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { EmbedStrategy } = await import('../../rag/embed-strategy.ts');
    // Clear stale vectors before re-indexing.
    const { deleteSourceVectors } = await import('../../db/vectors.ts');
    deleteSourceVectors(db(), sourceId);
    const strategy = new EmbedStrategy();
    await strategy.indexSource(sourceId, sourceRow.notebookId);
  } finally {
    releaseEmbed();
  }

  const { bumpSourcesEpoch } = await import('../../rag/cache.ts');
  bumpSourcesEpoch(sourceRow.notebookId);

  return { source_id: sourceId, chunk_count: chunked.length, status: 'ready' };
}
