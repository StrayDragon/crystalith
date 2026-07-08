import { SessionCreateSchema, SessionSchema, SessionUpdateSchema } from '@crystalith/shared';
// Sessions CRUD router — /v2/notebooks/:nid/sessions
//
// Mirrors v1 `features/sessions/api.py` on Elysia + Drizzle.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { sessions, messages, chunks, sources } from '../../db/schema.ts';
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
  })

  // Convert session to source (all messages merged as text chunks)
  .post('/notebooks/:nid/sessions/:sid/convert-to-source', ({ params }) => {
    const sid = Number(params.sid);
    const session = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!session) notFound(sid);

    const msgRows = db()
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sid))
      .orderBy(messages.createdAt)
      .all();

    const text = msgRows.map((m) => `[${m.role}] ${m.content}`).join('\n\n');
    const sourceRow = db()
      .insert(sources)
      .values({
        notebookId: session.notebookId,
        filename: `session-${sid}-conversation.txt`,
        mimeType: 'text/plain',
        parserType: 'text',
        status: 'ready',
        metadata: { source: 'session_conversion', session_id: sid },
      })
      .returning()
      .get();

    db()
      .insert(chunks)
      .values({
        sourceId: sourceRow.id,
        chunkIndex: 0,
        text,
        startOffset: 0,
        endOffset: text.length,
      })
      .run();

    return {
      source_id: sourceRow.id,
      filename: sourceRow.filename,
      chunk_count: 1,
    };
  });

registerApiDoc(apiDocs);
