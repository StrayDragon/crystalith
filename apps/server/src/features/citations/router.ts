// Citations router — /v2/citations/:messageId
//
// Returns the list of citations (source references) for a given message.
// Used by the frontend to render citation tooltips and source previews.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { messages } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/citations/:messageId',
    method: 'get',
    summary: 'Get citations for a message',
    tags: ['citations'],
    responses: { 200: { description: 'Array of citation objects' } },
  },
];

export const citationsRouter = new Elysia({ prefix: '/v2' }).get(
  '/citations/:messageId',
  ({ params }) => {
    const messageId = Number(params.messageId);
    const msg = db().select().from(messages).where(eq(messages.id, messageId)).get();

    if (!msg) throw new NotFoundError(`Message ${messageId} not found`);

    return {
      message_id: messageId,
      citations: msg.citations ?? [],
    };
  },
);

registerApiDoc(apiDocs);
