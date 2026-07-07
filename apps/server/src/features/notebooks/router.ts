import { NotebookCreateSchema, NotebookSchema } from '@crystalith/shared';
// Notebooks CRUD router — /v2/notebooks
//
// Mirrors v1 `features/notebooks/api.py` behavior but adapted to Elysia +
// Drizzle direct DB access (no async SQLAlchemy session). Each handler
// returns a serialized Notebook matching the shared Zod schema.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks',
    method: 'get',
    summary: 'List all notebooks',
    tags: ['notebooks'],
    responses: { 200: { description: 'List of notebooks', body: NotebookSchema.array() } },
  },
  {
    path: '/v2/notebooks',
    method: 'post',
    summary: 'Create a notebook',
    tags: ['notebooks'],
    request: { body: NotebookCreateSchema },
    responses: {
      201: { description: 'Created notebook', body: NotebookSchema },
    },
  },
  {
    path: '/v2/notebooks/:id',
    method: 'get',
    summary: 'Get a notebook by ID',
    tags: ['notebooks'],
    responses: { 200: { description: 'Notebook', body: NotebookSchema } },
  },
  {
    path: '/v2/notebooks/:id',
    method: 'patch',
    summary: 'Update a notebook name',
    tags: ['notebooks'],
    request: { body: NotebookCreateSchema },
    responses: { 200: { description: 'Updated notebook', body: NotebookSchema } },
  },
  {
    path: '/v2/notebooks/:id',
    method: 'delete',
    summary: 'Delete a notebook (cascades)',
    tags: ['notebooks'],
    responses: { 204: { description: 'Deleted' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeNotebook(row: { id: number; name: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function notFound(id: number): never {
  throw new NotFoundError(`Notebook ${id} not found`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const notebooksRouter = new Elysia({ prefix: '/v2' })
  // List all notebooks
  .get('/notebooks', () => {
    const rows = db().select().from(notebooks).orderBy(desc(notebooks.updatedAt)).all();
    return rows.map(serializeNotebook);
  })

  // Create a notebook
  .post(
    '/notebooks',
    ({ body }) => {
      const row = db().insert(notebooks).values({ name: body.name }).returning().get();
      return serializeNotebook(row);
    },
    { body: NotebookCreateSchema },
  )

  // Get a single notebook
  .get('/notebooks/:id', ({ params }) => {
    const id = Number(params.id);
    const row = db().select().from(notebooks).where(eq(notebooks.id, id)).get();
    if (!row) notFound(id);
    return serializeNotebook(row);
  })

  // Update a notebook
  .patch(
    '/notebooks/:id',
    ({ params, body }) => {
      const id = Number(params.id);
      const existing = db().select().from(notebooks).where(eq(notebooks.id, id)).get();
      if (!existing) notFound(id);
      const updated = db()
        .update(notebooks)
        .set({ name: body.name })
        .where(eq(notebooks.id, id))
        .returning()
        .get();
      return serializeNotebook(updated);
    },
    { body: NotebookCreateSchema },
  )

  // Delete a notebook
  .delete('/notebooks/:id', ({ params, set }) => {
    const id = Number(params.id);
    const existing = db().select().from(notebooks).where(eq(notebooks.id, id)).get();
    if (!existing) notFound(id);
    db().delete(notebooks).where(eq(notebooks.id, id)).run();
    set.status = 204;
    return '';
  });

// Register OpenAPI docs
registerApiDoc(apiDocs);
