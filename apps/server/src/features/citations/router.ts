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
import { requirePositiveIntId } from '../../shared/ids.ts';
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
    const messageId = requirePositiveIntId(params.messageId, 'message id');
    const msg = db().select().from(messages).where(eq(messages.id, messageId)).get();

    if (!msg) throw new NotFoundError(`Message ${messageId} not found`);

    return {
      messageId,
      citations: msg.citations ?? [],
    };
  })

  // c53: Neighborhood evidence review — path now nests under notebook
  // (v1 api.py:13 prefix /v1/notebooks/{notebook_id}/citations; c26 proposal
  // promised /v2/notebooks/:nid/citations/context). BREAKING: was flat
  // /v2/citations/context?notebook_id=. Defaults before/after = 1 (v1 api.py:61-62).
  .get('/notebooks/:nid/citations/context', async ({ params, query }) => {
    const notebookId = requirePositiveIntId(params.nid, 'notebook id');

    const q = query as {
      chunkId?: string;
      sourceId?: string;
      chunkIndex?: string;
      before?: string;
      after?: string;
    };

    const hasChunkId = q.chunkId !== undefined && q.chunkId !== '';
    const hasSourceLocator =
      q.sourceId !== undefined &&
      q.sourceId !== '' &&
      q.chunkIndex !== undefined &&
      q.chunkIndex !== '';

    // Validation: exactly one resolution method
    if (hasChunkId && hasSourceLocator) {
      return new Response(
        JSON.stringify({ detail: 'Provide chunkId or sourceId+chunkIndex (not both)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (!hasChunkId && !hasSourceLocator) {
      return new Response(JSON.stringify({ detail: 'Provide chunkId or sourceId+chunkIndex' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // c53: default before/after = 1 (v1 api.py:61-62 Query(1, ge=0, le=5))
    const before = Math.max(0, Math.min(5, Number(q.before ?? 1)));
    const after = Math.max(0, Math.min(5, Number(q.after ?? 1)));

    let chunkId: number | undefined;
    let sourceId: number | undefined;
    let chunkIndex: number | undefined;

    if (hasChunkId) {
      chunkId = requirePositiveIntId(q.chunkId, 'chunk id');
    } else {
      sourceId = requirePositiveIntId(q.sourceId, 'source id');
      chunkIndex = Number(q.chunkIndex);
    }

    const result = await resolveChunkContext(notebookId, {
      chunkId,
      sourceId,
      chunkIndex,
      neighborsBefore: before,
      neighborsAfter: after,
    });

    if (!result.citation.chunkId) {
      throw new NotFoundError('Chunk not found in notebook');
    }

    return result;
  });

registerApiDoc(apiDocs);
