import { streamText } from 'ai';
// Research router — /v2/research CRUD + agent execution.
//
// Endpoints:
//   POST   /v2/research                    — Start a new research session
//   GET    /v2/research                    — List research sessions for a notebook
//   GET    /v2/research/:id                — Get research session status + results
//   POST   /v2/research/:id/approve        — Approve search plan (HITL)
//   POST   /v2/research/:id/stop           — Stop/cancel a running research
//
// The research agent uses AI SDK streamText + maxSteps with webSearch,
// analyzeResults, and writeReport tools. Sessions persist to DB.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { notebooks, researchSessions } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { researchTools } from './tools.ts';

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
    path: '/v2/research/:id/stop',
    method: 'post',
    summary: 'Stop/cancel a research session',
    tags: ['research'],
    responses: { 200: { description: 'Session stopped' } },
  },
];

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
    aggregated_results: row.aggregatedResults,
    final_report: row.finalReport,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Research system prompt
// ---------------------------------------------------------------------------

const RESEARCH_SYSTEM_PROMPT = `You are an autonomous research agent. Follow this multi-step workflow:

1. **Search Phase**: Use 'webSearch' to gather information from the web. Make 2-4 varied searches covering different aspects.
2. **Analysis Phase**: Use 'analyzeResults' to evaluate coverage. If more is needed, go back to step 1.
3. **Report Phase**: Use 'writeReport' to produce a comprehensive final report.

Be thorough and systematic. Cover multiple angles and perspectives.`;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const researchRouter = new Elysia({ prefix: '/v2' })
  // Start a new research session (fire-and-forget in background)
  .post('/research', async ({ body }) => {
    const { topic, notebook_id, max_iterations } = body as Record<string, unknown>;
    const notebookId = Number(notebook_id);

    // Verify notebook exists
    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    // Create research session
    const session = db()
      .insert(researchSessions)
      .values({
        notebookId,
        topic: String(topic),
        status: 'searching',
        maxIterations: Number(max_iterations ?? 4),
      })
      .returning()
      .get();

    // Fire-and-forget: run agent in background
    runResearchAgent(session.id).catch((error) => {
      console.error(`[research] agent failed for session ${session.id}:`, error);
      db()
        .update(researchSessions)
        .set({ status: 'cancelled' })
        .where(eq(researchSessions.id, session.id))
        .run();
    });

    return serializeSession(session);
  })

  // List research sessions for a notebook
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

  // Approve search plan (HITL)
  .post('/research/:id/approve', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);

    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();

    return { id, status: 'searching', approved: true };
  })

  // Stop/cancel a research session
  .post('/research/:id/cancel', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    db()
      .update(researchSessions)
      .set({ status: 'cancelled' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, status: 'cancelled' };
  })

  .post('/research/:id/skip', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, skipped: true };
  })

  .post('/research/:id/finish', ({ params }) => {
    const id = Number(params.id);
    db()
      .update(researchSessions)
      .set({ status: 'completed' })
      .where(eq(researchSessions.id, id))
      .run();
    return { id, status: 'completed' };
  })

  .post('/research/:id/resume', async ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, id))
      .run();
    // Fire-and-forget: resume agent in background
    runResearchAgent(id).catch((error) =>
      console.error(`[research] resume failed for ${id}:`, error),
    );
    return { id, status: 'searching', resumed: true };
  })

  .post('/research/:id/export', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(researchSessions).where(eq(researchSessions.id, id)).get();
    if (!row) throw new NotFoundError(`Research session ${id} not found`);
    return {
      id: row.id,
      topic: row.topic,
      status: row.status,
      report: row.finalReport,
      aggregated_results: row.aggregatedResults,
    };
  });

registerApiDoc(apiDocs);

// ---------------------------------------------------------------------------
// Background agent runner
// ---------------------------------------------------------------------------

async function runResearchAgent(sessionId: number): Promise<void> {
  const session = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .get();
  if (!session) return;

  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const model = withRetry(await resolveModel(modelConfig));

  const result = await streamText({
    model,
    system: RESEARCH_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Research topic: ${session.topic}\n\nMaximum iterations: ${session.maxIterations}. Follow the Search → Analyze → Report workflow.`,
      },
    ],
    tools: researchTools,
  });

  // Collect the final report text
  let reportText = '';
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      reportText += part.text;
    }
  }

  // Persist results
  db()
    .update(researchSessions)
    .set({
      status: 'completed',
      finalReport: reportText || '(no report generated)',
    })
    .where(eq(researchSessions.id, sessionId))
    .run();
}
