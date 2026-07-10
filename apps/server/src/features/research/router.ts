// Research router — /v2/research CRUD + agent execution.
//
// Endpoints:
//   POST   /v2/research                    — Start a new research session
//   GET    /v2/research                    — List research sessions for a notebook
//   GET    /v2/research/:id                — Get research session status + results
//   POST   /v2/research/:id/approve        — Approve search plan (HITL)
//   POST   /v2/research/:id/modify         — Modify search plan (HITL, c24-B)
//   POST   /v2/research/:id/skip           — Skip iteration
//   POST   /v2/research/:id/finish         — Early complete
//   POST   /v2/research/:id/cancel         — Cancel a running research
//   POST   /v2/research/:id/resume         — Resume from persisted state (c24-B)
//   POST   /v2/research/:id/export         — Export report → source (c24-B)
//   GET    /v2/research/:id/stream         — SSE progress relay
//
// The research agent uses a cyclic Plan→HITL→Search→Analyze→loop→Report flow.
// AbortControllers are managed in-memory for cancel support.
import { and, desc, eq, gt } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { chunks, notebooks, researchSessions, researchSteps, sources } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { runResearch, runResearchFromState } from './agent.ts';

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
    path: '/v2/research/:id/cancel',
    method: 'post',
    summary: 'Cancel a research session',
    tags: ['research'],
    responses: { 200: { description: 'Session cancelled' } },
  },
  {
    path: '/v2/research/:id/resume',
    method: 'post',
    summary: 'Resume a paused/cancelled research from persisted state',
    tags: ['research'],
    responses: { 200: { description: 'Research resumed from last iteration' } },
  },
  {
    path: '/v2/research/:id/export',
    method: 'post',
    summary: 'Export research report as a source',
    tags: ['research'],
    responses: { 200: { description: 'Report exported to source' } },
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
    notebook_id: row.notebookId,
    topic: row.topic,
    status: row.status,
    current_iteration: row.currentIteration,
    max_iterations: row.maxIterations,
    aggregated_results: row.aggregatedResults as Array<Record<string, unknown>> | null,
    final_report: row.finalReport,
    created_at: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updated_at: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Session lock — prevent concurrent agent runs on the same session.
// ---------------------------------------------------------------------------

const LOCK_TTL_MS = 10 * 60 * 1000;

export function isLockHeld(row: { lockExpiresAt: Date | null }, now: Date = new Date()): boolean {
  return row.lockExpiresAt !== null && row.lockExpiresAt > now;
}

export function acquireLock(id: number): void {
  const now = new Date();
  const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
  if (!row) throw new NotFoundError(`Research session ${id} not found`);
  if (isLockHeld(row, now)) {
    throw new Error(`Research session ${id} is locked by another run`);
  }
  db()
    .update(researchSessions)
    .set({ lockedAt: now, lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS) })
    .where(eq(researchSessions.id, id))
    .run();
}

function releaseLock(id: number): void {
  db()
    .update(researchSessions)
    .set({ lockedAt: null, lockExpiresAt: null })
    .where(eq(researchSessions.id, id))
    .run();
}

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
// Router
// ---------------------------------------------------------------------------

export const researchRouter = new Elysia({ prefix: '/v2' })
  // Start a new research session
  .post('/research', async ({ body }) => {
    const { topic, notebook_id, max_iterations } = body as Record<string, unknown>;
    const notebookId = Number(notebook_id);

    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    const session = db()
      .insert(researchSessions)
      .values({
        notebookId,
        topic: String(topic),
        status: 'planning',
        maxIterations: Number(max_iterations ?? 4),
      })
      .returning()
      .get();

    spawnResearch(session.id, runResearch);
    return serializeSession(session);
  })

  // List research sessions
  .get('/research', ({ query }) => {
    const notebookId = Number((query as { notebook_id?: string }).notebook_id);
    let q = db().select().from(researchSessions).$dynamic();
    if (notebookId) {
      q = q.where(eq(researchSessions.notebookId, notebookId));
    }
    const rows = q.orderBy(desc(researchSessions.createdAt)).all();
    return rows.map(serializeSession);
  })

  // Get single session
  .get('/research/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    return serializeSession(row);
  })

  // Approve search plan
  .post('/research/:id/approve', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    if (row.status !== 'waiting_user') {
      throw new NotFoundError(`Session ${id} is not waiting for approval (status: ${row.status})`);
    }

    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'searching', approved: true };
  })

  // Modify search plan (c24-B: HITL modify action — accept modified plan, record step, resume)
  .post('/research/:id/modify', ({ params, body }) => {
    const id = Number(params.id);
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

    // Record modification as completed user_input step
    db()
      .insert(researchSteps)
      .values({
        sessionId: id,
        iteration: row.currentIteration,
        type: 'user_input',
        inputData: { action: 'modify' } as Record<string, unknown>,
        outputData: plan as unknown as Record<string, unknown>,
        status: 'completed',
      })
      .run();

    // Transition to searching so the agent loop unblocks
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'searching', modified: true };
  })

  // Skip iteration
  .post('/research/:id/skip', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, skipped: true };
  })

  // Finish early
  .post('/research/:id/finish', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'completed' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, status: 'completed' };
  })

  // Cancel
  .post('/research/:id/cancel', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    const ac = activeResearch.get(id);
    if (ac) {
      ac.abort();
      activeResearch.delete(id);
    }

    db()
      .update(researchSessions)
      .set({ status: 'cancelled' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'cancelled' };
  })

  // Resume from persisted state (c24-B: reads currentIteration + aggregatedResults)
  .post('/research/:id/resume', async ({ params }) => {
    const id = Number(params.id);

    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    // Reset to planning if in a terminal state
    if (row.status === 'completed' || row.status === 'cancelled') {
      db()
        .update(researchSessions)
        .set({ status: 'planning' })
        .where(eq(researchSessions.id, id))
        .run();
    }

    spawnResearch(id, runResearchFromState);
    return { id, status: 'planning', resumed: true };
  })

  // Export report → source (c24-B: chunk + embed + vector + source creation)
  .post('/research/:id/export', async ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    if (!row.finalReport) {
      throw new NotFoundError('Research has no final report to export');
    }

    // Build markdown report content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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

    const filename = `研究报告_${row.topic.slice(0, 20)}_${timestamp}.md`;

    // Create source record
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

    // Insert chunks
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

        for (const [i, vec] of vectors.entries()) {
          insertChunkVector(db(), chunkRows[i].id, row.notebookId, source.id, vec);
        }

        // Bump vector epoch to invalidate caches
        const { bumpVectorEpoch } = await import('../../rag/cache.ts');
        bumpVectorEpoch(row.notebookId);
      } catch (error) {
        console.error('[research] export embedding failed:', error);
        db().update(sources).set({ status: 'failed' }).where(eq(sources.id, source.id)).run();
        throw new Error('Failed to embed exported report');
      }
    }

    // Mark source ready
    db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();

    // Bump sources epoch
    const { bumpSourcesEpoch } = await import('../../rag/cache.ts');
    bumpSourcesEpoch(row.notebookId);

    return {
      success: true,
      message: `报告已导出为来源：${filename}`,
      source_id: source.id,
    };
  })

  // SSE stream endpoint
  .get('/research/:id/stream', ({ params, set }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers.Connection = 'keep-alive';

    return new ReadableStream({
      start(controller) {
        let lastStepId = 0;
        let closed = false;

        const poll = async () => {
          while (!closed) {
            await sleep(1000);

            const current = db()
              .select()
              .from(researchSessions)
              .where(eq(researchSessions.id, id))
              .get();
            if (!current) break;

            const steps = db()
              .select()
              .from(researchSteps)
              .where(and(gt(researchSteps.id, lastStepId), eq(researchSteps.sessionId, id)))
              .all();

            for (const step of steps) {
              const event = deriveEvent(step);
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
              lastStepId = step.id;
            }

            if (current.status === 'completed' || current.status === 'cancelled') {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'done', status: current.status })}\n\n`,
                ),
              );
              closed = true;
              controller.close();
              break;
            }
          }
        };

        poll().catch((error) => {
          if (!closed) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`,
              ),
            );
            controller.close();
          }
        });
      },
    });
  });

registerApiDoc(apiDocs);

// ---------------------------------------------------------------------------
// SSE event derivation
// ---------------------------------------------------------------------------

function deriveEvent(step: typeof researchSteps.$inferSelect) {
  switch (step.type) {
    case 'plan':
      return { type: 'plan_ready', iteration: step.iteration, data: step.outputData };
    case 'user_input':
      return { type: 'approval_request', iteration: step.iteration, data: step.outputData };
    case 'search':
      return { type: 'search_progress', iteration: step.iteration, data: step.outputData };
    case 'analyze':
      return { type: 'analysis', iteration: step.iteration, data: step.outputData };
    case 'summary':
      return { type: 'report', iteration: step.iteration, data: step.outputData };
    default:
      return { type: 'thinking', iteration: step.iteration };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
