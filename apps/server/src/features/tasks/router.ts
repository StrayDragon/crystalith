// Tasks router — /v2/tasks background job tracking.
//
// Provides GET /v2/tasks/:id for progress polling on long-running
// operations (research, refine, ingestion). Tasks are created by other
// feature routers and tracked via the `tasks` DB table.
import {
  NotebookIdQuerySchema,
  PaginatedSchema,
  PaginationParamsSchema,
  TaskSchema,
} from '@crystalith/shared';
import { count, desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { tasks as tasksTable } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { ErrorCode, sendError } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import type { TaskQueue } from '../../shared/queue.ts';

const TasksPageSchema = PaginatedSchema(TaskSchema);

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/tasks/:id',
    method: 'get',
    summary: 'Get task status + progress',
    tags: ['tasks'],
    responses: { 200: { description: 'Task details', body: TaskSchema } },
  },
  {
    path: '/v2/notebooks/:nid/tasks',
    method: 'get',
    summary: 'List tasks for a notebook',
    tags: ['tasks'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated task list', body: TasksPageSchema } },
  },
  {
    path: '/v2/tasks/:id/cancel',
    method: 'post',
    summary: 'Cancel a task',
    tags: ['tasks'],
    responses: { 200: { description: 'Cancelled task', body: TaskSchema } },
  },
];

function serializeTask(row: typeof tasksTable.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    type: row.type,
    status: row.status,
    payload: row.payload as Record<string, unknown>,
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: row.error,
    progress: row.progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function tasksRouter(taskQueue: TaskQueue) {
  registerApiDoc(apiDocs);

  return new Elysia({ prefix: '/v2' })
    .get(
      '/tasks/:id',
      ({ params, query }) => {
        const id = requirePositiveIntId(params.id, 'task id');
        const task = db().select().from(tasksTable).where(eq(tasksTable.id, id)).get();
        // c67: missing or notebook mismatch (incl. null notebookId) → 404
        if (!task || task.notebookId !== query.notebookId) {
          throw new NotFoundError(`Task ${id} not found`);
        }
        return serializeTask(task);
      },
      { query: NotebookIdQuerySchema, response: TaskSchema },
    )
    .get(
      '/notebooks/:nid/tasks',
      ({ params, query }) => {
        const nid = requirePositiveIntId(params.nid, 'notebook id');
        const offset = query.offset ?? 0;
        const limit = query.limit ?? 20;
        const total =
          db().select({ n: count() }).from(tasksTable).where(eq(tasksTable.notebookId, nid)).get()
            ?.n ?? 0;
        const rows = db()
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.notebookId, nid))
          .orderBy(desc(tasksTable.createdAt))
          .limit(limit)
          .offset(offset)
          .all();
        return {
          items: rows.map(serializeTask),
          total,
          offset,
          limit,
        };
      },
      { query: PaginationParamsSchema, response: TasksPageSchema },
    )
    .post(
      '/tasks/:id/cancel',
      ({ params, query, set }) => {
        const id = requirePositiveIntId(params.id, 'task id');
        const task = db().select().from(tasksTable).where(eq(tasksTable.id, id)).get();
        // c67: missing or notebook mismatch (incl. null notebookId) → 404
        if (!task || task.notebookId !== query.notebookId) {
          throw new NotFoundError(`Task ${id} not found`);
        }

        // c39 gap fix: return 409 for non-cancellable state (v1 api.py:71-76)
        if (task.status !== 'pending' && task.status !== 'running') {
          return sendError(
            set,
            ErrorCode.CONFLICT,
            `Task ${id} cannot be cancelled from status '${task.status}'`,
          );
        }

        // Use TaskQueue.cancel for proper AbortSignal interruption
        taskQueue.cancel(id);

        const updated = db().select().from(tasksTable).where(eq(tasksTable.id, id)).get();
        return serializeTask(updated!);
      },
      { query: NotebookIdQuerySchema },
    );
}
