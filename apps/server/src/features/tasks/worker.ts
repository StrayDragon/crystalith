// Task worker — dispatch by type and manage state machines.
//
// The TaskQueue in shared/queue.ts handles prioritization + concurrency.
// This module provides the dispatch function and StageLimiters for domain
// resource control (embedding / vector_search / llm_generate).
import { eq } from 'drizzle-orm';

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
    prompt: string;
    format: 'paragraph' | 'bullets' | 'structured';
    source_ids?: number[];
    top_k?: number;
    min_score?: number;
    notebook_id?: number;
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
// Refine handler — citation-aware RAG summarizer (v1-aligned, c29)
// ---------------------------------------------------------------------------

async function handleRefine(
  payload: TaskPayload,
  signal: AbortSignal,
  limiters: StageLimiters,
): Promise<unknown> {
  const input = payload.refineInput;
  if (!input) throw new Error('refine task missing refineInput payload');
  if (!payload.notebookId) throw new Error('refine task requires notebookId');

  const trimmedPrompt = input.prompt.trim(); // v1 worker.py:165
  if (!trimmedPrompt) throw new Error('Refine task requires a prompt');

  const format = input.format ?? 'paragraph';
  const topK = input.top_k ?? 5;
  const minScore = input.min_score ?? 0.2;

  // ① Retrieve + citations + context (shared with batch via refine/retrieve.ts)
  const { retrieveForRefine } = await import('../refine/retrieve.ts');
  const { citations, context, evidence } = await retrieveForRefine(
    payload.notebookId,
    trimmedPrompt,
    input.source_ids,
    topK,
    minScore,
    signal,
    limiters,
  );

  // ② LLM generate (llm_generate stage limiter)
  const releaseLlm = await limiters.llmGenerate.acquire();
  let answer: string;
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { getDefaultChatModel } = await import('../../shared/config.ts');
    const modelConfig = getDefaultChatModel();
    if (!modelConfig) throw new Error('No chat model configured');
    const model = withRetry(await resolveModel(modelConfig));

    const { buildRefineMessages } = await import('../refine/format.ts');
    const messages = buildRefineMessages(format, trimmedPrompt, context);

    const { generateText } = await import('ai');
    const result = await generateText({
      model,
      system: messages.system,
      prompt: messages.user,
      abortSignal: signal,
    });
    answer = result.text;
  } finally {
    releaseLlm();
  }

  // ③ applyFormat
  const { applyFormat } = await import('../refine/format.ts');

  return {
    format,
    ...applyFormat(format, answer, trimmedPrompt, citations),
    citations,
    evidence,
    created_at: new Date().toISOString(),
  };
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
