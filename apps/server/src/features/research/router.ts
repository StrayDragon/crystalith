// Research router — /v2/notebooks/:nid/research (canonical) + flat /v2/research aliases.
//
// Endpoints (nested canonical; flat kept as deprecated aliases):
//   POST   .../research                    — Start a new research session
//   GET    .../research                    — List research sessions for a notebook
//   GET    .../research/:id                — Get research session status + results
//   DELETE .../research/:id                — Delete a research session (c37)
//   POST   .../research/:id/approve        — Approve search plan (HITL)
//   POST   .../research/:id/modify         — Modify search plan (HITL)
//   POST   .../research/:id/skip           — Skip iteration (c37: advance iteration)
//   POST   .../research/:id/finish         — Early complete (c37: triggers report)
//   POST   .../research/:id/cancel         — Cancel a running research
//   POST   .../research/:id/resume         — Resume from inferred state (c37)
//   POST   .../research/:id/export         — Export report → source/note
//   GET    .../research/:id/stream         — SSE progress relay (c37: named events)
//
// c37: control endpoints now record steps + transition correctly (v1 parity).
import {
  Empty204Schema,
  NotebookIdQuerySchema,
  PaginatedSchema,
  PaginationParamsSchema,
  ResearchActionResultSchema,
  ResearchExportBodySchema,
  ResearchExportResponseSchema,
  ResearchSessionCreateNestedSchema,
  ResearchSessionCreateSchema,
  ResearchSessionDetailSchema,
  ResearchSessionSchema,
  SearchPlanSchema,
  type ResearchActionResult,
  type ResearchExportBody,
  type ResearchStatus,
  type ResearchStepType,
} from '@crystalith/shared';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { db } from '../../db/index.ts';
import {
  chunks,
  notebooks,
  outputs,
  researchSessions,
  researchSteps,
  sources,
} from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import {
  runResearch,
  runResearchFromState,
  generateFinalReport,
  synthesizeFallbackReport,
  type ResearchState,
  type ResearchResult,
} from './agent.ts';
// H4: lock primitives moved to lock.ts to break circular dependency
import { acquireLock, isLockHeld, releaseLock } from './lock.ts';
import { deriveNamedEvent, statusMessage } from './sse-events.ts';
export { cleanupExpiredLocks, isLockHeld, renewLock, acquireLock, releaseLock } from './lock.ts';

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const ResearchListQuerySchema = NotebookIdQuerySchema.merge(PaginationParamsSchema);
const ResearchPageSchema = PaginatedSchema(ResearchSessionSchema);
const ResearchModifyBodySchema = z.object({ plan: SearchPlanSchema });

const nestedResearchDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/research',
    method: 'post',
    summary: 'Start a new research session',
    tags: ['research'],
    responses: { 201: { description: 'Created research session' } },
  },
  {
    path: '/v2/notebooks/:nid/research',
    method: 'get',
    summary: 'List research sessions',
    tags: ['research'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: {
      200: { description: 'Paginated research session list', body: ResearchPageSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/research/:id',
    method: 'get',
    summary: 'Get research session details',
    tags: ['research'],
    responses: { 200: { description: 'Research session with results' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id',
    method: 'delete',
    summary: 'Delete a research session',
    tags: ['research'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/approve',
    method: 'post',
    summary: 'Approve search plan (HITL)',
    tags: ['research'],
    responses: { 200: { description: 'Approval recorded' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/modify',
    method: 'post',
    summary: 'Modify search plan and continue (HITL)',
    tags: ['research'],
    responses: { 200: { description: 'Modified plan recorded, resuming' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/skip',
    method: 'post',
    summary: 'Skip iteration',
    tags: ['research'],
    responses: { 200: { description: 'Iteration skipped' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/finish',
    method: 'post',
    summary: 'Early complete + report generation',
    tags: ['research'],
    responses: { 200: { description: 'Session completed with report' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/cancel',
    method: 'post',
    summary: 'Cancel a research session',
    tags: ['research'],
    responses: { 200: { description: 'Session cancelled' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/resume',
    method: 'post',
    summary: 'Resume from inferred state',
    tags: ['research'],
    responses: { 200: { description: 'Research resumed' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/export',
    method: 'post',
    summary: 'Export research report',
    tags: ['research'],
    responses: { 200: { description: 'Report exported' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:id/stream',
    method: 'get',
    summary: 'SSE stream for research progress',
    tags: ['research'],
    responses: { 200: { description: 'SSE event stream' } },
  },
];

const flatResearchAliasDocs: OpenApiRoute[] = [
  {
    path: '/v2/research',
    method: 'post',
    summary: 'Start a new research session (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 201: { description: 'Created research session' } },
  },
  {
    path: '/v2/research',
    method: 'get',
    summary: 'List research sessions (flat alias)',
    tags: ['research'],
    deprecated: true,
    request: {
      query: {
        notebookId: NotebookIdQuerySchema.shape.notebookId,
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: {
      200: { description: 'Paginated research session list', body: ResearchPageSchema },
    },
  },
  {
    path: '/v2/research/:id',
    method: 'get',
    summary: 'Get research session details (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Research session with results' } },
  },
  {
    path: '/v2/research/:id',
    method: 'delete',
    summary: 'Delete a research session (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/research/:id/approve',
    method: 'post',
    summary: 'Approve search plan (HITL) (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Approval recorded' } },
  },
  {
    path: '/v2/research/:id/modify',
    method: 'post',
    summary: 'Modify search plan and continue (HITL) (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Modified plan recorded, resuming' } },
  },
  {
    path: '/v2/research/:id/skip',
    method: 'post',
    summary: 'Skip iteration (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Iteration skipped' } },
  },
  {
    path: '/v2/research/:id/finish',
    method: 'post',
    summary: 'Early complete + report generation (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Session completed with report' } },
  },
  {
    path: '/v2/research/:id/cancel',
    method: 'post',
    summary: 'Cancel a research session (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Session cancelled' } },
  },
  {
    path: '/v2/research/:id/resume',
    method: 'post',
    summary: 'Resume from inferred state (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Research resumed' } },
  },
  {
    path: '/v2/research/:id/export',
    method: 'post',
    summary: 'Export research report (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'Report exported' } },
  },
  {
    path: '/v2/research/:id/stream',
    method: 'get',
    summary: 'SSE stream for research progress (flat alias)',
    tags: ['research'],
    deprecated: true,
    responses: { 200: { description: 'SSE event stream' } },
  },
];

const apiDocs: OpenApiRoute[] = [...nestedResearchDocs, ...flatResearchAliasDocs];
// ---------------------------------------------------------------------------
// Active sessions — AbortController management for cancel
// ---------------------------------------------------------------------------

const activeResearch = new Map<number, AbortController>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResearchOrThrow(id: number, notebookId: number) {
  const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
  if (!row || row.notebookId !== notebookId) {
    throw new NotFoundError(`Research session ${id} not found`);
  }
  return row;
}

function serializeSession(row: typeof researchSessions.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    topic: row.topic,
    status: row.status as ResearchStatus,
    currentIteration: row.currentIteration,
    maxIterations: row.maxIterations,
    aggregatedResults: row.aggregatedResults as Array<Record<string, unknown>> | null,
    finalReport: row.finalReport,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  };
}

function serializeStep(row: typeof researchSteps.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    iteration: row.iteration,
    type: row.type as ResearchStepType,
    inputData: (row.inputData as Record<string, unknown> | null) ?? null,
    outputData: (row.outputData as Record<string, unknown> | null) ?? null,
    status: row.status as 'pending' | 'running' | 'completed' | 'skipped',
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
  };
}

/** Record a user_input step (v1 api.py:483-534 pattern). */
function recordUserStep(
  sessionId: number,
  iteration: number,
  action: string,
  extra?: Record<string, unknown>,
): void {
  db()
    .insert(researchSteps)
    .values({
      sessionId,
      iteration,
      type: 'user_input',
      inputData: { action, ...extra } as Record<string, unknown>,
      status: 'completed',
    })
    .run();
}

// ---------------------------------------------------------------------------
// Session lock primitives — moved to lock.ts (H4: break circular dependency)
// ---------------------------------------------------------------------------

/** Spawn a research agent in background, managing abort controller + lock. */
function spawnResearch(
  id: number,
  runner: (id: number, signal: AbortSignal) => Promise<unknown>,
): void {
  releaseLock(id);
  acquireLock(id);
  const ac = new AbortController();
  activeResearch.set(id, ac);

  runner(id, ac.signal)
    .catch((error) => {
      console.error(`[research] agent failed for session ${id}:`, error);
      if (!ac.signal.aborted) {
        db()
          .update(researchSessions)
          .set({ status: 'cancelled' })
          .where(eq(researchSessions.id, id))
          .run();
      }
    })
    .finally(() => {
      releaseLock(id);
      activeResearch.delete(id);
    });
}

// ---------------------------------------------------------------------------
// Resume state inference (v1 _infer_resume_state, c37)
// ---------------------------------------------------------------------------

/**
 * Infer the resume status from the last persisted step.
 * v1 api.py:185-229: inspects last step type + user_input action.
 *
 * Returns the status to resume in, or null if resume is not possible.
 */
function inferResumeState(sessionId: number): {
  status: 'planning' | 'searching' | 'analyzing' | 'waiting_user' | null;
  iteration: number;
} {
  const session = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .get();
  if (!session) return { status: null, iteration: 1 };

  // Cannot resume a cancelled session that had a user cancel action
  if (session.status === 'cancelled') {
    const lastCancel = db()
      .select()
      .from(researchSteps)
      .where(eq(researchSteps.sessionId, sessionId))
      .orderBy(desc(researchSteps.id))
      .all()
      .find((s) => s.type === 'user_input');
    if (
      lastCancel?.inputData &&
      (lastCancel.inputData as Record<string, unknown>).action === 'cancel'
    ) {
      return { status: null, iteration: session.currentIteration };
    }
  }

  // Already completed — resume to generate/finish report
  if (session.status === 'completed') {
    return { status: null, iteration: session.currentIteration };
  }

  // Check last step to infer where to resume
  const lastStep = db()
    .select()
    .from(researchSteps)
    .where(eq(researchSteps.sessionId, sessionId))
    .orderBy(desc(researchSteps.id))
    .all()[0];

  if (!lastStep) {
    return { status: 'planning', iteration: session.currentIteration };
  }

  switch (lastStep.type) {
    case 'user_input': {
      const action = (lastStep.inputData as Record<string, unknown>)?.action;
      // v1 api.py:203-212 — finish/skip-at-max → completed; approve/modify → searching
      if (action === 'finish') return { status: null, iteration: lastStep.iteration };
      if (action === 'cancel') return { status: null, iteration: lastStep.iteration };
      if (action === 'skip') {
        if (lastStep.iteration >= session.maxIterations) {
          return { status: null, iteration: lastStep.iteration };
        }
        return { status: 'planning', iteration: lastStep.iteration };
      }
      // approve / modify / unknown → continue searching with that iteration
      return { status: 'searching', iteration: lastStep.iteration };
    }
    case 'plan':
      return { status: 'waiting_user', iteration: lastStep.iteration };
    case 'search':
      return { status: 'analyzing', iteration: lastStep.iteration };
    case 'analyze': {
      const needMore = Boolean((lastStep.outputData as Record<string, unknown> | null)?.needMore);
      if (needMore && lastStep.iteration < session.maxIterations) {
        return { status: 'planning', iteration: lastStep.iteration + 1 };
      }
      // Re-run analysis toward report (v1)
      return { status: 'analyzing', iteration: lastStep.iteration };
    }
    case 'summary':
      return { status: null, iteration: lastStep.iteration };
    default:
      return { status: 'planning', iteration: session.currentIteration };
  }
}

// ---------------------------------------------------------------------------
// Handlers (shared by nested canonical + flat alias routes)
// ---------------------------------------------------------------------------

type SetStatus = { status?: number | string; headers: Record<string, string | number> };

async function handleCreateResearch(
  notebookId: number,
  body: { topic?: string; goal?: string; maxIterations?: number },
  set: SetStatus,
) {
  // Accept both 'topic' (canonical) and 'goal' (some clients' convention)
  const topic = (body.topic ?? body.goal ?? '').trim() || '深度研究';

  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

  const session = db()
    .insert(researchSessions)
    .values({
      notebookId,
      topic,
      status: 'planning',
      maxIterations: Number(body.maxIterations ?? 4),
    })
    .returning()
    .get();

  spawnResearch(session.id, runResearch);
  set.status = 201;
  return serializeSession(session);
}

function handleListResearch(notebookId: number, offset: number, limit: number) {
  const total =
    db()
      .select({ n: count() })
      .from(researchSessions)
      .where(eq(researchSessions.notebookId, notebookId))
      .get()?.n ?? 0;
  const rows = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.notebookId, notebookId))
    .orderBy(desc(researchSessions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  return {
    items: rows.map(serializeSession),
    total,
    offset,
    limit,
  };
}

function handleGetResearch(id: number, notebookId: number) {
  const row = getResearchOrThrow(id, notebookId);
  const steps = db()
    .select()
    .from(researchSteps)
    .where(eq(researchSteps.sessionId, id))
    .orderBy(researchSteps.id)
    .all();
  return {
    ...serializeSession(row),
    steps: steps.map(serializeStep),
  };
}

function handleDeleteResearch(id: number, notebookId: number, set: SetStatus) {
  getResearchOrThrow(id, notebookId);

  const ac = activeResearch.get(id);
  if (ac) {
    ac.abort();
    activeResearch.delete(id);
  }

  db().delete(researchSessions).where(eq(researchSessions.id, id)).run();
  set.status = 204;
  return;
}

function handleApproveResearch(id: number, notebookId: number): ResearchActionResult {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status !== 'waiting_user') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Session ${id} is not waiting for approval (status: ${row.status})`,
    );
  }

  recordUserStep(id, row.currentIteration, 'approve');

  db()
    .update(researchSessions)
    .set({ status: 'searching' })
    .where(eq(researchSessions.id, id))
    .run();

  return { id, status: 'searching', approved: true };
}

function handleModifyResearch(
  id: number,
  notebookId: number,
  plan: z.infer<typeof SearchPlanSchema>,
): ResearchActionResult {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status !== 'waiting_user') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Session ${id} is not waiting for approval (status: ${row.status})`,
    );
  }

  recordUserStep(id, row.currentIteration, 'modify', { plan });

  db()
    .update(researchSessions)
    .set({ status: 'searching' })
    .where(eq(researchSessions.id, id))
    .run();

  return { id, status: 'searching', modified: true };
}

function handleSkipResearch(id: number, notebookId: number): ResearchActionResult {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status !== 'waiting_user') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Cannot skip from status '${row.status}' (must be waiting_user)`,
    );
  }

  recordUserStep(id, row.currentIteration, 'skip');

  const nextIteration = row.currentIteration + 1;
  if (nextIteration > row.maxIterations) {
    db()
      .update(researchSessions)
      .set({ status: 'completed', currentIteration: row.maxIterations })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, status: 'completed', skipped: true };
  }

  db()
    .update(researchSessions)
    .set({ status: 'planning', currentIteration: nextIteration })
    .where(eq(researchSessions.id, id))
    .run();

  return { id, status: 'planning', skipped: true, nextIteration };
}

function handleFinishResearch(id: number, notebookId: number): ResearchActionResult {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status === 'completed' || row.status === 'cancelled') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Cannot finish from terminal status '${row.status}'`,
    );
  }

  recordUserStep(id, row.currentIteration, 'finish');

  const ac = activeResearch.get(id);
  if (ac) {
    ac.abort();
    activeResearch.delete(id);
  }

  db()
    .update(researchSessions)
    .set({ status: 'completed', lockedAt: null, lockExpiresAt: null })
    .where(eq(researchSessions.id, id))
    .run();

  const state: ResearchState = {
    sessionId: id,
    notebookId: row.notebookId,
    topic: row.topic,
    iteration: row.currentIteration,
    maxIterations: row.maxIterations,
    results: (row.aggregatedResults ?? []) as ResearchResult[],
  };
  void Promise.resolve()
    .then(() => generateFinalReport(state))
    .then((report) => {
      db()
        .update(researchSessions)
        .set({ finalReport: report })
        .where(eq(researchSessions.id, id))
        .run();
    })
    .catch((error) => {
      console.error(`[research] finish report failed for session ${id}:`, error);
      const results = (row.aggregatedResults ?? []) as ResearchResult[];
      db()
        .update(researchSessions)
        .set({ finalReport: synthesizeFallbackReport(row.topic, results) })
        .where(eq(researchSessions.id, id))
        .run();
    });

  return { id, status: 'completed', reportGenerated: 'pending' };
}

function handleCancelResearch(id: number, notebookId: number): ResearchActionResult {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status === 'cancelled') {
    return { id, status: 'cancelled', message: 'Already cancelled' };
  }
  if (row.status === 'completed') {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Cannot cancel from terminal status 'completed'`,
    );
  }

  recordUserStep(id, row.currentIteration, 'cancel');

  const ac = activeResearch.get(id);
  if (ac) {
    ac.abort();
    activeResearch.delete(id);
  }

  db()
    .update(researchSessions)
    .set({ status: 'cancelled', lockedAt: null, lockExpiresAt: null })
    .where(eq(researchSessions.id, id))
    .run();

  return { id, status: 'cancelled' };
}

async function handleResumeResearch(id: number, notebookId: number): Promise<ResearchActionResult> {
  const row = getResearchOrThrow(id, notebookId);
  if (row.status !== 'cancelled' && row.lockExpiresAt && isLockHeld(row)) {
    throw new AppHttpError(
      ErrorCode.CONFLICT,
      `Session ${id} is still active (status: ${row.status}, lock held)`,
    );
  }

  const { status: inferredStatus, iteration } = inferResumeState(id);

  if (inferredStatus === null) {
    throw new AppHttpError(
      ErrorCode.INVALID_REQUEST,
      `Session ${id} cannot be resumed (completed, cancelled by user, or already has a report)`,
    );
  }

  db()
    .update(researchSessions)
    .set({ status: inferredStatus, currentIteration: iteration })
    .where(eq(researchSessions.id, id))
    .run();

  spawnResearch(id, runResearchFromState);
  return { id, status: inferredStatus as ResearchStatus, resumed: true, iteration };
}

async function handleExportResearch(
  id: number,
  notebookId: number,
  body: ResearchExportBody | undefined,
) {
  const row = getResearchOrThrow(id, notebookId);

  if (!row.finalReport) {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, 'Research has no final report to export');
  }

  const exportType = body?.exportType ?? 'source';

  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const reportContent = [
    `# 研究报告：${row.topic}`,
    '',
    `> 生成时间：${new Date().toISOString()}`,
    `> 研究轮次：${row.currentIteration}/${row.maxIterations}`,
    '',
    '---',
    '',
    row.finalReport,
  ].join('\n');

  if (exportType === 'note') {
    const output = db()
      .insert(outputs)
      .values({
        notebookId: row.notebookId,
        type: 'STRUCTURED',
        prompt: `research:${id}`,
        content: {
          title: `研究报告：${row.topic}`,
          text: row.finalReport,
          metadata: {
            researchId: id,
            researchTopic: row.topic,
            exportTimestamp: timestamp,
          },
        },
      })
      .returning()
      .get();
    return { success: true as const, exportType: 'note' as const, outputId: output.id };
  }

  const filename = `研究报告_${row.topic.slice(0, 20)}_${timestamp}.md`;

  const source = db()
    .insert(sources)
    .values({
      notebookId: row.notebookId,
      filename,
      status: 'processing',
    })
    .returning()
    .get();

  const { chunkText } = await import('../../rag/chunker.ts');
  const reportChunks = chunkText(reportContent);

  const chunkRows: Array<{ id: number; text: string }> = [];
  for (const chunk of reportChunks) {
    const chunkRow = db()
      .insert(chunks)
      .values({
        sourceId: source.id,
        chunkIndex: chunk.index,
        text: chunk.text,
      })
      .returning()
      .get();
    chunkRows.push({ id: chunkRow.id, text: chunk.text });
  }

  if (chunkRows.length > 0) {
    try {
      const { embedBatch } = await import('../../rag/embedder.ts');
      const { insertChunkVector } = await import('../../db/vectors.ts');
      const vectors = await embedBatch(chunkRows.map((c) => c.text));

      for (let i = 0; i < vectors.length; i++) {
        insertChunkVector(db(), chunkRows[i].id, row.notebookId, source.id, vectors[i]);
      }

      const { bumpVectorEpoch } = await import('../../rag/cache.ts');
      bumpVectorEpoch(row.notebookId);
    } catch (error) {
      console.error('[research] export embedding failed:', error);
      db().update(sources).set({ status: 'failed' }).where(eq(sources.id, source.id)).run();
      throw new Error('Failed to embed exported report', { cause: error });
    }
  }

  db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();

  const { bumpSourcesEpoch } = await import('../../rag/cache.ts');
  bumpSourcesEpoch(row.notebookId);

  return {
    success: true as const,
    exportType: 'source' as const,
    message: `报告已导出为来源：${filename}`,
    sourceId: source.id,
  };
}

function handleResearchStream(id: number, notebookId: number, set: SetStatus) {
  const row = getResearchOrThrow(id, notebookId);

  const isActiveStatus =
    row.status === 'planning' ||
    row.status === 'searching' ||
    row.status === 'analyzing' ||
    row.status === 'waiting_user';
  if (isActiveStatus && !activeResearch.has(id)) {
    spawnResearch(id, runResearchFromState);
  }

  set.headers['Content-Type'] = 'text/event-stream';
  set.headers['Cache-Control'] = 'no-cache';
  set.headers.Connection = 'keep-alive';

  const flag = { closed: false };
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  return new ReadableStream({
    start(controller) {
      let lastStepId = 0;
      let lastStatus: string | null = null;
      const encoder = new TextEncoder();

      const safeClose = () => {
        if (flag.closed) return;
        flag.closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };

      const emit = (eventName: string, data: unknown) => {
        if (flag.closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Client disconnected — stop polling/heartbeats.
          flag.closed = true;
          if (heartbeat) clearInterval(heartbeat);
        }
      };

      heartbeat = setInterval(() => {
        if (!flag.closed) emit('heartbeat', {});
      }, 30_000);

      const poll = async () => {
        while (!flag.closed) {
          const current = db()
            .select()
            .from(researchSessions)
            .where(eq(researchSessions.id, id))
            .get();
          if (!current) break;

          if (current.status !== lastStatus) {
            const prev = lastStatus;
            lastStatus = current.status;
            emit('status', {
              type: 'status',
              status: current.status,
              previous: prev,
              iteration: current.currentIteration,
              message: statusMessage(current.status),
            });
          }

          const steps = db()
            .select()
            .from(researchSteps)
            .where(and(gt(researchSteps.id, lastStepId), eq(researchSteps.sessionId, id)))
            .all();

          for (const step of steps) {
            const { event, data } = deriveNamedEvent(step);
            emit(event, data);
            lastStepId = step.id;
          }

          if (current.status === 'completed' || current.status === 'cancelled') {
            emit('done', {
              type: 'done',
              status: current.status,
              totalResults: (current.aggregatedResults as unknown[] | null)?.length ?? 0,
              hasReport: !!current.finalReport,
            });
            safeClose();
            break;
          }

          await sleep(250);
        }
      };

      poll().catch((error) => {
        if (!flag.closed) {
          emit('error', { type: 'error', message: String(error) });
          safeClose();
        }
      });
    },
    cancel() {
      flag.closed = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const researchRouter = new Elysia({ prefix: '/v2' })
  // ---- Nested canonical ----
  .post(
    '/notebooks/:nid/research',
    async ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      return handleCreateResearch(notebookId, body, set);
    },
    { body: ResearchSessionCreateNestedSchema, response: ResearchSessionSchema },
  )
  .get(
    '/notebooks/:nid/research',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return handleListResearch(nid, query.offset ?? 0, query.limit ?? 20);
    },
    { query: PaginationParamsSchema, response: ResearchPageSchema },
  )
  .get(
    '/notebooks/:nid/research/:id',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleGetResearch(id, nid);
    },
    { response: ResearchSessionDetailSchema },
  )
  .delete(
    '/notebooks/:nid/research/:id',
    ({ params, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleDeleteResearch(id, nid, set);
    },
    { response: { 204: Empty204Schema } },
  )
  .post(
    '/notebooks/:nid/research/:id/approve',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleApproveResearch(id, nid);
    },
    { response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/modify',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleModifyResearch(id, nid, body.plan);
    },
    { body: ResearchModifyBodySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/skip',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleSkipResearch(id, nid);
    },
    { response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/finish',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleFinishResearch(id, nid);
    },
    { response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/cancel',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleCancelResearch(id, nid);
    },
    { response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/resume',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleResumeResearch(id, nid);
    },
    { response: ResearchActionResultSchema },
  )
  .post(
    '/notebooks/:nid/research/:id/export',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const id = requirePositiveIntId(params.id, 'research id');
      return handleExportResearch(id, nid, body);
    },
    { body: ResearchExportBodySchema, response: ResearchExportResponseSchema },
  )
  .get('/notebooks/:nid/research/:id/stream', ({ params, set }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const id = requirePositiveIntId(params.id, 'research id');
    return handleResearchStream(id, nid, set);
  })

  // ---- Flat aliases (deprecated; c67 notebookId still required) ----
  .post('/research', async ({ body, set }) => handleCreateResearch(body.notebookId, body, set), {
    body: ResearchSessionCreateSchema,
    response: ResearchSessionSchema,
  })
  .get(
    '/research',
    ({ query }) => handleListResearch(query.notebookId, query.offset ?? 0, query.limit ?? 20),
    { query: ResearchListQuerySchema, response: ResearchPageSchema },
  )
  .get(
    '/research/:id',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleGetResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchSessionDetailSchema },
  )
  .delete(
    '/research/:id',
    ({ params, query, set }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleDeleteResearch(id, query.notebookId, set);
    },
    { query: NotebookIdQuerySchema, response: { 204: Empty204Schema } },
  )
  .post(
    '/research/:id/approve',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleApproveResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/research/:id/modify',
    ({ params, query, body }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleModifyResearch(id, query.notebookId, body.plan);
    },
    {
      body: ResearchModifyBodySchema,
      query: NotebookIdQuerySchema,
      response: ResearchActionResultSchema,
    },
  )
  .post(
    '/research/:id/skip',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleSkipResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/research/:id/finish',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleFinishResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/research/:id/cancel',
    ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleCancelResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/research/:id/resume',
    async ({ params, query }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleResumeResearch(id, query.notebookId);
    },
    { query: NotebookIdQuerySchema, response: ResearchActionResultSchema },
  )
  .post(
    '/research/:id/export',
    async ({ params, query, body }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleExportResearch(id, query.notebookId, body);
    },
    {
      query: NotebookIdQuerySchema,
      body: ResearchExportBodySchema,
      response: ResearchExportResponseSchema,
    },
  )
  .get(
    '/research/:id/stream',
    ({ params, query, set }) => {
      const id = requirePositiveIntId(params.id, 'research id');
      return handleResearchStream(id, query.notebookId, set);
    },
    { query: NotebookIdQuerySchema },
  );

registerApiDoc(apiDocs);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}
