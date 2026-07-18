// Research router — /v2/research CRUD + agent execution.
//
// Endpoints:
//   POST   /v2/research                    — Start a new research session
//   GET    /v2/research                    — List research sessions for a notebook
//   GET    /v2/research/:id                — Get research session status + results
//   DELETE /v2/research/:id                — Delete a research session (c37)
//   POST   /v2/research/:id/approve        — Approve search plan (HITL)
//   POST   /v2/research/:id/modify         — Modify search plan (HITL)
//   POST   /v2/research/:id/skip           — Skip iteration (c37: advance iteration)
//   POST   /v2/research/:id/finish         — Early complete (c37: triggers report)
//   POST   /v2/research/:id/cancel         — Cancel a running research
//   POST   /v2/research/:id/resume         — Resume from inferred state (c37)
//   POST   /v2/research/:id/export         — Export report → source/note
//   GET    /v2/research/:id/stream         — SSE progress relay (c37: named events)
//
// c37: control endpoints now record steps + transition correctly (v1 parity).
import { and, desc, eq, gt } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

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
import { requirePositiveIntId, requireOptionalPositiveIntId } from '../../shared/ids.ts';
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
export { cleanupExpiredLocks, isLockHeld, renewLock, acquireLock, releaseLock } from './lock.ts';

// ---------------------------------------------------------------------------
// OpenAPI docs
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/research',
    method: 'post',
    summary: 'Start a new research session',
    tags: ['research'],
    responses: { 201: { description: 'Created research session' } },
  },
  {
    path: '/v2/research',
    method: 'get',
    summary: 'List research sessions',
    tags: ['research'],
    responses: { 200: { description: 'List of research sessions' } },
  },
  {
    path: '/v2/research/:id',
    method: 'get',
    summary: 'Get research session details',
    tags: ['research'],
    responses: { 200: { description: 'Research session with results' } },
  },
  {
    path: '/v2/research/:id',
    method: 'delete',
    summary: 'Delete a research session',
    tags: ['research'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/research/:id/approve',
    method: 'post',
    summary: 'Approve search plan (HITL)',
    tags: ['research'],
    responses: { 200: { description: 'Approval recorded' } },
  },
  {
    path: '/v2/research/:id/modify',
    method: 'post',
    summary: 'Modify search plan and continue (HITL)',
    tags: ['research'],
    responses: { 200: { description: 'Modified plan recorded, resuming' } },
  },
  {
    path: '/v2/research/:id/skip',
    method: 'post',
    summary: 'Skip iteration',
    tags: ['research'],
    responses: { 200: { description: 'Iteration skipped' } },
  },
  {
    path: '/v2/research/:id/finish',
    method: 'post',
    summary: 'Early complete + report generation',
    tags: ['research'],
    responses: { 200: { description: 'Session completed with report' } },
  },
  {
    path: '/v2/research/:id/cancel',
    method: 'post',
    summary: 'Cancel a research session',
    tags: ['research'],
    responses: { 200: { description: 'Session cancelled' } },
  },
  {
    path: '/v2/research/:id/resume',
    method: 'post',
    summary: 'Resume from inferred state',
    tags: ['research'],
    responses: { 200: { description: 'Research resumed' } },
  },
  {
    path: '/v2/research/:id/export',
    method: 'post',
    summary: 'Export research report',
    tags: ['research'],
    responses: { 200: { description: 'Report exported' } },
  },
  {
    path: '/v2/research/:id/stream',
    method: 'get',
    summary: 'SSE stream for research progress',
    tags: ['research'],
    responses: { 200: { description: 'SSE event stream' } },
  },
];

// ---------------------------------------------------------------------------
// Active sessions — AbortController management for cancel
// ---------------------------------------------------------------------------

const activeResearch = new Map<number, AbortController>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSession(row: typeof researchSessions.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    topic: row.topic,
    status: row.status,
    currentIteration: row.currentIteration,
    maxIterations: row.maxIterations,
    aggregatedResults: row.aggregatedResults as Array<Record<string, unknown>> | null,
    finalReport: row.finalReport,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
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
      const needMore = Boolean(
        (lastStep.outputData as Record<string, unknown> | null)?.need_more_search ??
        (lastStep.outputData as Record<string, unknown> | null)?.needMore,
      );
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
// Router
// ---------------------------------------------------------------------------

export const researchRouter = new Elysia({ prefix: '/v2' })
  // Start a new research session
  .post('/research', async ({ body, set }) => {
    const raw = body as Record<string, unknown>;
    // Accept both 'topic' (canonical) and 'goal' (some clients' convention)
    const topic =
      (typeof raw.topic === 'string'
        ? raw.topic
        : typeof raw.goal === 'string'
          ? raw.goal
          : ''
      ).trim() || '深度研究';
    const notebookId = raw.notebookId;
    const maxIterations = raw.maxIterations;
    const nid = requirePositiveIntId(notebookId, 'notebook id');

    const nb = db().select().from(notebooks).where(eq(notebooks.id, nid)).get();
    if (!nb) throw new NotFoundError(`Notebook ${nid} not found`);

    const session = db()
      .insert(researchSessions)
      .values({
        notebookId: nid,
        topic,
        status: 'planning',
        maxIterations: Number(maxIterations ?? 4),
      })
      .returning()
      .get();

    spawnResearch(session.id, runResearch);
    set.status = 201;
    return serializeSession(session);
  })

  // List research sessions
  .get('/research', ({ query }) => {
    const notebookId = requireOptionalPositiveIntId(
      (query as { notebookId?: string }).notebookId,
      'notebook id',
    );
    let q = db().select().from(researchSessions).$dynamic();
    if (notebookId) {
      q = q.where(eq(researchSessions.notebookId, notebookId));
    }
    const rows = q.orderBy(desc(researchSessions.createdAt)).all();
    return rows.map(serializeSession);
  })

  // Get single session
  .get('/research/:id', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    const steps = db()
      .select()
      .from(researchSteps)
      .where(eq(researchSteps.sessionId, id))
      .orderBy(researchSteps.id)
      .all();
    return { ...serializeSession(row), steps };
  })

  // Delete a research session (c37 — v1 api.py:440-463)
  .delete('/research/:id', ({ params, set }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    // Cancel if running
    const ac = activeResearch.get(id);
    if (ac) {
      ac.abort();
      activeResearch.delete(id);
    }

    db().delete(researchSessions).where(eq(researchSessions.id, id)).run();
    set.status = 204;
    return '';
  })

  // Approve search plan (c37: record step + ensure resume)
  .post('/research/:id/approve', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    if (row.status !== 'waiting_user') {
      throw new NotFoundError(`Session ${id} is not waiting for approval (status: ${row.status})`);
    }

    // Record approve step (v1 api.py:483-534)
    recordUserStep(id, row.currentIteration, 'approve');

    // Transition to searching so the agent loop unblocks
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'searching', approved: true };
  })

  // Modify search plan (c37: record step + store plan in inputData)
  .post('/research/:id/modify', ({ params, body }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    if (row.status !== 'waiting_user') {
      throw new NotFoundError(`Session ${id} is not waiting for approval (status: ${row.status})`);
    }

    const { plan } = body as {
      plan: {
        queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
        reasoning: string;
      };
    };

    // Record modify step with the new plan (v1 api.py:537-577)
    recordUserStep(id, row.currentIteration, 'modify', { plan });

    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'searching', modified: true };
  })

  // Skip iteration (c37: record step + advance iteration + set planning)
  .post('/research/:id/skip', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    // Status guard: only skip from waiting_user (v1 api.py:602-606)
    if (row.status !== 'waiting_user') {
      throw new Error(`Cannot skip from status '${row.status}' (must be waiting_user)`);
    }

    // Record skip step (v1 api.py:591-647)
    recordUserStep(id, row.currentIteration, 'skip');

    // Advance iteration; if at max, mark completed
    const nextIteration = row.currentIteration + 1;
    if (nextIteration > row.maxIterations) {
      // At max iteration — skip completes the research
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
  })

  // Finish early (c37: record step; 2026-07-13: non-blocking report generation)
  // v1 api.py:650-687 uses FastAPI BackgroundTasks — /finish marks COMPLETED and
  // returns immediately; the report is generated off the request path. The v2
  // spec `research-finish-generates-report` still requires the report to be
  // generated and persisted, so we spawn a fire-and-forget promise rather than
  // awaiting inside the handler (which previously blocked until the LLM finished
  // and risked client timeouts on large reports).
  .post('/research/:id/finish', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    // Status guard: reject from terminal states (v1 api.py:659-663)
    if (row.status === 'completed' || row.status === 'cancelled') {
      throw new Error(`Cannot finish from terminal status '${row.status}'`);
    }

    // Record finish step (v1 api.py:650-687)
    recordUserStep(id, row.currentIteration, 'finish');

    // Abort the in-flight agent loop BEFORE spawning the report generator.
    // Without this, both the fire-and-forget `generateFinalReport` below and
    // `runResearchCore`'s afterLoop path can concurrently read/write
    // `finalReport` (v1 has no race because only the graph node writes the
    // report). Mirrors the `/cancel` abort pattern (router.ts:533-537).
    const ac = activeResearch.get(id);
    if (ac) {
      ac.abort();
      activeResearch.delete(id);
    }

    // Mark COMPLETED immediately so the client + DB reflect the terminal state
    // without waiting for report generation (v1 parity: return right away).
    db()
      .update(researchSessions)
      .set({ status: 'completed', lockedAt: null, lockExpiresAt: null })
      .where(eq(researchSessions.id, id))
      .run();

    // Generate the report in the background (v1 GenerateReport node). On success
    // it persists finalReport; on failure it records a sentinel so callers can
    // tell a pending/failed report apart from a deliberately-empty one. Errors
    // are logged but never reject — the session is already COMPLETED.
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
        // c58: synthesize meaningful fallback (v1 graph.py:811-823), NOT a
        // sentinel string — sentinel passes the export guard and yields garbage.
        const results = (row.aggregatedResults ?? []) as ResearchResult[];
        db()
          .update(researchSessions)
          .set({ finalReport: synthesizeFallbackReport(row.topic, results) })
          .where(eq(researchSessions.id, id))
          .run();
      });

    return { id, status: 'completed', reportGenerated: 'pending' as const };
  })

  // Cancel (c37: record step + release lock)
  .post('/research/:id/cancel', ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    // Status guard: idempotent on already-cancelled (v1 returns 200);
    // reject from completed (v1 api.py:699-703)
    if (row.status === 'cancelled') {
      return { id, status: 'cancelled', message: 'Already cancelled' };
    }
    if (row.status === 'completed') {
      throw new Error(`Cannot cancel from terminal status 'completed'`);
    }

    // Record cancel step
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
  })

  // Resume from inferred state (c37: uses _infer_resume_state instead of force-planning)
  .post('/research/:id/resume', async ({ params }) => {
    const id = requirePositiveIntId(params.id, 'research id');

    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    // Status guard: only resume non-active sessions (v1 api.py:749-753).
    // Resuming an active session (planning/searching/waiting_user) would spawn
    // a second concurrent agent.
    if (row.status !== 'cancelled' && row.lockExpiresAt && isLockHeld(row)) {
      throw new Error(`Session ${id} is still active (status: ${row.status}, lock held)`);
    }

    // Infer resume state from last step (v1 _infer_resume_state)
    const { status: inferredStatus, iteration } = inferResumeState(id);

    if (inferredStatus === null) {
      throw new Error(
        `Session ${id} cannot be resumed (completed, cancelled by user, or already has a report)`,
      );
    }

    // Set the inferred status so runResearchFromState picks up correctly
    db()
      .update(researchSessions)
      .set({ status: inferredStatus, currentIteration: iteration })
      .where(eq(researchSessions.id, id))
      .run();

    spawnResearch(id, runResearchFromState);
    return { id, status: inferredStatus, resumed: true, iteration };
  })

  // Export report → source or note (c37: adds export_type=note)
  .post('/research/:id/export', async ({ params, body }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    if (!row.finalReport) {
      throw new NotFoundError('Research has no final report to export');
    }

    const exportType =
      (body as { exportType?: string; export_type?: string })?.exportType ??
      (body as { export_type?: string })?.export_type ??
      'source';

    // Build markdown report content
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
      // c49: create an Output with type=STRUCTURED + v1 content shape
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
      return { success: true, exportType: 'note', outputId: output.id };
    }

    // Default: export as source (v1 api.py:1245-1430)
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

    // Chunk the report
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

    // Embed and store vectors
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
      success: true,
      exportType: 'source',
      message: `报告已导出为来源：${filename}`,
      sourceId: source.id,
    };
  })

  // SSE stream endpoint (c37: named events + heartbeat)
  .get('/research/:id/stream', ({ params, set }) => {
    const id = requirePositiveIntId(params.id, 'research id');
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    // c58: auto-resume stalled sessions (v1 api.py:972-983 _should_resume_research).
    // If status is active but no in-process AbortController exists (process
    // crashed/restarted) OR the lock expired, trigger a resume so reconnecting
    // clients don't have to manually call /resume.
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

    return new ReadableStream({
      start(controller) {
        let lastStepId = 0;
        let lastStatus: string | null = null;
        let closed = false;
        const encoder = new TextEncoder();

        const emit = (eventName: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        // Heartbeat every 30s (v1 api.py heartbeat)
        const heartbeat = setInterval(() => {
          if (!closed) emit('heartbeat', {});
        }, 30_000);

        const poll = async () => {
          while (!closed) {
            await sleep(1000);

            const current = db()
              .select()
              .from(researchSessions)
              .where(eq(researchSessions.id, id))
              .get();
            if (!current) break;

            // c49: emit `status` event on every status transition (v1 api.py:1037-1058).
            // Before c49 the poll only derived events from new step rows, so pure
            // status transitions (planning→waiting_user→searching) were invisible.
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

            // Emit step-derived events
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
              closed = true;
              clearInterval(heartbeat);
              controller.close();
              break;
            }
          }
        };

        poll().catch((error) => {
          if (!closed) {
            emit('error', { type: 'error', message: String(error) });
            clearInterval(heartbeat);
            controller.close();
          }
        });
      },
    });
  });

registerApiDoc(apiDocs);

// ---------------------------------------------------------------------------
// SSE event derivation (c37: named events with event: field)
// ---------------------------------------------------------------------------

function deriveNamedEvent(step: typeof researchSteps.$inferSelect): {
  event: string;
  data: Record<string, unknown>;
} {
  // Keep `type` in the data payload for backward compatibility with
  // frontend parsers that read type from the JSON body (not event: line).
  const base = { iteration: step.iteration, data: step.outputData };
  switch (step.type) {
    case 'plan':
      return { event: 'plan_ready', data: { ...base, type: 'plan_ready' } };
    case 'user_input':
      return { event: 'waiting', data: { ...base, type: 'approval_request' } };
    case 'search':
      return { event: 'search_progress', data: { ...base, type: 'search_progress' } };
    case 'search_result':
      // P0-2: per-result event (v1 on_search_result, graph.py:497-498).
      // outputData carries {title,url,snippet,source,iteration,relevanceScore}
      // matching shared ResearchSearchResultSchema.
      return {
        event: 'search_result',
        data: { ...base, type: 'search_result', result: step.outputData },
      };
    case 'analyze':
      return { event: 'analysis', data: { ...base, type: 'analysis' } };
    case 'summary':
      return { event: 'report', data: { ...base, type: 'report' } };
    default:
      // c49: rich thinking — carry the step's output as a message so frontends
      // can show reasoning/insight text instead of an empty thinking event
      // (v1 api.py:1102-1186 emits per-step thinking with message text).
      return {
        event: 'thinking',
        data: {
          iteration: step.iteration,
          type: 'thinking',
          stepType: step.type,
          message: thinkingMessageForStep(step),
          data: step.outputData,
        },
      };
  }
}

/**
 * c49: derive a human-readable thinking message from a step (v1 api.py:1102-1186
 * emits rich thinking per step). Pulls summary/reasoning from outputData when
 * present, falls back to a type-based label.
 */
function thinkingMessageForStep(step: typeof researchSteps.$inferSelect): string {
  const out = step.outputData as Record<string, unknown> | null;
  if (out && typeof out.summary === 'string') return out.summary;
  if (out && typeof out.reasoning === 'string') return out.reasoning;
  return step.type || '思考中';
}

/**
 * c49: localized status messages (v1 api.py:1044-1050 status_messages map).
 * Surface a human-readable description of each status transition.
 */
function statusMessage(status: string): string {
  switch (status) {
    case 'planning':
      return '正在规划搜索策略';
    case 'waiting_user':
      return '等待用户审批搜索计划';
    case 'searching':
      return '正在执行搜索';
    case 'analyzing':
      return '正在分析结果并生成报告';
    case 'completed':
      return '研究完成';
    case 'cancelled':
      return '研究已取消';
    default:
      return status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}
