/**
 * Deep Research — HTTP stub (pending full rewrite).
 *
 * Intentionally empty of agent / HITL / SSE / lock / DB session logic.
 * Keep this file tiny until the new research runtime lands.
 *
 * Contract today:
 *   POST /v2/notebooks/:nid/research → 501 NOT_IMPLEMENTED
 *     message: 「深度研究尚未实现，等待重写」
 *
 * Everything else (list/get/stream/HITL/export/…) was removed on purpose.
 */
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';

import { db } from '../../db/index.ts';
import { notebooks } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';

/** Minimal create body so Eden clients keep a typed POST until rewrite. */
const StubCreateBodySchema = z.object({
  topic: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  maxIterations: z.number().int().positive().max(10).optional(),
  notebookId: z.number().int().positive().optional(),
});

registerApiDoc([
  {
    path: '/v2/notebooks/:nid/research',
    method: 'post',
    summary: 'Deep Research create (stub → 501, pending rewrite)',
    tags: ['research'],
    responses: {
      501: { description: 'Not implemented — Deep Research pending rewrite' },
    },
  } satisfies OpenApiRoute,
]);

export const researchRouter = new Elysia({ prefix: '/v2' }).post(
  '/notebooks/:nid/research',
  ({ params, body }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const notebookId = resolveNestedNotebookId(nid, body.notebookId);
    const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
    if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);

    // REWRITE MARKER: replace this throw with the new research runtime entrypoint.
    throw new AppHttpError(ErrorCode.NOT_IMPLEMENTED, '深度研究尚未实现，等待重写');
  },
  { body: StubCreateBodySchema },
);
