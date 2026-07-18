import { MessageCreateSchema, MessageSchema, PaginationParamsSchema } from '@crystalith/shared';
// Messages router — /v2/notebooks/:nid/sessions/:sid/messages
//
// Supports paginated message listing and user message creation.
// Mirrors v1 `features/messages/api.py`.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { messages, sessions } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';

// ---------------------------------------------------------------------------
// OpenAPI doc registration
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/sessions/:sid/messages',
    method: 'get',
    summary: 'List messages in a session (paginated)',
    tags: ['messages'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: {
      200: { description: 'Paginated message list', body: MessageSchema.array() },
    },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid/messages',
    method: 'post',
    summary: 'Create a user message',
    tags: ['messages'],
    request: { body: MessageCreateSchema },
    responses: {
      201: { description: 'Created message', body: MessageSchema },
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeMessage(row: {
  id: number;
  sessionId: number;
  role: string;
  content: string;
  citations: unknown[] | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content,
    citations: row.citations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const messagesRouter = new Elysia({ prefix: '/v2' })
  // List messages (paginated)
  .get(
    '/notebooks/:nid/sessions/:sid/messages',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'session id');
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 200;

      // Verify session exists AND belongs to notebook (c39 gap fix)
      const session = db().select().from(sessions).where(eq(sessions.id, sid)).get();
      if (!session || session.notebookId !== nid)
        throw new NotFoundError(`Session ${sid} not found`);

      const rows = db()
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sid))
        // ASC: chronological order
        .orderBy(messages.createdAt)
        .limit(limit)
        .offset(offset)
        .all();

      return rows.map(serializeMessage);
    },
    { query: PaginationParamsSchema },
  )

  // Create a user message
  .post(
    '/notebooks/:nid/sessions/:sid/messages',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const sid = requirePositiveIntId(params.sid, 'session id');
      const session = db().select().from(sessions).where(eq(sessions.id, sid)).get();
      if (!session || session.notebookId !== nid)
        throw new NotFoundError(`Session ${sid} not found`);

      const row = db()
        .insert(messages)
        .values({
          sessionId: sid,
          role: body.role,
          content: body.content,
          citations: body.citations ?? null,
        })
        .returning()
        .get();

      // Touch the parent session's updated_at so recency ordering stays correct
      // (mirrors v1 features/messages/service.py:29-31).
      db().update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sid)).run();

      return serializeMessage(row);
    },
    { body: MessageCreateSchema },
  );

registerApiDoc(apiDocs);
