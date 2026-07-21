/**
 * Deep Research HTTP surface (c76).
 *
 * FE Desk/xyflow lives in c77-deep-research-ui — this router is backend-only.
 */
import {
  PaginationParamsSchema,
  ResearchConfirmBodySchema,
  ResearchConvertBodySchema,
  ResearchConvertToNoteResponseSchema,
  ResearchConvertToSourceResponseSchema,
  ResearchCreateNestedRequestSchema,
  ResearchForkBodySchema,
  ResearchRunSchema,
  ResearchRunsPageSchema,
} from '@crystalith/shared';
import { Elysia } from 'elysia';

import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import { resolveNestedNotebookId } from '../../shared/notebook-scope.ts';
import {
  cancelRun,
  confirmRun,
  convertToNote,
  convertToSource,
  createResearchSseResponse,
  createRun,
  forkNode,
  getRun,
  listRuns,
  pruneNode,
} from './service.ts';

registerApiDoc([
  {
    path: '/v2/notebooks/:nid/research',
    method: 'post',
    summary: 'Create a deep-research ResearchRun',
    tags: ['research'],
    request: { body: ResearchCreateNestedRequestSchema },
    responses: { 201: { description: 'Created ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research',
    method: 'get',
    summary: 'List ResearchRuns for a notebook',
    tags: ['research'],
    request: {
      query: {
        offset: PaginationParamsSchema.shape.offset,
        limit: PaginationParamsSchema.shape.limit,
      },
    },
    responses: { 200: { description: 'Paginated ResearchRun list', body: ResearchRunsPageSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid',
    method: 'get',
    summary: 'Get a ResearchRun',
    tags: ['research'],
    responses: { 200: { description: 'ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/stream',
    method: 'get',
    summary: 'SSE progress stream for a ResearchRun (R3b)',
    tags: ['research'],
    responses: { 200: { description: 'text/event-stream' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/confirm',
    method: 'post',
    summary: 'Confirm M1 hard-stop (budget / expand_branch)',
    tags: ['research'],
    request: { body: ResearchConfirmBodySchema },
    responses: { 200: { description: 'Updated ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/cancel',
    method: 'post',
    summary: 'Cancel a ResearchRun (A1)',
    tags: ['research'],
    responses: {
      200: { description: 'Cancelled / cancel-requested ResearchRun', body: ResearchRunSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/prune',
    method: 'post',
    summary: 'Prune a research graph subtree (U2)',
    tags: ['research'],
    responses: { 200: { description: 'Updated ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/fork',
    method: 'post',
    summary: 'Fork / request expand branch (U2 / M1)',
    tags: ['research'],
    request: { body: ResearchForkBodySchema },
    responses: { 200: { description: 'Updated ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/convert-to-note',
    method: 'post',
    summary: 'Convert research artifact to PARAGRAPH note (R7 / K1)',
    tags: ['research'],
    request: { body: ResearchConvertBodySchema },
    responses: {
      201: { description: 'Created PARAGRAPH output', body: ResearchConvertToNoteResponseSchema },
    },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/convert-to-source',
    method: 'post',
    summary: 'Convert research artifact to ingest+embed source (R7)',
    tags: ['research'],
    request: { body: ResearchConvertBodySchema },
    responses: {
      201: {
        description: 'Created source',
        body: ResearchConvertToSourceResponseSchema,
      },
    },
  },
] satisfies OpenApiRoute[]);

export const researchRouter = new Elysia({ prefix: '/v2' })
  .post(
    '/notebooks/:nid/research',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const notebookId = resolveNestedNotebookId(nid, body.notebookId);
      const run = createRun(notebookId, body);
      set.status = 201;
      return run;
    },
    { body: ResearchCreateNestedRequestSchema, response: ResearchRunSchema },
  )
  .get(
    '/notebooks/:nid/research',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      return listRuns(nid, query.offset ?? 0, query.limit ?? 20);
    },
    { query: PaginationParamsSchema, response: ResearchRunsPageSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getRun(nid, rid);
    },
    { response: ResearchRunSchema },
  )
  .get('/notebooks/:nid/research/:rid/stream', ({ params }) => {
    const nid = requirePositiveIntId(params.nid, 'notebook id');
    const rid = requirePositiveIntId(params.rid, 'research run id');
    return createResearchSseResponse(nid, rid);
  })
  .post(
    '/notebooks/:nid/research/:rid/confirm',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return confirmRun(nid, rid, body);
    },
    { body: ResearchConfirmBodySchema, response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/cancel',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return cancelRun(nid, rid);
    },
    { response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/prune',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return pruneNode(nid, rid, params.nodeId);
    },
    { response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/fork',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return forkNode(nid, rid, params.nodeId, body);
    },
    { body: ResearchForkBodySchema, response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/convert-to-note',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const result = convertToNote(nid, rid, body);
      set.status = 201;
      return result;
    },
    { body: ResearchConvertBodySchema, response: ResearchConvertToNoteResponseSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/convert-to-source',
    async ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const result = await convertToSource(nid, rid, body);
      set.status = 201;
      return result;
    },
    { body: ResearchConvertBodySchema, response: ResearchConvertToSourceResponseSchema },
  );
