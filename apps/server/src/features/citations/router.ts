// Citations router — /v2/citations
//
// Endpoints:
//   GET /v2/citations/:messageId                        — Echo stored citations
//   GET /v2/notebooks/:nid/citations/context            — Neighborhood evidence review (c26/c53)
//
// The /context endpoint mirrors v1 `features/citations/api.py:get_citation_context`:
// resolves a target chunk by chunk_id or (source_id+chunk_index), fetches
// surrounding chunks in the same source, and returns before/chunk/after window.
import { CitationContextQuerySchema, NotebookIdQuerySchema } from '@crystalith/shared';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { messages, sessions } from '../../db/schema.ts';
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
    path: '/v2/notebooks/:nid/citations/context',
    method: 'get',
    summary: 'Get neighborhood evidence for a citation chunk',
    tags: ['citations'],
    responses: { 200: { description: 'Before/chunk/after context window' } },
  },
];

export const citationsRouter = new Elysia({ prefix: '/v2' })
  // Echo stored citations — c67: notebookId required via message → session
  .get(
    '/citations/:messageId',
    ({ params, query }) => {
      const messageId = requirePositiveIntId(params.messageId, 'message id');
      const msg = db().select().from(messages).where(eq(messages.id, messageId)).get();
      if (!msg) throw new NotFoundError(`Message ${messageId} not found`);

      const session = db().select().from(sessions).where(eq(sessions.id, msg.sessionId)).get();
      if (!session || session.notebookId !== query.notebookId) {
        throw new NotFoundError(`Message ${messageId} not found`);
      }

      return {
        messageId,
        citations: msg.citations ?? [],
      };
    },
    { query: NotebookIdQuerySchema },
  )

  // c53: Neighborhood evidence review — path now nests under notebook
  // (v1 api.py:13 prefix /v1/notebooks/{notebook_id}/citations; c26 proposal
  // promised /v2/notebooks/:nid/citations/context). BREAKING: was flat
  // /v2/citations/context?notebook_id=. Defaults before/after = 1 (v1 api.py:61-62).
  .get(
    '/notebooks/:nid/citations/context',
    async ({ params, query }) => {
      const notebookId = requirePositiveIntId(params.nid, 'notebook id');

      const result = await resolveChunkContext(notebookId, {
        chunkId: query.chunkId,
        sourceId: query.sourceId,
        chunkIndex: query.chunkIndex,
        neighborsBefore: query.before,
        neighborsAfter: query.after,
      });

      if (!result.citation.chunkId) {
        throw new NotFoundError('Chunk not found in notebook');
      }

      return result;
    },
    { query: CitationContextQuerySchema },
  );

registerApiDoc(apiDocs);
