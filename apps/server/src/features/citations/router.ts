// Citations router — /v2/citations
//
// Endpoints:
//   GET /v2/citations/:messageId          — Echo stored citations (existing)
//   GET /v2/citations/context             — Neighborhood evidence review (c26)
//
// The /context endpoint mirrors v1 `features/citations/api.py:get_citation_context`:
// resolves a target chunk by chunk_id or (source_id+chunk_index), fetches
// surrounding chunks in the same source, and returns before/chunk/after window.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { messages } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { resolveChunkContext } from './context.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/citations/:messageId',
    method: 'get',
    summary: 'Get citations for a message',
    tags: ['citations'],
    responses: { 200: { description: 'Array of citation objects' } },
  },
  {
    path: '/v2/citations/context',
    method: 'get',
    summary: 'Get neighborhood evidence for a citation chunk',
    tags: ['citations'],
    responses: { 200: { description: 'Before/chunk/after context window' } },
  },
];

export const citationsRouter = new Elysia({ prefix: '/v2' })
  // Echo stored citations (existing)
  .get('/citations/:messageId', ({ params }) => {
    const messageId = Number(params.messageId);
    const msg = db().select().from(messages).where(eq(messages.id, messageId)).get();

    if (!msg) throw new NotFoundError(`Message ${messageId} not found`);

    return {
      message_id: messageId,
      citations: msg.citations ?? [],
    };
  })

  // Neighborhood evidence review (c26)
  .get('/citations/context', async ({ query }) => {
    const q = query as {
      chunk_id?: string;
      source_id?: string;
      chunk_index?: string;
      before?: string;
      after?: string;
      notebook_id?: string;
    };

    const hasChunkId = q.chunk_id !== undefined && q.chunk_id !== '';
    const hasSourceLocator =
      q.source_id !== undefined &&
      q.source_id !== '' &&
      q.chunk_index !== undefined &&
      q.chunk_index !== '';

    // Validation: exactly one resolution method
    if (hasChunkId && hasSourceLocator) {
      return new Response(
        JSON.stringify({ detail: 'Provide either chunk_id or source_id+chunk_index (not both)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (!hasChunkId && !hasSourceLocator) {
      return new Response(JSON.stringify({ detail: 'Provide chunk_id or source_id+chunk_index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const notebookId = Number(q.notebook_id);
    if (!notebookId) {
      return new Response(JSON.stringify({ detail: 'notebook_id query param required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const before = Math.max(0, Math.min(5, Number(q.before ?? 2)));
    const after = Math.max(0, Math.min(5, Number(q.after ?? 2)));

    let chunkId: number | undefined;
    let sourceId: number | undefined;
    let chunkIndex: number | undefined;

    if (hasChunkId) {
      chunkId = Number(q.chunk_id);
    } else {
      sourceId = Number(q.source_id);
      chunkIndex = Number(q.chunk_index);
    }

    const result = await resolveChunkContext(notebookId, {
      chunkId,
      sourceId,
      chunkIndex,
      neighborsBefore: before,
      neighborsAfter: after,
    });

    if (!result.citation.chunk_id) {
      throw new NotFoundError('Chunk not found in notebook');
    }

    return result;
  });

registerApiDoc(apiDocs);
