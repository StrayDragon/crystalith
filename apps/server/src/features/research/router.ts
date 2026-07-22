/**
 * Deep Research HTTP surface (c76 / c78).
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
  ResearchNodeChatBodySchema,
  ResearchNodePatchBodySchema,
  ResearchProgressListSchema,
  ResearchProgressQuerySchema,
  ResearchReportPutBodySchema,
  ResearchReportViewSchema,
  ResearchRevisionCreateBodySchema,
  ResearchRevisionSchema,
  ResearchRevisionsListSchema,
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
  createNodeChatSseResponse,
  createResearchSseResponse,
  createRevision,
  createRun,
  deleteWorkingReport,
  forkNode,
  getReportView,
  getRevision,
  getRun,
  listProgress,
  listRevisions,
  listRuns,
  patchNode,
  pruneNode,
  putCanonicalReport,
  putWorkingReport,
  restoreRevision,
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
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId',
    method: 'patch',
    summary: 'Patch live research node fields (title / query / conclusionStatus)',
    tags: ['research'],
    request: { body: ResearchNodePatchBodySchema },
    responses: { 200: { description: 'Updated ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/nodes/:nodeId/chat',
    method: 'post',
    summary: 'Node-scoped chat SSE (proposals only; no auto graph mutate)',
    tags: ['research'],
    request: { body: ResearchNodeChatBodySchema },
    responses: { 200: { description: 'text/event-stream' } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/progress',
    method: 'get',
    summary: 'Progress ledger (afterSeq gap fill)',
    tags: ['research'],
    request: { query: ResearchProgressQuerySchema.shape },
    responses: { 200: { description: 'Progress events', body: ResearchProgressListSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions',
    method: 'get',
    summary: 'List research revisions',
    tags: ['research'],
    responses: { 200: { description: 'Revision list', body: ResearchRevisionsListSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions',
    method: 'post',
    summary: 'Create a user revision snapshot',
    tags: ['research'],
    request: { body: ResearchRevisionCreateBodySchema },
    responses: { 201: { description: 'Created revision', body: ResearchRevisionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions/:revId',
    method: 'get',
    summary: 'Get a revision',
    tags: ['research'],
    responses: { 200: { description: 'Revision', body: ResearchRevisionSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/revisions/:revId/restore',
    method: 'post',
    summary: 'Restore a revision (terminal runs only)',
    tags: ['research'],
    responses: { 200: { description: 'Updated ResearchRun', body: ResearchRunSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report',
    method: 'get',
    summary: 'Get canonical + working report view',
    tags: ['research'],
    responses: { 200: { description: 'Report view', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report',
    method: 'put',
    summary: 'Write canonical report',
    tags: ['research'],
    request: { body: ResearchReportPutBodySchema },
    responses: { 200: { description: 'Report view', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report/working',
    method: 'put',
    summary: 'Write/create working report (terminal only)',
    tags: ['research'],
    request: { body: ResearchReportPutBodySchema },
    responses: { 200: { description: 'Report view', body: ResearchReportViewSchema } },
  },
  {
    path: '/v2/notebooks/:nid/research/:rid/report/working',
    method: 'delete',
    summary: 'Discard working report',
    tags: ['research'],
    responses: { 200: { description: 'Report view', body: ResearchReportViewSchema } },
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
  .patch(
    '/notebooks/:nid/research/:rid/nodes/:nodeId',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return patchNode(nid, rid, params.nodeId, body);
    },
    { body: ResearchNodePatchBodySchema, response: ResearchRunSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/nodes/:nodeId/chat',
    ({ params, body, request }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return createNodeChatSseResponse(nid, rid, params.nodeId, body, request.signal);
    },
    { body: ResearchNodeChatBodySchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/progress',
    ({ params, query }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return listProgress(nid, rid, query.afterSeq ?? 0, query.limit ?? 100);
    },
    { query: ResearchProgressQuerySchema, response: ResearchProgressListSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/revisions',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return listRevisions(nid, rid);
    },
    { response: ResearchRevisionsListSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/revisions',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      const rev = createRevision(nid, rid, body);
      set.status = 201;
      return rev;
    },
    { body: ResearchRevisionCreateBodySchema, response: ResearchRevisionSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/revisions/:revId',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getRevision(nid, rid, params.revId);
    },
    { response: ResearchRevisionSchema },
  )
  .post(
    '/notebooks/:nid/research/:rid/revisions/:revId/restore',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return restoreRevision(nid, rid, params.revId);
    },
    { response: ResearchRunSchema },
  )
  .get(
    '/notebooks/:nid/research/:rid/report',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return getReportView(nid, rid);
    },
    { response: ResearchReportViewSchema },
  )
  .put(
    '/notebooks/:nid/research/:rid/report',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return putCanonicalReport(nid, rid, body.report);
    },
    { body: ResearchReportPutBodySchema, response: ResearchReportViewSchema },
  )
  .put(
    '/notebooks/:nid/research/:rid/report/working',
    ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return putWorkingReport(nid, rid, body.report);
    },
    { body: ResearchReportPutBodySchema, response: ResearchReportViewSchema },
  )
  .delete(
    '/notebooks/:nid/research/:rid/report/working',
    ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const rid = requirePositiveIntId(params.rid, 'research run id');
      return deleteWorkingReport(nid, rid);
    },
    { response: ResearchReportViewSchema },
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
