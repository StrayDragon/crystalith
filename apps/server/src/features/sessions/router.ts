import { SessionCreateSchema, SessionSchema, SessionUpdateSchema } from '@crystalith/shared';
// Sessions CRUD router — /v2/notebooks/:nid/sessions
//
// Mirrors v1 `features/sessions/api.py` on Elysia + Drizzle.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { sessions } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sessions',
    method: 'get',
    summary: 'List sessions for a notebook',
    tags: ['sessions'],
    responses: { 200: { description: 'List of sessions', body: SessionSchema.array() } },
  },
  {
    path: '/v2/notebooks/:nid/sessions',
    method: 'post',
    summary: 'Create a session in a notebook',
    tags: ['sessions'],
    request: { body: SessionCreateSchema },
    responses: { 201: { description: 'Created session', body: SessionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid',
    method: 'patch',
    summary: 'Update a session title/state',
    tags: ['sessions'],
    request: { body: SessionUpdateSchema },
    responses: { 200: { description: 'Updated session', body: SessionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid',
    method: 'delete',
    summary: 'Delete a session (cascades messages)',
    tags: ['sessions'],
    responses: { 204: { description: 'Deleted' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSession(row: {
  id: number;
  notebookId: number;
  title: string | null;
  sharedState: Record<string, unknown>;
  sharedStateRevision: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    title: row.title,
    shared_state: row.sharedState,
    shared_state_revision: row.sharedStateRevision,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function notFound(id: number): never {
  throw new NotFoundError(`Session ${id} not found`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sessionsRouter = new Elysia({ prefix: '/v2' })
  // List sessions for a notebook
  .get('/notebooks/:nid/sessions', ({ params }) => {
    const nid = Number(params.nid);
    const rows = db()
      .select()
      .from(sessions)
      .where(eq(sessions.notebookId, nid))
      .orderBy(desc(sessions.updatedAt))
      .all();
    return rows.map(serializeSession);
  })

  // Create a session
  .post(
    '/notebooks/:nid/sessions',
    ({ params, body }) => {
      const nid = Number(params.nid);
      const row = db()
        .insert(sessions)
        .values({
          notebookId: nid,
          title: body.title ?? null,
        })
        .returning()
        .get();
      return serializeSession(row);
    },
    { body: SessionCreateSchema },
  )

  // Update a session
  .patch(
    '/notebooks/:nid/sessions/:sid',
    ({ params, body }) => {
      const sid = Number(params.sid);
      const existing = db().select().from(sessions).where(eq(sessions.id, sid)).get();
      if (!existing) notFound(sid);

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;

      // Optimistic-concurrency check: only apply if revision matches
      if (body.shared_state_revision !== undefined) {
        if (body.shared_state_revision !== existing.sharedStateRevision) {
          throw new NotFoundError('Session state has been modified by another client');
        }
        if (body.shared_state !== undefined) {
          updateData.sharedState = body.shared_state;
          updateData.sharedStateRevision = existing.sharedStateRevision + 1;
        }
      }

      const updated = db()
        .update(sessions)
        .set(updateData)
        .where(eq(sessions.id, sid))
        .returning()
        .get();
      return serializeSession(updated);
    },
    { body: SessionUpdateSchema },
  )

  // Delete a session
  .delete('/notebooks/:nid/sessions/:sid', ({ params, set }) => {
    const sid = Number(params.sid);
    const existing = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!existing) notFound(sid);
    db().delete(sessions).where(eq(sessions.id, sid)).run();
    set.status = 204;
    return '';
  });

registerApiDoc(apiDocs);
