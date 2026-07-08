// Tasks router — /v2/tasks background job tracking.
//
// Provides GET /v2/tasks/:id for progress polling on long-running
// operations (research, refine, ingestion). Tasks are created by other
// feature routers and tracked via the `tasks` DB table.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { tasks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/tasks/:id',
    method: 'get',
    summary: 'Get task status + progress',
    tags: ['tasks'],
    responses: { 200: { description: 'Task details' } },
  },
  {
    path: '/v2/notebooks/:nid/tasks',
    method: 'get',
    summary: 'List tasks for a notebook',
    tags: ['tasks'],
    responses: { 200: { description: 'Task list' } },
  },
  {
    path: '/v2/tasks/:id/cancel',
    method: 'post',
    summary: 'Cancel a task',
    tags: ['tasks'],
    responses: { 200: { description: 'Cancelled task' } },
  },
];

function serializeTask(row: typeof tasks.$inferSelect) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    type: row.type,
    status: row.status,
    payload: row.payload,
    result: row.result,
    error: row.error,
    progress: row.progress,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const tasksRouter = new Elysia({ prefix: '/v2' })
  .get('/tasks/:id', ({ params }) => {
    const id = Number(params.id);
    const task = db().select().from(tasks).where(eq(tasks.id, id)).get();
    if (!task) throw new NotFoundError(`Task ${id} not found`);
    return serializeTask(task);
  })
  .get('/notebooks/:nid/tasks', ({ params }) => {
    const nid = Number(params.nid);
    const rows = db()
      .select()
      .from(tasks)
      .where(eq(tasks.notebookId, nid))
      .orderBy(desc(tasks.createdAt))
      .all();
    return rows.map(serializeTask);
  })
  .post('/tasks/:id/cancel', ({ params }) => {
    const id = Number(params.id);
    const task = db().select().from(tasks).where(eq(tasks.id, id)).get();
    if (!task) throw new NotFoundError(`Task ${id} not found`);

    if (task.status !== 'pending' && task.status !== 'running') {
      throw new NotFoundError(`Task ${id} cannot be cancelled from status '${task.status}'`);
    }

    db().update(tasks).set({ status: 'cancelled' }).where(eq(tasks.id, id)).run();

    const updated = db().select().from(tasks).where(eq(tasks.id, id)).get();
    return serializeTask(updated!);
  });

registerApiDoc(apiDocs);
