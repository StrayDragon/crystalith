import { SessionCreateSchema, SessionSchema, SessionUpdateSchema } from '@crystalith/shared';
// Sessions CRUD router — /v2/notebooks/:nid/sessions
//
// Mirrors v1 `features/sessions/api.py` on Elysia + Drizzle.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { sessions, messages, chunks, sources, outputs } from '../../db/schema.ts';
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
  {
    path: '/v2/notebooks/:nid/sessions/:sid/convert-to-source',
    method: 'post',
    summary: 'Convert session messages to a source with chunking + embedding',
    tags: ['sessions'],
    responses: { 201: { description: 'Created source from session' } },
  },
  {
    path: '/v2/notebooks/:nid/sessions/:sid/convert-to-output',
    method: 'post',
    summary: 'Convert session messages to an output (paragraph/bullets/structured)',
    tags: ['sessions'],
    responses: { 201: { description: 'Created output from session' } },
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
  .get('/notebooks/:nid/sessions', ({ params, query }) => {
    const nid = Number(params.nid);
    const offset = Number((query as { offset?: string }).offset ?? 0);
    const limit = Math.min(200, Math.max(1, Number((query as { limit?: string }).limit ?? 50)));
    const rows = db()
      .select()
      .from(sessions)
      .where(eq(sessions.notebookId, nid))
      .orderBy(desc(sessions.updatedAt))
      .all()
      .slice(offset, offset + limit);
    return rows.map(serializeSession);
  })

  // Get a single session (c39: v1 api.py:200-209)
  .get('/notebooks/:nid/sessions/:sid', ({ params }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const row = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!row || row.notebookId !== nid) notFound(sid);
    return serializeSession(row);
  })

  // Create a session
  .post(
    '/notebooks/:nid/sessions',
    ({ params, body, set }) => {
      const nid = Number(params.nid);
      const row = db()
        .insert(sessions)
        .values({
          notebookId: nid,
          title: body.title ?? null,
        })
        .returning()
        .get();
      set.status = 201;
      return serializeSession(row);
    },
    { body: SessionCreateSchema },
  )

  // Update a session (c39: notebook ownership check)
  .patch(
    '/notebooks/:nid/sessions/:sid',
    ({ params, body }) => {
      const nid = Number(params.nid);
      const sid = Number(params.sid);
      const existing = db().select().from(sessions).where(eq(sessions.id, sid)).get();
      if (!existing || existing.notebookId !== nid) notFound(sid);

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

  // Delete a session (c39: notebook ownership check)
  .delete('/notebooks/:nid/sessions/:sid', ({ params, set }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const existing = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!existing || existing.notebookId !== nid) notFound(sid);
    db().delete(sessions).where(eq(sessions.id, sid)).run();
    set.status = 204;
    return '';
  })

  // Convert session to source (c34: chunk + embed + vector — v1 behavior; c39: ownership + 201)
  .post('/notebooks/:nid/sessions/:sid/convert-to-source', async ({ params, body, set }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const sessionRow = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!sessionRow || sessionRow.notebookId !== nid) notFound(sid);

    // c52: honor message_ids filter (v1 api.py:257-268). When provided, only
    // convert the listed messages; missing ids → 404.
    const { message_ids } = (body ?? {}) as { message_ids?: number[] };
    let msgRows = db()
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sid))
      .orderBy(messages.createdAt)
      .all();
    if (message_ids && message_ids.length > 0) {
      const wanted = new Set(message_ids);
      // v1 api.py:262-268: 404 if any requested id is missing in the session
      const missing = message_ids.filter((id) => !msgRows.some((m) => m.id === id));
      if (missing.length > 0) {
        throw new NotFoundError(`Message(s) not found in session: ${missing.join(', ')}`);
      }
      msgRows = msgRows.filter((m) => wanted.has(m.id));
    }

    if (msgRows.length === 0) {
      throw new NotFoundError('No messages found in session');
    }

    // c52: v1 text format (api.py:110-123) — Chinese role labels + \n\n join.
    const text = msgRows
      .map((m) => {
        const role = m.role === 'assistant' ? '助手' : '用户';
        return `**${role}**: ${m.content}`;
      })
      .join('\n\n');

    const title = sessionRow.title ?? `会话_${sid}`;
    const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
    const filename = `对话_${title}_${timestamp}.md`;

    // Create source
    const source = db()
      .insert(sources)
      .values({
        notebookId: nid,
        filename,
        status: 'processing',
        metadata: {
          converted_from_session: sid,
          conversion_timestamp: new Date().toISOString(),
          message_count: msgRows.length,
        },
      })
      .returning()
      .get();

    // Chunk the conversation text
    const { chunkText } = await import('../../rag/chunker.ts');
    const reportChunks = chunkText(text);

    // Insert chunks
    const chunkRows: Array<{ id: number; text: string }> = [];
    for (const chunk of reportChunks) {
      const chunkRow = db()
        .insert(chunks)
        .values({
          sourceId: source.id,
          chunkIndex: chunk.index,
          text: chunk.text,
          metadata: { source_type: 'session_conversion' },
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
          insertChunkVector(db(), chunkRows[i].id, nid, source.id, vec);
        }

        const { bumpVectorEpoch, bumpSourcesEpoch } = await import('../../rag/cache.ts');
        bumpVectorEpoch(nid);
        bumpSourcesEpoch(nid);
        // Only set ready after successful embedding (c39: fix ready-before-vectors race)
        db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();
      } catch (error) {
        console.error('[sessions] convert embedding failed:', error);
        db()
          .update(sources)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Embedding failed',
          })
          .where(eq(sources.id, source.id))
          .run();
        throw new Error('Failed to embed session source', { cause: error });
      }
    } else {
      db().update(sources).set({ status: 'ready' }).where(eq(sources.id, source.id)).run();
    }

    set.status = 201;
    return {
      source_id: source.id,
      filename,
      chunk_count: chunkRows.length,
      message_count: msgRows.length,
    };
  })

  // Convert session to output (c34: v1 parity; c39: ownership + 201 + chunk_ids)
  .post('/notebooks/:nid/sessions/:sid/convert-to-output', ({ params, body, set }) => {
    const nid = Number(params.nid);
    const sid = Number(params.sid);
    const sessionRow = db().select().from(sessions).where(eq(sessions.id, sid)).get();
    if (!sessionRow || sessionRow.notebookId !== nid) notFound(sid);

    const { output_type, message_ids } = (body ?? {}) as {
      output_type: string;
      message_ids?: number[];
    };
    if (!['PARAGRAPH', 'BULLETS', 'STRUCTURED'].includes(output_type)) {
      throw new NotFoundError(`Unsupported output type: ${output_type}`);
    }

    // c52: honor message_ids filter (v1 api.py:417-428)
    let msgRows = db()
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sid))
      .orderBy(messages.createdAt)
      .all();
    if (message_ids && message_ids.length > 0) {
      const wanted = new Set(message_ids);
      const missing = message_ids.filter((id) => !msgRows.some((m) => m.id === id));
      if (missing.length > 0) {
        throw new NotFoundError(`Message(s) not found in session: ${missing.join(', ')}`);
      }
      msgRows = msgRows.filter((m) => wanted.has(m.id));
    }

    if (msgRows.length === 0) {
      throw new NotFoundError('No messages found in session');
    }

    // c52: v1 text format (api.py:438 text_format="raw") — plain content, no
    // role prefix. Was: [Assistant]/[User] prefixed per line.
    const textContent = msgRows.map((m) => m.content).join('\n');

    const title = sessionRow.title ?? `会话_${sid}`;

    // Build output content per type
    let content: Record<string, unknown>;
    if (output_type === 'BULLETS') {
      const lines = textContent
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 50);
      content = {
        title: `${title} - 要点笔记`,
        bullets: lines,
        _metadata: {
          converted_from_session: sid,
          message_count: msgRows.length,
        },
      };
    } else if (output_type === 'STRUCTURED') {
      content = {
        title: `${title} - 结构化笔记`,
        sections: [{ title: '对话内容', content: textContent }],
        _metadata: {
          converted_from_session: sid,
          message_count: msgRows.length,
        },
      };
    } else {
      content = {
        title: `${title} - 段落笔记`,
        text: textContent,
        _metadata: {
          converted_from_session: sid,
          message_count: msgRows.length,
        },
      };
    }

    // Collect chunk_ids from message citations (v1 api.py:491-500, c39)
    const chunkIds = [
      ...new Set(
        msgRows
          .flatMap((m) => (m.citations as Array<{ chunk_id?: number }> | null) ?? [])
          .map((c) => c.chunk_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];

    const output = db()
      .insert(outputs)
      .values({
        notebookId: nid,
        type: output_type as 'PARAGRAPH' | 'BULLETS' | 'STRUCTURED',
        prompt: `Session conversion: ${title}`,
        chunkIds,
        content,
      })
      .returning()
      .get();

    set.status = 201;
    return {
      output_id: output.id,
      output_type,
      title: content.title,
      message_count: msgRows.length,
    };
  });

registerApiDoc(apiDocs);
