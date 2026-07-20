// Refine router — citation-aware RAG summarizer (v1-aligned, c29).
//
// Nested canonical (c69):
//   POST /v2/notebooks/:nid/refine
//   POST /v2/notebooks/:nid/refine/batch
// Flat deprecated aliases:
//   POST /v2/refine
//   POST /v2/refine/batch
// Global flat:
//   GET  /v2/refine/modes
//
// v1 reference: features/refine/api.py (321 lines).
import {
  RefineBatchNestedRequestSchema,
  RefineBatchRequestSchema,
  RefineNestedRequestSchema,
  RefineRequestSchema,
  type RefineBatchNestedRequest,
  type RefineBatchRequest,
  type RefineFormat as SharedRefineFormat,
  type RefineNestedRequest,
  type RefineRequest,
} from '@crystalith/shared';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { notebooks, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { ErrorCode, sendError } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import type { TaskQueue } from '../../shared/queue.ts';
import { Semaphore } from '../../shared/semaphore.ts';
import { createStageLimiters } from '../tasks/worker.ts';
import { buildRefineMessages, applyFormat } from './format.ts';

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

type RefineFormat = SharedRefineFormat;

const ALL_FORMATS: RefineFormat[] = ['paragraph', 'bullets', 'structured'];

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/refine',
    method: 'post',
    summary: 'Refine: citation-aware RAG summary (single format)',
    tags: ['refine'],
    request: { body: RefineNestedRequestSchema },
    responses: { 200: { description: 'Refine result with citations' } },
  },
  {
    path: '/v2/notebooks/:nid/refine/batch',
    method: 'post',
    summary: 'Refine: multi-format concurrent (shared retrieval)',
    tags: ['refine'],
    request: { body: RefineBatchNestedRequestSchema },
    responses: { 200: { description: 'Batch refine result' } },
  },
  {
    path: '/v2/refine',
    method: 'post',
    summary: 'Refine: citation-aware RAG summary (single format)',
    tags: ['refine'],
    deprecated: true,
    request: { body: RefineRequestSchema },
    responses: { 200: { description: 'Refine result with citations' } },
  },
  {
    path: '/v2/refine/batch',
    method: 'post',
    summary: 'Refine: multi-format concurrent (shared retrieval)',
    tags: ['refine'],
    deprecated: true,
    request: { body: RefineBatchRequestSchema },
    responses: { 200: { description: 'Batch refine result' } },
  },
  {
    path: '/v2/refine/modes',
    method: 'get',
    summary: 'List available refine formats',
    tags: ['refine'],
    responses: { 200: { description: 'Format list' } },
  },
];

// ---------------------------------------------------------------------------
// Validation helpers (v1 _normalize_source_ids + _validate_source_ids)
// ---------------------------------------------------------------------------

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Dedup + int-cast + >0 check (v1 api.py:127-134). Throws on invalid. */
function normalizeSourceIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new ValidationError('source_ids must be an array');
  const normalized: number[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('Unknown source_id in source_ids');
    }
    normalized.push(id);
  }
  // dedup preserving order (v1 dict.fromkeys)
  return [...new Set(normalized)];
}

/** Verify all source_ids exist in the notebook (v1 api.py:136-152). */
function validateSourceIds(notebookId: number, sourceIds: number[]): void {
  if (sourceIds.length === 0) return;
  const rows = db()
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .all();
  const found = new Set(rows.map((r) => r.id));
  const missing = sourceIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ValidationError('Unknown source_id in source_ids');
  }
}

function validateFormat(format: unknown): RefineFormat {
  if (typeof format !== 'string' || !ALL_FORMATS.includes(format as RefineFormat)) {
    throw new ValidationError('Unsupported refine format');
  }
  return format as RefineFormat;
}

// ---------------------------------------------------------------------------
// Handlers (shared by nested + flat)
// ---------------------------------------------------------------------------

type SetStatus = { status?: number | string };

type RefineBodyResolved = (RefineRequest | RefineNestedRequest) & { notebookId: number };
type RefineBatchBodyResolved = (RefineBatchRequest | RefineBatchNestedRequest) & {
  notebookId: number;
};

async function handleRefine(
  taskQueue: TaskQueue,
  body: RefineBodyResolved,
  set: SetStatus,
): Promise<unknown> {
  const notebookId = body.notebookId;

  // ① notebook existence → 404
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError('Notebook not found');

  const prompt = body.prompt.trim();
  if (!prompt) {
    return sendError(set, ErrorCode.INVALID_REQUEST, 'Refine task requires a prompt');
  }

  // ② format + source_ids validation → 400
  let format: RefineFormat;
  let sourceIds: number[];
  try {
    format = validateFormat(body.format ?? 'paragraph');
    sourceIds = body.sourceIds ? normalizeSourceIds(body.sourceIds) : [];
    validateSourceIds(notebookId, sourceIds);
  } catch (error) {
    return sendError(set, ErrorCode.INVALID_REQUEST, (error as Error).message);
  }

  const topK = body.topK;
  const minScore = body.minScore;

  // ③ enqueue + waitForCompletion
  const taskId = taskQueue.enqueue({
    type: 'refine',
    notebookId,
    payload: {
      refineInput: {
        prompt,
        format,
        sourceIds: sourceIds.length ? sourceIds : undefined,
        topK: topK,
        minScore: minScore,
        notebookId: notebookId,
      },
    },
    priority: 1,
  });

  try {
    return await taskQueue.waitForCompletion(taskId);
  } catch (error) {
    if (error instanceof Error && error.message === 'Task cancelled') {
      return sendError(set, ErrorCode.CONFLICT, 'Task cancelled');
    }
    return sendError(
      set,
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Task failed',
    );
  }
}

async function handleRefineBatch(body: RefineBatchBodyResolved, set: SetStatus): Promise<unknown> {
  const notebookId = body.notebookId;

  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError('Notebook not found');

  // formats: null → all 3 (v1 _resolve_formats)
  let requestedFormats: RefineFormat[];
  let sourceIds: number[];
  try {
    requestedFormats =
      Array.isArray(body.formats) && body.formats.length > 0
        ? body.formats.map((f) => validateFormat(f))
        : [...ALL_FORMATS];
    sourceIds = body.sourceIds ? normalizeSourceIds(body.sourceIds) : [];
    validateSourceIds(notebookId, sourceIds);
  } catch (error) {
    return sendError(set, ErrorCode.INVALID_REQUEST, (error as Error).message);
  }

  const topK = body.topK;
  const minScore = body.minScore;
  const prompt = body.prompt.trim();
  if (!prompt) {
    return sendError(set, ErrorCode.INVALID_REQUEST, 'Refine task requires a prompt');
  }

  // ① retrieve once — shared across all formats
  const { retrieveForRefine } = await import('./retrieve.ts');
  const limiters = createStageLimiters();
  const { citations, context, evidence } = await retrieveForRefine(
    notebookId,
    prompt,
    sourceIds,
    topK,
    minScore,
    new AbortController().signal,
    limiters,
  );

  // ② resolve model once
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  // ③ generate each format concurrently (Semaphore(3), v1 api.py:305)
  const sem = new Semaphore(3);
  const { generateText } = await import('ai');

  const generateFormat = async (format: RefineFormat) => {
    const release = await sem.acquire();
    try {
      const messages = buildRefineMessages(format, prompt, context);
      const result = await generateText({
        model,
        system: messages.system,
        prompt: messages.user,
      });
      return [format, applyFormat(format, result.text, prompt, citations)] as const;
    } finally {
      release();
    }
  };

  const generated = await Promise.all(requestedFormats.map(generateFormat));
  const outputs: Record<string, ReturnType<typeof applyFormat>> = {};
  for (const [format, output] of generated) {
    outputs[format] = output;
  }

  return {
    outputs,
    citations,
    evidence,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router (factory)
// ---------------------------------------------------------------------------

export function refineRouter(taskQueue: TaskQueue) {
  registerApiDoc(apiDocs);

  return (
    new Elysia({ prefix: '/v2' })
      // List formats — global flat only (c69)
      .get('/refine/modes', () =>
        ALL_FORMATS.map((id) => ({
          id,
          name: id === 'paragraph' ? '段落摘要' : id === 'bullets' ? '要点摘要' : '结构化提取',
        })),
      )

      // ---- Nested canonical ----
      .post(
        '/notebooks/:nid/refine',
        async ({ params, body, set }) => {
          const nid = requirePositiveIntId(params.nid, 'notebook id');
          const notebookId = resolveNestedNotebookId(nid, body.notebookId);
          return handleRefine(taskQueue, { ...body, notebookId }, set);
        },
        { body: RefineNestedRequestSchema },
      )
      .post(
        '/notebooks/:nid/refine/batch',
        async ({ params, body, set }) => {
          const nid = requirePositiveIntId(params.nid, 'notebook id');
          const notebookId = resolveNestedNotebookId(nid, body.notebookId);
          return handleRefineBatch({ ...body, notebookId }, set);
        },
        { body: RefineBatchNestedRequestSchema },
      )

      // ---- Flat deprecated aliases (c67 notebookId required on body) ----
      .post('/refine', async ({ body, set }) => handleRefine(taskQueue, body, set), {
        body: RefineRequestSchema,
      })
      .post('/refine/batch', async ({ body, set }) => handleRefineBatch(body, set), {
        body: RefineBatchRequestSchema,
      })
  );
}
