// Research router — /v2/research CRUD + agent execution.
//
// Endpoints:
//   POST   /v2/research                    — Start a new research session
//   GET    /v2/research                    — List research sessions for a notebook
//   GET    /v2/research/:id                — Get research session status + results
//   POST   /v2/research/:id/approve        — Approve search plan (HITL)
//   POST   /v2/research/:id/cancel         — Cancel a running research
//
// The research agent uses a cyclic Plan→HITL→Search→Analyze→loop→Report flow.
// AbortControllers are managed in-memory for cancel support.
import { and, desc, eq, gt } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, researchSessions, researchSteps } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { runResearch } from './agent.ts';

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
    path: '/v2/research/:id/cancel',
    method: 'post',
    summary: 'Cancel a research session',
    tags: ['research'],
    responses: { 200: { description: 'Session cancelled' } },
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
// Router
// ---------------------------------------------------------------------------

export const researchRouter = new Elysia({ prefix: '/v2' })
  // Start a new research session (background agent)
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

    // Create AbortController + run in background
    const ac = new AbortController();
    activeResearch.set(session.id, ac);

    runResearch(session.id, ac.signal).catch((error) => {
      console.error(`[research] agent failed for session ${session.id}:`, error);
      if (!ac.signal.aborted) {
        db()
          .update(researchSessions)
          .set({ status: 'cancelled' })
          .where(eq(researchSessions.id, session.id))
          .run();
      }
      activeResearch.delete(session.id);
    });

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

  // Get a single research session
  .get('/research/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    return serializeSession(row);
  })

  // Approve search plan (HITL) — sets status back to 'searching' to unblock agent
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

  // Skip (approve without changes)
  .post('/research/:id/skip', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, skipped: true };
  })

  // Finish (complete the session)
  .post('/research/:id/finish', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'completed' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, status: 'completed' };
  })

  // Cancel — true AbortSignal interruption
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

  // Resume a cancelled/paused session
  .post('/research/:id/resume', async ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    db()
      .update(researchSessions)
      .set({ status: 'planning' })
      .where(eq(researchSessions.id, id))
      .run();

    const ac = new AbortController();
    activeResearch.set(id, ac);

    runResearch(id, ac.signal).catch((error) => {
      console.error(`[research] resume failed for ${id}:`, error);
      activeResearch.delete(id);
    });

    return { id, status: 'planning', resumed: true };
  })

  // Export session
  .post('/research/:id/export', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    return {
      id: row.id,
      topic: row.topic,
      status: row.status,
      report: row.finalReport,
      aggregated_results: row.aggregatedResults as Array<Record<string, unknown>> | null,
    };
  })

  // SSE stream endpoint (poll-based progress relay)
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

            // Poll for new steps since last check
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
